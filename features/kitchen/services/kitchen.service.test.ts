import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/client";
import {
  cancelKitchenOrder,
  getActiveKitchenOrders,
  KitchenServiceError,
  markKitchenOrderReady,
  markKitchenOrderServed,
  updateKitchenOrderEta,
  verifyKitchenOrder,
} from "./kitchen.service";
import * as realtimeServer from "@/lib/realtime-server";

vi.mock("@/lib/realtime-server", () => ({
  emitOrderStatusChanged: vi.fn(),
}));

type MockDb = {
  order: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

describe("kitchen.service", () => {
  let mockDb: MockDb;
  const getDb = () => mockDb as unknown as PrismaClient;

  const mockOrderRow = (overrides = {}) => ({
    id: "ord-1",
    stayId: "stay-1",
    status: "PENDING",
    etaMinutes: null,
    placedAt: new Date("2026-10-11T10:00:00Z"),
    verifiedAt: null,
    servedAt: null,
    cancelReason: null,
    verifiedBy: null,
    cancelledBy: null,
    stay: {
      roomNumber: "302",
      guestName: "Alice Walker",
    },
    items: [
      {
        id: "item-1",
        menuItemId: "menu-1",
        qty: 2,
        unitPrice: 50000,
        menuItem: {
          nameEn: "Fried Rice",
          nameId: "Nasi Goreng",
        },
      },
    ],
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      order: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };
  });

  describe("verifyKitchenOrder", () => {
    it("transitions PENDING to PREPARING, sets verifiedAt, verifiedBy, and emits event, satisfies AC-3", async () => {
      const order = mockOrderRow({ status: "PENDING" });
      mockDb.order.findUnique.mockResolvedValue(order);
      mockDb.order.update.mockResolvedValue(
        mockOrderRow({
          status: "PREPARING",
          etaMinutes: 20,
          verifiedAt: new Date("2026-10-11T10:05:00Z"),
          verifiedBy: "staff-101",
        }),
      );

      const result = await verifyKitchenOrder(getDb(), "ord-1", 20, "staff-101");

      expect(result.status).toBe("PREPARING");
      expect(result.etaMinutes).toBe(20);
      expect(mockDb.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ord-1" },
          data: expect.objectContaining({
            status: "PREPARING",
            etaMinutes: 20,
            verifiedBy: "staff-101",
          }),
        }),
      );
      expect(realtimeServer.emitOrderStatusChanged).toHaveBeenCalledWith({
        stayId: "stay-1",
        orderId: "ord-1",
        status: "PREPARING",
        etaMinutes: 20,
      });
    });

    it("returns 409 Conflict if order is not PENDING, satisfies AC-3, AC-13", async () => {
      const order = mockOrderRow({ status: "PREPARING", etaMinutes: 15 });
      mockDb.order.findUnique.mockResolvedValue(order);

      await expect(verifyKitchenOrder(getDb(), "ord-1", 20, "staff-101")).rejects.toThrow(
        KitchenServiceError,
      );
      try {
        await verifyKitchenOrder(getDb(), "ord-1", 20, "staff-101");
      } catch (err) {
        expect((err as KitchenServiceError).status).toBe(409);
        expect((err as KitchenServiceError).currentStatus).toBe("PREPARING");
      }
    });

    it("returns 404 if order does not exist", async () => {
      mockDb.order.findUnique.mockResolvedValue(null);
      await expect(verifyKitchenOrder(getDb(), "ord-missing", 15, "staff-101")).rejects.toMatchObject({
        status: 404,
      });
    });

    it("returns 400 if etaMinutes is invalid", async () => {
      await expect(verifyKitchenOrder(getDb(), "ord-1", 0, "staff-101")).rejects.toMatchObject({
        status: 400,
      });
      await expect(verifyKitchenOrder(getDb(), "ord-1", 121, "staff-101")).rejects.toMatchObject({
        status: 400,
      });
    });
  });

  describe("updateKitchenOrderEta", () => {
    it("updates ETA on a PREPARING order and emits event, satisfies AC-4", async () => {
      const order = mockOrderRow({ status: "PREPARING", etaMinutes: 20 });
      mockDb.order.findUnique.mockResolvedValue(order);
      mockDb.order.update.mockResolvedValue(
        mockOrderRow({ status: "PREPARING", etaMinutes: 35 }),
      );

      const result = await updateKitchenOrderEta(getDb(), "ord-1", 35);

      expect(result.etaMinutes).toBe(35);
      expect(mockDb.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ord-1" },
          data: { etaMinutes: 35 },
        }),
      );
      expect(realtimeServer.emitOrderStatusChanged).toHaveBeenCalledWith({
        stayId: "stay-1",
        orderId: "ord-1",
        status: "PREPARING",
        etaMinutes: 35,
      });
    });

    it("returns 409 Conflict if order is not PREPARING, satisfies AC-4, AC-13", async () => {
      const order = mockOrderRow({ status: "PENDING" });
      mockDb.order.findUnique.mockResolvedValue(order);

      await expect(updateKitchenOrderEta(getDb(), "ord-1", 25)).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  describe("markKitchenOrderReady", () => {
    it("transitions PREPARING to READY and emits event, satisfies AC-5", async () => {
      const order = mockOrderRow({ status: "PREPARING", etaMinutes: 15 });
      mockDb.order.findUnique.mockResolvedValue(order);
      mockDb.order.update.mockResolvedValue(
        mockOrderRow({ status: "READY", etaMinutes: 15 }),
      );

      const result = await markKitchenOrderReady(getDb(), "ord-1");

      expect(result.status).toBe("READY");
      expect(realtimeServer.emitOrderStatusChanged).toHaveBeenCalledWith({
        stayId: "stay-1",
        orderId: "ord-1",
        status: "READY",
        etaMinutes: 15,
      });
    });

    it("returns 409 Conflict if order is not PREPARING, satisfies AC-5, AC-13", async () => {
      const order = mockOrderRow({ status: "PENDING" });
      mockDb.order.findUnique.mockResolvedValue(order);

      await expect(markKitchenOrderReady(getDb(), "ord-1")).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  describe("markKitchenOrderServed", () => {
    it("transitions READY to SERVED and sets servedAt, satisfies AC-6", async () => {
      const order = mockOrderRow({ status: "READY" });
      mockDb.order.findUnique.mockResolvedValue(order);
      mockDb.order.update.mockResolvedValue(
        mockOrderRow({
          status: "SERVED",
          servedAt: new Date("2026-10-11T10:30:00Z"),
        }),
      );

      const result = await markKitchenOrderServed(getDb(), "ord-1");

      expect(result.status).toBe("SERVED");
      expect(result.servedAt).toBe("2026-10-11T10:30:00.000Z");
      expect(realtimeServer.emitOrderStatusChanged).toHaveBeenCalledWith({
        stayId: "stay-1",
        orderId: "ord-1",
        status: "SERVED",
        etaMinutes: null,
      });
    });

    it("returns 409 Conflict if order is not READY, satisfies AC-6, AC-13", async () => {
      const order = mockOrderRow({ status: "PREPARING" });
      mockDb.order.findUnique.mockResolvedValue(order);

      await expect(markKitchenOrderServed(getDb(), "ord-1")).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  describe("cancelKitchenOrder", () => {
    it("cancels PENDING order with reason and records cancelledBy, satisfies AC-7", async () => {
      const order = mockOrderRow({ status: "PENDING" });
      mockDb.order.findUnique.mockResolvedValue(order);
      mockDb.order.update.mockResolvedValue(
        mockOrderRow({
          status: "KITCHEN_CANCELLED",
          cancelReason: "Out of beef",
          cancelledBy: "staff-202",
        }),
      );

      const result = await cancelKitchenOrder(
        getDb(),
        "ord-1",
        "Out of beef",
        "staff-202",
      );

      expect(result.status).toBe("KITCHEN_CANCELLED");
      expect(result.cancelReason).toBe("Out of beef");
      expect(realtimeServer.emitOrderStatusChanged).toHaveBeenCalledWith({
        stayId: "stay-1",
        orderId: "ord-1",
        status: "KITCHEN_CANCELLED",
        etaMinutes: null,
      });
    });

    it("cancels PREPARING order with reason, satisfies AC-7", async () => {
      const order = mockOrderRow({ status: "PREPARING", etaMinutes: 20 });
      mockDb.order.findUnique.mockResolvedValue(order);
      mockDb.order.update.mockResolvedValue(
        mockOrderRow({
          status: "KITCHEN_CANCELLED",
          cancelReason: "Equipment breakdown",
          cancelledBy: "staff-202",
        }),
      );

      const result = await cancelKitchenOrder(
        getDb(),
        "ord-1",
        "Equipment breakdown",
        "staff-202",
      );

      expect(result.status).toBe("KITCHEN_CANCELLED");
    });

    it("returns 409 Conflict if order is in terminal state, satisfies AC-7, AC-13", async () => {
      const order = mockOrderRow({ status: "SERVED" });
      mockDb.order.findUnique.mockResolvedValue(order);

      await expect(
        cancelKitchenOrder(getDb(), "ord-1", "Changed mind", "staff-202"),
      ).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  describe("getActiveKitchenOrders", () => {
    it("sorts PENDING by oldest first and PREPARING by soonest ETA first, satisfies AC-1, AC-2", async () => {
      const p1 = mockOrderRow({
        id: "p1",
        status: "PENDING",
        placedAt: new Date("2026-10-11T10:05:00Z"),
      });
      const p2 = mockOrderRow({
        id: "p2",
        status: "PENDING",
        placedAt: new Date("2026-10-11T10:00:00Z"),
      });
      const prep1 = mockOrderRow({
        id: "prep1",
        status: "PREPARING",
        verifiedAt: new Date("2026-10-11T10:00:00Z"),
        etaMinutes: 30, // finish at 10:30
      });
      const prep2 = mockOrderRow({
        id: "prep2",
        status: "PREPARING",
        verifiedAt: new Date("2026-10-11T10:00:00Z"),
        etaMinutes: 10, // finish at 10:10
      });

      mockDb.order.findMany.mockResolvedValue([p1, p2, prep1, prep2]);

      const result = await getActiveKitchenOrders(getDb());

      expect(result.pending[0].id).toBe("p2"); // oldest first
      expect(result.pending[1].id).toBe("p1");

      expect(result.preparing[0].id).toBe("prep2"); // soonest ETA first (10:10 < 10:30)
      expect(result.preparing[1].id).toBe("prep1");
    });
  });
});
