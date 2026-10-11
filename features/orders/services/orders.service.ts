// Order business service (spec 0009).
// Orchestrates stay date checks, PIN verification, atomic order creation,
// price snapshots, deduplication, and stay lockout rules.
import { createHash } from "node:crypto";
import { LRUCache } from "lru-cache";
import type { PrismaClient } from "@/generated/client";
import {
  PIN_LOCK_THRESHOLD,
  isStayOrderable,
  revokeStaySessionsForStay,
} from "@/features/stay-session";
import { isScryptRow, hashPin, verifyPin } from "@/lib/pin";
import { emitOrderCreated } from "@/lib/realtime-server";
import {
  createOrderWithItems,
  findMenuCategoriesWithItems,
  findMenuItemsByIds,
  findOrdersByStayId,
  findStayForOrdering,
  recordStayWrongPin,
  resetStayPinAttempts,
  updateStayPinHash,
} from "../repositories/orders.repository";
import {
  type CreateOrderInput,
  type OrderItemInput,
  validateOrderItems,
} from "../orders.schemas";

export const ORDER_DEDUP_WINDOW_MS = 10 * 1000;

const dedupCache = new LRUCache<string, number>({
  max: 2000,
  ttl: ORDER_DEDUP_WINDOW_MS,
});

export class OrderServiceError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Computes a deterministic hash of requested cart items.
 * Order items are sorted by menu item identifier before hashing.
 */
