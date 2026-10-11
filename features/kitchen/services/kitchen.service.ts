// Kitchen business logic service (spec 0010).
// Implements order lifecycle transitions with strict state machine validation,
// actor tracking, bilingual error messages, and realtime event emissions.
import type { PrismaClient } from "@/generated/client";
import { emitOrderStatusChanged } from "@/lib/realtime-server";
import type { OrderStatus } from "@/lib/realtime";
import {
  findActiveKitchenOrders,
  findKitchenOrderById,
  updateOrderEta,
  updateOrderToCancelled,
  updateOrderToPreparing,
  updateOrderToReady,
  updateOrderToServed,
  type KitchenOrderRow,
} from "../repositories/kitchen.repository";
import type {
  ActiveKitchenOrders,
  CancelOrderResult,
  KitchenOrder,
  MarkReadyResult,
  MarkServedResult,
  UpdateEtaResult,
  VerifyOrderResult,
} from "../kitchen.types";

export class KitchenServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
    public readonly currentStatus?: OrderStatus,
  ) {
    super(message);
    this.name = "KitchenServiceError";
  }
}

function formatRow(row: KitchenOrderRow): KitchenOrder {
  return {
    id: row.id,
    stayId: row.stayId,
    roomNumber: row.stay.roomNumber,
    guestName: row.stay.guestName,
    status: row.status,
    etaMinutes: row.etaMinutes,
    placedAt: row.placedAt.toISOString(),
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    servedAt: row.servedAt ? row.servedAt.toISOString() : null,
    cancelReason: row.cancelReason,
    verifiedBy: row.verifiedBy,
    cancelledBy: row.cancelledBy,
    items: row.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      nameEn: item.menuItem.nameEn,
      nameId: item.menuItem.nameId,
      qty: item.qty,
      unitPrice: item.unitPrice,
    })),
  };
}

export async function getActiveKitchenOrders(
  db: PrismaClient,
  includeCompleted: boolean = false,
): Promise<ActiveKitchenOrders> {
  const result = await findActiveKitchenOrders(db, includeCompleted);
  return {
    pending: result.pending.map(formatRow),
    preparing: result.preparing.map(formatRow),
    completed: result.completed.map(formatRow),
  };
}

export async function verifyKitchenOrder(
  db: PrismaClient,
  orderId: string,
  etaMinutes: number,
  staffUserId: string,
): Promise<VerifyOrderResult> {
  if (!Number.isInteger(etaMinutes) || etaMinutes < 1 || etaMinutes > 120) {
    throw new KitchenServiceError(
      "INVALID_ETA",
      "Estimated time must be between 1 and 120 minutes · Estimasi waktu harus antara 1 dan 120 menit",
      400,
    );
  }

  const existing = await findKitchenOrderById(db, orderId);
  if (!existing) {
    throw new KitchenServiceError(
      "ORDER_NOT_FOUND",
      "Order not found · Pesanan tidak ditemukan",
      404,
    );
  }

  if (existing.status !== "PENDING") {
    throw new KitchenServiceError(
      "INVALID_TRANSITION",
      `Order is already ${existing.status} · Pesanan sudah berstatus ${existing.status}`,
      409,
      existing.status,
    );
  }

  const updated = await updateOrderToPreparing(
    db,
    orderId,
    etaMinutes,
    staffUserId,
  );

  emitOrderStatusChanged({
    stayId: updated.stayId,
    orderId: updated.id,
    status: updated.status,
    etaMinutes: updated.etaMinutes,
  });

  return {
    orderId: updated.id,
    stayId: updated.stayId,
    status: updated.status,
    verifiedAt: updated.verifiedAt
      ? updated.verifiedAt.toISOString()
      : new Date().toISOString(),
    etaMinutes: updated.etaMinutes ?? etaMinutes,
  };
}

