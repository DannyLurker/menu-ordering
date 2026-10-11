// Integration tests for the spec 0002 store level guards.
// These pin what the database itself enforces: partial unique stay per room,
// valid stay dates, CHECK bounds on price plus qty plus ETA, one folio per
// stay, one folio line per order, one active payment per order, snapshot
// totals, payment record. App level flows (stay date checks, PIN retry
// counting, verify transitions) live in scripts/prove-data-model.ts and stay
// covered by /check verify.
// Needs local Postgres with migrations applied: pnpm prisma migrate dev.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";

const ROOMS = ["921", "922", "923", "924", "925", "926", "927", "928", "929", "930", "931"];
const CATEGORY_ID = "test-cat-t1";
const ITEM_ID = "test-item-t1";
const NEG_ITEM_ID = "test-item-neg";

async function cleanup(): Promise<void> {
  const stays = await prisma.stay.findMany({ where: { roomNumber: { in: ROOMS } } });
  const stayIds = stays.map((s) => s.id);
  if (stayIds.length > 0) {
    const orders = await prisma.order.findMany({ where: { stayId: { in: stayIds } } });
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length > 0) {
      await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.folioLine.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    const folios = await prisma.folio.findMany({ where: { stayId: { in: stayIds } } });
    await prisma.folio.deleteMany({ where: { id: { in: folios.map((f) => f.id) } } });
    await prisma.guest.deleteMany({ where: { stayId: { in: stayIds } } });
    await prisma.stay.deleteMany({ where: { id: { in: stayIds } } });
  }
  await prisma.menuItem.deleteMany({ where: { id: ITEM_ID } });
  await prisma.menuItem.deleteMany({ where: { id: NEG_ITEM_ID } });
  await prisma.menuCategory.deleteMany({ where: { id: CATEGORY_ID } });
}