export function hashCartItems(items: OrderItemInput[]): string {
  const sorted = [...items].sort((a, b) => a.menuItemId.localeCompare(b.menuItemId));
  const text = JSON.stringify(sorted);
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function isOrderDuplicate(stayId: string, cartHash: string): boolean {
  const key = `${stayId}:${cartHash}`;
  return dedupCache.has(key);
}

export function recordOrderDuplicate(stayId: string, cartHash: string): void {
  const key = `${stayId}:${cartHash}`;
  dedupCache.set(key, Date.now());
}

/** Clear deduplication cache entry for test isolation. */
export function clearOrderDedupCache(): void {
  dedupCache.clear();
}

export interface PlacedOrderSummary {
  orderId: string;
  status: string;
  placedAt: Date;
  totalAmount: number;
  items: Array<{
    id: string;
    menuItemId: string;
    qty: number;
    unitPrice: number;
    nameEn: string;
    nameId: string;
  }>;
}

export interface GuestOrderHistoryItem {
  id: string;
  status: string;
  placedAt: Date;
  verifiedAt?: Date | null;
  etaMinutes: number | null;
  totalAmount: number;
  items: Array<{
    id: string;
    menuItemId: string;
    qty: number;
    unitPrice: number;
    nameEn: string;
    nameId: string;
  }>;
}

/**
 * Places an order for an authenticated stay with 6 digit PIN verification.
 * Enforces date validity, verifies PIN, resets counter on match, and writes
 * order plus items inside an atomic database transaction.
 */
export async function placeOrder(
  db: PrismaClient,
  stayId: string,
  input: CreateOrderInput,
): Promise<PlacedOrderSummary> {
  const cartHash = hashCartItems(input.items);
  if (isOrderDuplicate(stayId, cartHash)) {
    throw new OrderServiceError(
      409,
      "DUPLICATE_ORDER",
      "Duplicate order detected. Please wait a moment before trying again. / Pesanan duplikat terdeteksi. Harap tunggu sebentar.",
    );
  }

  const stay = await findStayForOrdering(db, stayId);
  if (!stay) {
    throw new OrderServiceError(
      401,
      "UNAUTHENTICATED",
      "Stay not found. Please sign in again. / Data menginap tidak ditemukan. Silakan masuk kembali.",
    );
  }

  if (!isStayOrderable(stay)) {
    throw new OrderServiceError(
      403,
      "STAY_NOT_ACTIVE",
      "This stay cannot order. Please contact the front desk. / Data ini tidak aktif. Hubungi resepsionis.",
    );
  }

  if (stay.pinLocked) {
    throw new OrderServiceError(
      403,
      "STAY_LOCKED",
      "This stay is locked. Please contact the front desk. / Data ini terkunci. Hubungi resepsionis.",
    );
  }

  const matched = await verifyPin(input.pin, stay.pinHash);
  if (!matched) {
    const attempts = stay.failedPinAttempts + 1;
    const locked = attempts >= PIN_LOCK_THRESHOLD;
    await recordStayWrongPin(db, stay.id, attempts, locked);

    if (locked) {
      await revokeStaySessionsForStay(db, stay.id);
      throw new OrderServiceError(
        401,
        "STAY_LOCKED",
        "Too many wrong PIN attempts. Please contact the front desk. / Terlalu banyak percobaan PIN yang salah. Hubungi resepsionis.",
        { remainingAttempts: 0 },
      );
    }

    const remaining = PIN_LOCK_THRESHOLD - attempts;
    throw new OrderServiceError(
      401,
      "WRONG_PIN",
      `Wrong PIN. ${remaining} attempts remaining. / PIN salah. Sisa ${remaining} percobaan.`,
      { remainingAttempts: remaining },
    );
  }

  // On valid PIN, reset wrong attempts and perform lazy upgrade if scrypt
  await resetStayPinAttempts(db, stay.id);
  if (isScryptRow(stay.pinHash)) {
    await updateStayPinHash(db, stay.id, await hashPin(input.pin));
  }

  // Validate menu items and check availability
  const requestedIds = input.items.map((i) => i.menuItemId);
  const catalogItems = await findMenuItemsByIds(db, requestedIds);
  const validation = validateOrderItems(input.items, catalogItems);

  if (validation.missingItems.length > 0) {
    throw new OrderServiceError(
      400,
      "INVALID_ITEMS",
      "One or more menu items were not found. / Satu atau beberapa menu tidak ditemukan.",
      { missingIds: validation.missingItems },
    );
  }

  if (validation.unavailableItems.length > 0) {
    throw new OrderServiceError(
      400,
      "ITEM_UNAVAILABLE",
      "Some items in your cart are currently unavailable. / Beberapa menu di keranjang Anda saat ini tidak tersedia.",
      { details: validation.unavailableItems },
    );
  }

  if (validation.computedTotal !== input.clientTotal) {
    throw new OrderServiceError(
      409,
      "PRICE_MISMATCH",
      "Price mismatch detected. Please review your cart before submitting. / Perbedaan harga terdeteksi. Silakan periksa kembali keranjang Anda.",
      {
        expectedTotal: validation.computedTotal,
        receivedTotal: input.clientTotal,
      },
    );
  }

  // Persist order and line items atomically in PostgreSQL
  const order = await createOrderWithItems(
    db,
    stay.id,
    validation.itemsWithPrices.map((item) => ({
      menuItemId: item.menuItemId,
      qty: item.qty,
      unitPrice: item.unitPrice,
    })),
  );

  // Register deduplication key only after successful persistence
  recordOrderDuplicate(stay.id, cartHash);

  // Emit realtime notification to kitchen and stay room
  emitOrderCreated({ stayId: stay.id, orderId: order.id });

  return {
    orderId: order.id,
    status: order.status,
    placedAt: order.placedAt,
    totalAmount: validation.computedTotal,
    items: order.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      qty: item.qty,
      unitPrice: item.unitPrice,
      nameEn: item.menuItem.nameEn,
      nameId: item.menuItem.nameId,
    })),
  };
}

/**
 * Retrieves orders placed by the authenticated stay.
 * Calculates order totals in memory from order items.
 */
export async function getStayOrders(
  db: PrismaClient,
  stayId: string,
): Promise<GuestOrderHistoryItem[]> {
  const rows = await findOrdersByStayId(db, stayId);
  return rows.map((order) => {
    const totalAmount = order.items.reduce(
      (sum, item) => sum + item.qty * item.unitPrice,
      0,
    );
    return {
      id: order.id,
      status: order.status,
      placedAt: order.placedAt,
      verifiedAt: order.verifiedAt,
      etaMinutes: order.etaMinutes,
      totalAmount,
      items: order.items.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        qty: item.qty,
        unitPrice: item.unitPrice,
        nameEn: item.menuItem.nameEn,
        nameId: item.menuItem.nameId,
      })),
    };
  });
}

/**
 * Retrieves active categories with available menu items for guest browsing.
 */
export async function getGuestMenu(db: PrismaClient) {
  return findMenuCategoriesWithItems(db);
}

