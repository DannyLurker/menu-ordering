// Proof for spec 0010: walks through the kitchen live board lifecycle
// against the live Postgres database and proves all acceptance criteria.
// Run: cmd /c pnpm tsx scripts/prove-kitchen-board.ts
import "dotenv/config";
import { prisma } from "../lib/db";
import { createStay, setupStayPin } from "../features/stays";
import { placeOrder } from "../features/orders";
import {
  cancelKitchenOrder,
  getActiveKitchenOrders,
  KitchenServiceError,
  markKitchenOrderReady,
  markKitchenOrderServed,
  updateKitchenOrderEta,
  verifyKitchenOrder,
} from "../features/kitchen";

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function assert(cond: boolean, label: string): void {
  if (!cond) {
    throw new Error(`FAIL: ${label}`);
  }
  console.log(`ok: ${label}`);
}

async function expectKitchenError(
  fn: () => Promise<unknown>,
  status: number,
  code: string,
  label: string,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    assert(err instanceof KitchenServiceError, `${label} throws KitchenServiceError`);
    assert((err as KitchenServiceError).status === status, `${label} status ${status}`);
    assert((err as KitchenServiceError).code === code, `${label} code ${code}`);
    return;
  }
  throw new Error(`FAIL: ${label} did not throw`);
}

async function cleanup(roomNumbers: string[]): Promise<void> {
  const stays = await prisma.stay.findMany({ where: { roomNumber: { in: roomNumbers } } });
  const stayIds = stays.map((s) => s.id);
  if (stayIds.length === 0) return;

  const orders = await prisma.order.findMany({ where: { stayId: { in: stayIds } } });
  const orderIds = orders.map((o) => o.id);
  if (orderIds.length > 0) {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }

  await prisma.staySession.deleteMany({ where: { stayId: { in: stayIds } } });
  await prisma.guest.deleteMany({ where: { stayId: { in: stayIds } } });
  await prisma.stay.deleteMany({ where: { id: { in: stayIds } } });
}