export async function updateKitchenOrderEta(
  db: PrismaClient,
  orderId: string,
  etaMinutes: number,
): Promise<UpdateEtaResult> {
  if (!Number.isInteger(etaMinutes) || etaMinutes < 1 || etaMinutes > 120) {
    throw new KitchenServiceError(
      "INVALID_ETA",
      "Estimated time must be between 1 and 120 minutes · Estimasi waktu harus antara 1 dan 120 menit",
      400,
    );
  }

  const existing = await findKitchenOrderById(db, orderId);
  if (!existing) {
    throw new KitchenServiceError(
      "ORDER_NOT_FOUND",
      "Order not found · Pesanan tidak ditemukan",
      404,
    );
  }

  if (existing.status !== "PREPARING") {
    throw new KitchenServiceError(
      "INVALID_TRANSITION",
      `Cannot update ETA because order is ${existing.status} · Tidak dapat memperbarui ETA karena pesanan berstatus ${existing.status}`,
      409,
      existing.status,
    );
  }

  const updated = await updateOrderEta(db, orderId, etaMinutes);

  emitOrderStatusChanged({
    stayId: updated.stayId,
    orderId: updated.id,
    status: updated.status,
    etaMinutes: updated.etaMinutes,
  });

  return {
    orderId: updated.id,
    stayId: updated.stayId,
    status: updated.status,
    etaMinutes: updated.etaMinutes ?? etaMinutes,
  };
}

export async function markKitchenOrderReady(
  db: PrismaClient,
  orderId: string,
): Promise<MarkReadyResult> {
  const existing = await findKitchenOrderById(db, orderId);
  if (!existing) {
    throw new KitchenServiceError(
      "ORDER_NOT_FOUND",
      "Order not found · Pesanan tidak ditemukan",
      404,
    );
  }

  if (existing.status !== "PREPARING") {
    throw new KitchenServiceError(
      "INVALID_TRANSITION",
      `Only preparing orders can be marked ready (current: ${existing.status}) · Hanya pesanan yang sedang disiapkan yang dapat ditandai siap (saat ini: ${existing.status})`,
      409,
      existing.status,
    );
  }

  const updated = await updateOrderToReady(db, orderId);

  emitOrderStatusChanged({
    stayId: updated.stayId,
    orderId: updated.id,
    status: updated.status,
    etaMinutes: updated.etaMinutes,
  });

  return {
    orderId: updated.id,
    stayId: updated.stayId,
    status: updated.status,
  };
}

export async function markKitchenOrderServed(
  db: PrismaClient,
  orderId: string,
): Promise<MarkServedResult> {
  const existing = await findKitchenOrderById(db, orderId);
  if (!existing) {
    throw new KitchenServiceError(
      "ORDER_NOT_FOUND",
      "Order not found · Pesanan tidak ditemukan",
      404,
    );
  }

  if (existing.status !== "READY") {
    throw new KitchenServiceError(
      "INVALID_TRANSITION",
      `Only ready orders can be marked served (current: ${existing.status}) · Hanya pesanan yang sudah siap yang dapat ditandai telah disajikan (saat ini: ${existing.status})`,
      409,
      existing.status,
    );
  }

  const updated = await updateOrderToServed(db, orderId);

  emitOrderStatusChanged({
    stayId: updated.stayId,
    orderId: updated.id,
    status: updated.status,
    etaMinutes: updated.etaMinutes,
  });

  return {
    orderId: updated.id,
    stayId: updated.stayId,
    status: updated.status,
    servedAt: updated.servedAt
      ? updated.servedAt.toISOString()
      : new Date().toISOString(),
  };
}

export async function cancelKitchenOrder(
  db: PrismaClient,
  orderId: string,
  reason: string,
  staffUserId: string,
): Promise<CancelOrderResult> {
  const trimmed = reason.trim();
  if (trimmed.length < 1 || trimmed.length > 200) {
    throw new KitchenServiceError(
      "INVALID_CANCEL_REASON",
      "Cancel reason must be between 1 and 200 characters · Alasan pembatalan harus antara 1 dan 200 karakter",
      400,
    );
  }

  const existing = await findKitchenOrderById(db, orderId);
  if (!existing) {
    throw new KitchenServiceError(
      "ORDER_NOT_FOUND",
      "Order not found · Pesanan tidak ditemukan",
      404,
    );
  }

  if (existing.status !== "PENDING" && existing.status !== "PREPARING") {
    throw new KitchenServiceError(
      "INVALID_TRANSITION",
      `Cannot cancel order with status ${existing.status} · Tidak dapat membatalkan pesanan dengan status ${existing.status}`,
      409,
      existing.status,
    );
  }

  const updated = await updateOrderToCancelled(
    db,
    orderId,
    trimmed,
    staffUserId,
  );

  emitOrderStatusChanged({
    stayId: updated.stayId,
    orderId: updated.id,
    status: updated.status,
    etaMinutes: updated.etaMinutes,
  });

  return {
    orderId: updated.id,
    stayId: updated.stayId,
    status: updated.status,
    cancelReason: updated.cancelReason ?? trimmed,
  };
}
