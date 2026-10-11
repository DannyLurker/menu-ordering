// Unit tests for order business service (spec 0009).
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/client";
import { hashPin } from "@/lib/pin";
import {
  clearOrderDedupCache,
  getStayOrders,
  placeOrder,
  OrderServiceError,
} from "./orders.service";

describe("orders service", () => {
  let mockDb: any;
  const mockStayId = "stay-test-1";
  let samplePinHash: string;

  beforeEach(async () => {
    clearOrderDedupCache();
    samplePinHash = await hashPin("123456");

    mockDb = {
      stay: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      menuItem: {
        findMany: vi.fn(),
      },
      order: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      staySession: {
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockDb);
      }),
    };
  });

  function setupActiveStay(overrides: Record<string, any> = {}) {
    mockDb.stay.findUnique.mockResolvedValue({
      id: mockStayId,
      roomNumber: "101",
      guestName: "Alice Guest",
      status: "ACTIVE",
      checkIn: new Date(Date.now() - 24 * 60 * 60 * 1000),
      checkOut: new Date(Date.now() + 24 * 60 * 60 * 1000),
      pinHash: samplePinHash,
      failedPinAttempts: 0,
      pinLocked: false,
      ...overrides,
    });
  }

  function setupCatalog() {
    mockDb.menuItem.findMany.mockResolvedValue([
      {
        id: "item-nasgor",
        price: 75000,
        isAvailable: true,
        nameEn: "Nasi Goreng",
        nameId: "Nasi Goreng",
      },
      {
        id: "item-tea",
        price: 25000,
        isAvailable: true,
        nameEn: "Sweet Iced Tea",
        nameId: "Es Teh Manis",
      },
    ]);
  }

  it("places an order successfully on valid PIN and available items", async () => {
    setupActiveStay();
    setupCatalog();

    mockDb.order.create.mockResolvedValue({
      id: "order-123",
      status: "PENDING",
      placedAt: new Date("2026-10-11T12:00:00Z"),
      items: [
        {
          id: "oi-1",
          menuItemId: "item-nasgor",
          qty: 2,
          unitPrice: 75000,
          menuItem: { nameEn: "Nasi Goreng", nameId: "Nasi Goreng" },
        },
      ],
    });

    const result = await placeOrder(mockDb as unknown as PrismaClient, mockStayId, {
      pin: "123456",
      items: [{ menuItemId: "item-nasgor", qty: 2 }],
      clientTotal: 150000,
    });

    expect(result.orderId).toBe("order-123");
    expect(result.status).toBe("PENDING");
    expect(result.totalAmount).toBe(150000);
    expect(mockDb.stay.update).toHaveBeenCalledWith({
      where: { id: mockStayId },
      data: { failedPinAttempts: 0 },
    });
  });

  it("increments failed attempts on incorrect PIN and returns 401 WRONG_PIN", async () => {
    setupActiveStay({ failedPinAttempts: 1 });
    setupCatalog();

    await expect(
      placeOrder(mockDb as unknown as PrismaClient, mockStayId, {
        pin: "999999",
        items: [{ menuItemId: "item-nasgor", qty: 1 }],
        clientTotal: 75000,
      }),
    ).rejects.toMatchObject({
      status: 401,
      code: "WRONG_PIN",
      details: { remainingAttempts: 3 },
    });

    expect(mockDb.stay.update).toHaveBeenCalledWith({
      where: { id: mockStayId },
      data: { failedPinAttempts: 2, pinLocked: false },
    });
  });

  it("locks the stay on 5th incorrect PIN and revokes active sessions", async () => {
    setupActiveStay({ failedPinAttempts: 4 });
    setupCatalog();

    mockDb.staySession.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      placeOrder(mockDb as unknown as PrismaClient, mockStayId, {
        pin: "999999",
        items: [{ menuItemId: "item-nasgor", qty: 1 }],
        clientTotal: 75000,
      }),
    ).rejects.toMatchObject({
      status: 401,
      code: "STAY_LOCKED",
      details: { remainingAttempts: 0 },
    });

    expect(mockDb.stay.update).toHaveBeenCalledWith({
      where: { id: mockStayId },
      data: { failedPinAttempts: 5, pinLocked: true },
    });
    expect(mockDb.staySession.updateMany).toHaveBeenCalledWith({
      where: { stayId: mockStayId, revoked: false },
      data: { revoked: true },
    });
  });

  it("blocks orders if stay is already PIN locked", async () => {
    setupActiveStay({ pinLocked: true });

    await expect(
      placeOrder(mockDb as unknown as PrismaClient, mockStayId, {
        pin: "123456",
        items: [{ menuItemId: "item-nasgor", qty: 1 }],
        clientTotal: 75000,
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: "STAY_LOCKED",
    });
  });

  it("blocks orders if stay is outside valid dates", async () => {
    setupActiveStay({
      checkIn: new Date("2026-01-01"),
      checkOut: new Date("2026-01-02"),
    });

    await expect(
      placeOrder(mockDb as unknown as PrismaClient, mockStayId, {
        pin: "123456",
        items: [{ menuItemId: "item-nasgor", qty: 1 }],
        clientTotal: 75000,
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: "STAY_NOT_ACTIVE",
    });
  });

  it("rejects orders containing unavailable items", async () => {
    setupActiveStay();
    mockDb.menuItem.findMany.mockResolvedValue([
      {
        id: "item-nasgor",
        price: 75000,
        isAvailable: false,
        nameEn: "Nasi Goreng",
        nameId: "Nasi Goreng",
      },
    ]);

    await expect(
      placeOrder(mockDb as unknown as PrismaClient, mockStayId, {
        pin: "123456",
        items: [{ menuItemId: "item-nasgor", qty: 1 }],
        clientTotal: 75000,
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "ITEM_UNAVAILABLE",
    });
  });

  it("rejects orders on price mismatch between client and database", async () => {
    setupActiveStay();
    setupCatalog();

    await expect(
      placeOrder(mockDb as unknown as PrismaClient, mockStayId, {
        pin: "123456",
        items: [{ menuItemId: "item-nasgor", qty: 1 }],
        clientTotal: 50000, // DB price is 75000
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "PRICE_MISMATCH",
    });
  });

  it("rejects duplicate order within 10 seconds after successful placement", async () => {
    setupActiveStay();
    setupCatalog();

    mockDb.order.create.mockResolvedValue({
      id: "order-first",
      status: "PENDING",
      placedAt: new Date(),
      items: [
        {
          id: "oi-1",
          menuItemId: "item-nasgor",
          qty: 1,
          unitPrice: 75000,
          menuItem: { nameEn: "Nasi Goreng", nameId: "Nasi Goreng" },
        },
      ],
    });

    await placeOrder(mockDb as unknown as PrismaClient, mockStayId, {
      pin: "123456",
      items: [{ menuItemId: "item-nasgor", qty: 1 }],
      clientTotal: 75000,
    });

    await expect(
      placeOrder(mockDb as unknown as PrismaClient, mockStayId, {
        pin: "123456",
        items: [{ menuItemId: "item-nasgor", qty: 1 }],
        clientTotal: 75000,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "DUPLICATE_ORDER",
    });
  });

  it("resets failed PIN attempts to zero on successful order", async () => {
    setupActiveStay({ failedPinAttempts: 3 });
    setupCatalog();

    mockDb.order.create.mockResolvedValue({
      id: "order-reset",
      status: "PENDING",
      placedAt: new Date(),
      items: [],
    });

    await placeOrder(mockDb as unknown as PrismaClient, mockStayId, {
      pin: "123456",
      items: [{ menuItemId: "item-nasgor", qty: 1 }],
      clientTotal: 75000,
    });

    expect(mockDb.stay.update).toHaveBeenCalledWith({
      where: { id: mockStayId },
      data: { failedPinAttempts: 0 },
    });
  });

  it("does not reset failed PIN attempts on wrong PIN", async () => {
    setupActiveStay({ failedPinAttempts: 2 });
    setupCatalog();

    try {
      await placeOrder(mockDb as unknown as PrismaClient, mockStayId, {
        pin: "999999",
        items: [{ menuItemId: "item-nasgor", qty: 1 }],
        clientTotal: 75000,
      });
    } catch {
      // expected
    }

    expect(mockDb.stay.update).toHaveBeenCalledWith({
      where: { id: mockStayId },
      data: { failedPinAttempts: 3, pinLocked: false },
    });
    expect(mockDb.stay.update).not.toHaveBeenCalledWith({
      where: { id: mockStayId },
      data: { failedPinAttempts: 0 },
    });
  });

  it("returns UNAUTHENTICATED when stay does not exist", async () => {
    mockDb.stay.findUnique.mockResolvedValue(null);

    await expect(
      placeOrder(mockDb as unknown as PrismaClient, "nonexistent-stay", {
        pin: "123456",
        items: [{ menuItemId: "item-nasgor", qty: 1 }],
        clientTotal: 75000,
      }),
    ).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });

  it("returns INVALID_ITEMS when menu items are not found", async () => {
    setupActiveStay();
    mockDb.menuItem.findMany.mockResolvedValue([]);

    await expect(
      placeOrder(mockDb as unknown as PrismaClient, mockStayId, {
        pin: "123456",
        items: [{ menuItemId: "item-nasgor", qty: 1 }],
        clientTotal: 75000,
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "INVALID_ITEMS",
    });
  });

  it("blocks orders when stay status is not ACTIVE", async () => {
    setupActiveStay({ status: "CHECKED_OUT" });

    await expect(
      placeOrder(mockDb as unknown as PrismaClient, mockStayId, {
        pin: "123456",
        items: [{ menuItemId: "item-nasgor", qty: 1 }],
        clientTotal: 75000,
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: "STAY_NOT_ACTIVE",
    });
  });

  it("retrieves stay orders and calculates totalAmount in memory", async () => {
    mockDb.order.findMany.mockResolvedValue([
      {
        id: "order-1",
        status: "PENDING",
        placedAt: new Date("2026-10-11T10:00:00Z"),
        etaMinutes: 20,
        items: [
          {
            id: "oi-1",
            menuItemId: "item-nasgor",
            qty: 2,
            unitPrice: 75000,
            menuItem: { nameEn: "Nasi Goreng", nameId: "Nasi Goreng" },
          },
          {
            id: "oi-2",
            menuItemId: "item-tea",
            qty: 1,
            unitPrice: 25000,
            menuItem: { nameEn: "Sweet Iced Tea", nameId: "Es Teh Manis" },
          },
        ],
      },
    ]);

    const orders = await getStayOrders(mockDb as unknown as PrismaClient, mockStayId);
    expect(orders).toHaveLength(1);
    expect(orders[0].totalAmount).toBe(175000);
    expect(orders[0].status).toBe("PENDING");
  });

  it("returns empty array when stay has no orders", async () => {
    mockDb.order.findMany.mockResolvedValue([]);

    const orders = await getStayOrders(mockDb as unknown as PrismaClient, mockStayId);
    expect(orders).toEqual([]);
  });

  it("orders are returned newest first by placedAt", async () => {
    mockDb.order.findMany.mockResolvedValue([
      {
        id: "order-new",
        status: "PENDING",
        placedAt: new Date("2026-10-11T12:00:00Z"),
        etaMinutes: null,
        items: [{ id: "oi-1", menuItemId: "m1", qty: 1, unitPrice: 10000, menuItem: { nameEn: "Item A", nameId: "Item A" } }],
      },
      {
        id: "order-old",
        status: "PENDING",
        placedAt: new Date("2026-10-11T10:00:00Z"),
        etaMinutes: null,
        items: [{ id: "oi-2", menuItemId: "m2", qty: 1, unitPrice: 20000, menuItem: { nameEn: "Item B", nameId: "Item B" } }],
      },
    ]);

    const orders = await getStayOrders(mockDb as unknown as PrismaClient, mockStayId);
    expect(orders[0].id).toBe("order-new");
    expect(orders[1].id).toBe("order-old");
  });
});