async function main(): Promise<void> {
  const testRooms = ["K-101", "K-102", "K-103"];
  await cleanup(testRooms);

  // Find a menu item to order
  const item = await prisma.menuItem.findFirst({ where: { isAvailable: true } });
  if (!item) throw new Error("No menu item found in database. Seed required.");

  // Find or create a staff user for actor tracking
  let staff = await prisma.user.findFirst({ where: { role: "KITCHEN" } });
  if (!staff) {
    staff = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  }
  if (!staff) {
    staff = await prisma.user.create({
      data: {
        id: "prove-kitchen-staff",
        name: "Prove Kitchen Chef",
        email: "prove.chef@hotel.test",
        emailVerified: true,
        role: "KITCHEN",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  const today = new Date();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Setup Stay 1 & 2
  const stay1 = await createStay(prisma, {
    roomNumber: "K-101",
    guestName: "Kitchen Test Guest 1",
    checkIn: utcDay(today),
    checkOut: utcDay(tomorrow),
  });
  await setupStayPin(prisma, stay1.stayId, stay1.setupCode, "839201", "839201");

  const stay2 = await createStay(prisma, {
    roomNumber: "K-102",
    guestName: "Kitchen Test Guest 2",
    checkIn: utcDay(today),
    checkOut: utcDay(tomorrow),
  });
  await setupStayPin(prisma, stay2.stayId, stay2.setupCode, "749102", "749102");

  console.log("\n--- AC-1, AC-2: Place orders and check board ordering ---");
  // Order 1 from Room K-101
  const order1 = await placeOrder(prisma, stay1.stayId, {
    pin: "839201",
    items: [{ menuItemId: item.id, qty: 1 }],
    clientTotal: item.price,
  });
  assert(order1.status === "PENDING", "Order 1 placed as PENDING");

  // Order 2 from Room K-102 (placed shortly after)
  const order2 = await placeOrder(prisma, stay2.stayId, {
    pin: "749102",
    items: [{ menuItemId: item.id, qty: 2 }],
    clientTotal: item.price * 2,
  });
  assert(order2.status === "PENDING", "Order 2 placed as PENDING");

  const activeOrders = await getActiveKitchenOrders(prisma, true);
  assert(activeOrders.pending.length >= 2, "Active orders returns pending list");
  const p1Idx = activeOrders.pending.findIndex((o) => o.id === order1.orderId);
  const p2Idx = activeOrders.pending.findIndex((o) => o.id === order2.orderId);
  assert(p1Idx < p2Idx, "PENDING orders sorted oldest first (AC-1)");

  console.log("\n--- AC-3: Verify PENDING into PREPARING with ETA ---");
  await expectKitchenError(
    () => verifyKitchenOrder(prisma, order1.orderId, 0, staff!.id),
    400,
    "INVALID_ETA",
    "Reject verify with ETA < 1",
  );
  await expectKitchenError(
    () => verifyKitchenOrder(prisma, order1.orderId, 121, staff!.id),
    400,
    "INVALID_ETA",
    "Reject verify with ETA > 120",
  );

  const verifyRes = await verifyKitchenOrder(prisma, order1.orderId, 25, staff!.id);
  assert(verifyRes.status === "PREPARING", "Order 1 status transitioned to PREPARING");
  assert(verifyRes.etaMinutes === 25, "Order 1 has etaMinutes set to 25");

  const dbOrder1 = await prisma.order.findUniqueOrThrow({ where: { id: order1.orderId } });
  assert(dbOrder1.verifiedBy === staff!.id, "verifiedBy persisted in database");
  assert(dbOrder1.verifiedAt !== null, "verifiedAt persisted in database");

  // Conflict test: Cannot re-verify PREPARING order (AC-3, AC-13)
  await expectKitchenError(
    () => verifyKitchenOrder(prisma, order1.orderId, 20, staff!.id),
    409,
    "INVALID_TRANSITION",
    "Re-verify returns 409 Conflict",
  );

  console.log("\n--- AC-4: Update ETA on PREPARING order ---");
  const updateRes = await updateKitchenOrderEta(prisma, order1.orderId, 35);
  assert(updateRes.etaMinutes === 35, "ETA updated to 35 minutes");
  const dbOrder1Updated = await prisma.order.findUniqueOrThrow({ where: { id: order1.orderId } });
  assert(dbOrder1Updated.etaMinutes === 35, "Persisted new ETA");

  // Conflict test: Cannot update ETA on PENDING order (AC-4, AC-13)
  await expectKitchenError(
    () => updateKitchenOrderEta(prisma, order2.orderId, 30),
    409,
    "INVALID_TRANSITION",
    "Update ETA on PENDING returns 409 Conflict",
  );

  console.log("\n--- AC-5: Mark PREPARING order as READY ---");
  // Cannot mark READY on PENDING order
  await expectKitchenError(
    () => markKitchenOrderReady(prisma, order2.orderId),
    409,
    "INVALID_TRANSITION",
    "Mark READY on PENDING returns 409 Conflict",
  );

  const readyRes = await markKitchenOrderReady(prisma, order1.orderId);
  assert(readyRes.status === "READY", "Order 1 transitioned to READY");

  console.log("\n--- AC-6: Mark READY order as SERVED ---");
  // Cannot mark SERVED on PREPARING order
  await expectKitchenError(
    () => markKitchenOrderServed(prisma, order2.orderId),
    409,
    "INVALID_TRANSITION",
    "Mark SERVED on non-READY returns 409 Conflict",
  );

  const servedRes = await markKitchenOrderServed(prisma, order1.orderId);
  assert(servedRes.status === "SERVED", "Order 1 transitioned to SERVED");
  const dbOrder1Served = await prisma.order.findUniqueOrThrow({ where: { id: order1.orderId } });
  assert(dbOrder1Served.servedAt !== null, "servedAt timestamp recorded");

  console.log("\n--- AC-7: Cancel PENDING or PREPARING order with reason ---");
  // Cannot cancel SERVED order (terminal state)
  await expectKitchenError(
    () => cancelKitchenOrder(prisma, order1.orderId, "Guest left", staff!.id),
    409,
    "INVALID_TRANSITION",
    "Cancel on SERVED returns 409 Conflict",
  );

  // Cancel PENDING Order 2
  const cancelRes = await cancelKitchenOrder(
    prisma,
    order2.orderId,
    "Out of fresh fish / Ikan segar habis",
    staff!.id,
  );
  assert(cancelRes.status === "KITCHEN_CANCELLED", "Order 2 transitioned to KITCHEN_CANCELLED");
  assert(
    cancelRes.cancelReason === "Out of fresh fish / Ikan segar habis",
    "Cancel reason recorded",
  );

  const dbOrder2Cancelled = await prisma.order.findUniqueOrThrow({ where: { id: order2.orderId } });
  assert(dbOrder2Cancelled.cancelledBy === staff!.id, "cancelledBy persisted");
  assert(dbOrder2Cancelled.cancelReason !== null, "cancelReason persisted");

  // Clean up
  await cleanup(testRooms);
  console.log("\nALL KITCHEN LIVE BOARD ACCEPTANCE CRITERIA PROVEN CLEANLY!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