function stayWindow(): { checkIn: Date; checkOut: Date } {
  const checkIn = new Date();
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 2);
  return { checkIn, checkOut };
}

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("stay guards", () => {
  it("rejects a second ACTIVE stay in the same room but allows one after checkout, covers AC-1", async () => {
    const { checkIn, checkOut } = stayWindow();
    const first = await prisma.stay.create({
      data: { roomNumber: "921", guestName: "First", checkIn, checkOut, pinHash: "scrypt$t$t" },
    });

    expect(first.failedPinAttempts).toBe(0);
    expect(first.pinLocked).toBe(false);

    await expect(
      prisma.stay.create({
        data: { roomNumber: "921", guestName: "Second", checkIn, checkOut, pinHash: "scrypt$t$t" },
      }),
    ).rejects.toThrow();

    await prisma.stay.update({ where: { id: first.id }, data: { status: "CHECKED_OUT" } });
    const next = await prisma.stay.create({
      data: { roomNumber: "921", guestName: "Third", checkIn, checkOut, pinHash: "scrypt$t$t" },
    });
    expect(next.id).toBeDefined();
  });

  it("rejects inverted stay dates plus negative PIN counters, covers AC-1 and AC-5", async () => {
    const { checkIn, checkOut } = stayWindow();

    await expect(
      prisma.stay.create({
        data: { roomNumber: "928", guestName: "Backwards", checkIn: checkOut, checkOut: checkIn, pinHash: "scrypt$t$t" },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.stay.create({
        data: { roomNumber: "929", guestName: "Negative", checkIn, checkOut, pinHash: "scrypt$t$t", failedPinAttempts: -1 },
      }),
    ).rejects.toThrow();
  });
});

describe("menu guards", () => {
  it("keeps bilingual names plus whole rupiah price with availability on by default, covers AC-3", async () => {
    await prisma.menuCategory.create({
      data: { id: CATEGORY_ID, nameEn: "Mains", nameId: "Hidangan Utama", sortOrder: 1 },
    });
    const item = await prisma.menuItem.create({
      data: { id: ITEM_ID, categoryId: CATEGORY_ID, nameEn: "Nasi Goreng", nameId: "Nasi Goreng", price: 75000, sortOrder: 1 },
    });

    expect(item.isAvailable).toBe(true);
    expect(Number.isInteger(item.price)).toBe(true);
    expect(item.price).toBe(75000);
  });

  it("rejects a negative menu price, covers AC-3", async () => {
    await expect(
      prisma.menuItem.create({
        data: { id: NEG_ITEM_ID, categoryId: CATEGORY_ID, nameEn: "Bad", nameId: "Buruk", price: -1000, sortOrder: 9 },
      }),
    ).rejects.toThrow();
  });
});

describe("order plus folio guards", () => {
  it("keeps one folio per stay and one folio line per order so double verify fails, covers AC-4", async () => {
    const { checkIn, checkOut } = stayWindow();
    const stay = await prisma.stay.create({
      data: { roomNumber: "922", guestName: "Folio", checkIn, checkOut, pinHash: "scrypt$t$t" },
    });
    const order = await prisma.order.create({
      data: {
        stayId: stay.id,
        items: { create: { menuItemId: ITEM_ID, qty: 2, unitPrice: 75000 } },
      },
      include: { items: true },
    });
    const total = order.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
    expect(total).toBe(150000);

    const folio = await prisma.folio.create({ data: { stayId: stay.id } });
    await prisma.folioLine.create({
      data: { folioId: folio.id, orderId: order.id, labelEn: "Order", labelId: "Pesanan", amount: total },
    });

    await expect(prisma.folio.create({ data: { stayId: stay.id } })).rejects.toThrow();
    await expect(
      prisma.folioLine.create({
        data: { folioId: folio.id, orderId: order.id, labelEn: "dup", labelId: "dup", amount: total },
      }),
    ).rejects.toThrow();
  });

  it("keeps no folio lines for an order cancelled before verify, covers AC-6", async () => {
    const { checkIn, checkOut } = stayWindow();
    const stay = await prisma.stay.create({
      data: { roomNumber: "923", guestName: "Cancel", checkIn, checkOut, pinHash: "scrypt$t$t" },
    });
    const order = await prisma.order.create({
      data: { stayId: stay.id, items: { create: { menuItemId: ITEM_ID, qty: 1, unitPrice: 75000 } } },
    });

    const cancelled = await prisma.order.update({
      where: { id: order.id },
      data: { status: "GUEST_CANCELLED" },
    });
    const lines = await prisma.folioLine.count({ where: { orderId: order.id } });

    expect(cancelled.status).toBe("GUEST_CANCELLED");
    expect(lines).toBe(0);
  });

  it("carries nullable prep minutes set by kitchen and readable live, covers AC-7", async () => {
    const { checkIn, checkOut } = stayWindow();
    const stay = await prisma.stay.create({
      data: { roomNumber: "925", guestName: "Eta", checkIn, checkOut, pinHash: "scrypt$t$t" },
    });
    const order = await prisma.order.create({
      data: { stayId: stay.id, items: { create: { menuItemId: ITEM_ID, qty: 1, unitPrice: 75000 } } },
    });
    expect(order.etaMinutes).toBeNull();

    const verified = await prisma.order.update({
      where: { id: order.id },
      data: { status: "PREPARING", etaMinutes: 25, verifiedAt: new Date() },
    });
    expect(verified.etaMinutes).toBe(25);
  });

  it("records pay now as a RECORDED row and reconciles folio balance excluding VOID, covers AC-8 and AC-9", async () => {
    const { checkIn, checkOut } = stayWindow();
    const stay = await prisma.stay.create({
      data: { roomNumber: "924", guestName: "Pay", checkIn, checkOut, pinHash: "scrypt$t$t" },
    });
    const order = await prisma.order.create({
      data: {
        stayId: stay.id,
        status: "PREPARING",
        items: { create: { menuItemId: ITEM_ID, qty: 2, unitPrice: 75000 } },
      },
      include: { items: true },
    });
    const total = order.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
    const folio = await prisma.folio.create({ data: { stayId: stay.id } });
    await prisma.folioLine.create({
      data: { folioId: folio.id, orderId: order.id, labelEn: "Order", labelId: "Pesanan", amount: total },
    });

    const payment = await prisma.payment.create({
      data: { orderId: order.id, folioId: folio.id, method: "EWALLET_RECORD", amount: total },
    });
    expect(payment.status).toBe("RECORDED");

    await prisma.payment.create({
      data: { orderId: order.id, folioId: folio.id, method: "ROOM_CHARGE", status: "VOID", amount: 50000 },
    });

    const lines = await prisma.folioLine.findMany({ where: { folioId: folio.id } });
    const linesSum = lines.filter((l) => !l.voided).reduce((sum, l) => sum + l.amount, 0);
    const paid = await prisma.payment.findMany({ where: { folioId: folio.id, status: "RECORDED" } });
    const paidSum = paid.reduce((sum, p) => sum + p.amount, 0);

    expect(linesSum - paidSum).toBe(0);
  });
});

describe("check bound guards", () => {
  it("rejects out of range quantities plus negative prices plus duplicate lines, covers AC-3", async () => {
    const { checkIn, checkOut } = stayWindow();
    const stay = await prisma.stay.create({
      data: { roomNumber: "930", guestName: "Bounds", checkIn, checkOut, pinHash: "scrypt$t$t" },
    });
    const order = await prisma.order.create({
      data: { stayId: stay.id, items: { create: { menuItemId: ITEM_ID, qty: 1, unitPrice: 75000 } } },
    });

    await expect(
      prisma.orderItem.create({ data: { orderId: order.id, menuItemId: ITEM_ID, qty: 0, unitPrice: 75000 } }),
    ).rejects.toThrow();
    await expect(
      prisma.orderItem.create({ data: { orderId: order.id, menuItemId: ITEM_ID, qty: 21, unitPrice: 75000 } }),
    ).rejects.toThrow();
    await expect(
      prisma.orderItem.create({ data: { orderId: order.id, menuItemId: ITEM_ID, qty: 1, unitPrice: -100 } }),
    ).rejects.toThrow();
    await expect(
      prisma.orderItem.create({ data: { orderId: order.id, menuItemId: ITEM_ID, qty: 1, unitPrice: 75000 } }),
    ).rejects.toThrow();
  });

  it("rejects an ETA outside 1 to 120 while null stays allowed, covers AC-7", async () => {
    const { checkIn, checkOut } = stayWindow();
    const stay = await prisma.stay.create({
      data: { roomNumber: "931", guestName: "EtaBounds", checkIn, checkOut, pinHash: "scrypt$t$t" },
    });
    const order = await prisma.order.create({
      data: { stayId: stay.id, items: { create: { menuItemId: ITEM_ID, qty: 1, unitPrice: 75000 } } },
    });

    await expect(prisma.order.update({ where: { id: order.id }, data: { etaMinutes: 0 } })).rejects.toThrow();
    await expect(prisma.order.update({ where: { id: order.id }, data: { etaMinutes: 121 } })).rejects.toThrow();
    const kept = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(kept.etaMinutes).toBeNull();
  });

  it("keeps voided lines for a cancel after verify and excludes them from balance, covers AC-6 and AC-9", async () => {
    const { checkIn, checkOut } = stayWindow();
    const stay = await prisma.stay.create({
      data: { roomNumber: "926", guestName: "Void", checkIn, checkOut, pinHash: "scrypt$t$t" },
    });
    const order = await prisma.order.create({
      data: {
        stayId: stay.id,
        status: "PREPARING",
        etaMinutes: 20,
        items: { create: { menuItemId: ITEM_ID, qty: 2, unitPrice: 75000 } },
      },
    });
    const folio = await prisma.folio.create({ data: { stayId: stay.id } });
    const line = await prisma.folioLine.create({
      data: { folioId: folio.id, orderId: order.id, labelEn: "Order", labelId: "Pesanan", amount: 150000 },
    });

    await prisma.order.update({ where: { id: order.id }, data: { status: "KITCHEN_CANCELLED" } });
    const voided = await prisma.folioLine.update({ where: { id: line.id }, data: { voided: true } });

    const kept = await prisma.folioLine.findMany({ where: { folioId: folio.id } });
    const balance = kept.filter((l) => !l.voided).reduce((sum, l) => sum + l.amount, 0);

    expect(voided.voided).toBe(true);
    expect(kept).toHaveLength(1);
    expect(balance).toBe(0);
  });

  it("allows one active payment per order and a re-record after VOID, covers AC-8", async () => {
    const { checkIn, checkOut } = stayWindow();
    const stay = await prisma.stay.create({
      data: { roomNumber: "927", guestName: "Repay", checkIn, checkOut, pinHash: "scrypt$t$t" },
    });
    const order = await prisma.order.create({
      data: {
        stayId: stay.id,
        status: "PREPARING",
        items: { create: { menuItemId: ITEM_ID, qty: 1, unitPrice: 75000 } },
      },
    });
    const folio = await prisma.folio.create({ data: { stayId: stay.id } });
    await prisma.folioLine.create({
      data: { folioId: folio.id, orderId: order.id, labelEn: "Order", labelId: "Pesanan", amount: 75000 },
    });

    const first = await prisma.payment.create({
      data: { orderId: order.id, folioId: folio.id, method: "EWALLET_RECORD", amount: 75000 },
    });
    await expect(
      prisma.payment.create({
        data: { orderId: order.id, folioId: folio.id, method: "ROOM_CHARGE", amount: 75000 },
      }),
    ).rejects.toThrow();

    await prisma.payment.update({ where: { id: first.id }, data: { status: "VOID" } });
    const rerecord = await prisma.payment.create({
      data: { orderId: order.id, folioId: folio.id, method: "EWALLET_RECORD", amount: 75000 },
    });
    expect(rerecord.status).toBe("RECORDED");

    await prisma.payment.update({ where: { id: rerecord.id }, data: { status: "VOID" } });
    await expect(
      prisma.payment.create({
        data: { orderId: order.id, folioId: folio.id, method: "ROOM_CHARGE", amount: -50 },
      }),
    ).rejects.toThrow();
  });
});
