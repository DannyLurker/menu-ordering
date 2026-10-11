// Proof for spec 0009: runs the guest order with PIN verify how it works steps
// against the live database and checks every acceptance criterion.
// Run: cmd /c pnpm tsx scripts/prove-guest-order.ts
import "dotenv/config";
import { prisma } from "../lib/db";
import { createStay, setupStayPin } from "../features/stays";
import {
  OrderServiceError,
  clearOrderDedupCache,
  getStayOrders,
  placeOrder,
} from "../features/orders";

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function assert(cond: boolean, label: string): void {
  if (!cond) {
    throw new Error(`FAIL: ${label}`);
  }
  console.log(`ok: ${label}`);
}

async function expectOrderError(
  fn: () => Promise<unknown>,
  status: number,
  code: string,
  label: string,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    assert(err instanceof OrderServiceError, `${label} throws OrderServiceError`);
    assert((err as OrderServiceError).status === status, `${label} status ${status}`);
    assert((err as OrderServiceError).code === code, `${label} code ${code}`);
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
  const testRooms = ["901", "902"];
  await cleanup(testRooms);
  clearOrderDedupCache();

  const today = utcDay(new Date());
  const checkout = new Date(`${today}T00:00:00.000Z`);
  checkout.setUTCDate(checkout.getUTCDate() + 2);
  const checkoutDay = utcDay(checkout);

  // Setup: Desk creates stay for Room 901
  const created = await createStay(prisma, {
    roomNumber: "901",
    guestName: "Guest Nine",
    checkIn: today,
    checkOut: checkoutDay,
  });
  assert(Boolean(created.stayId), "desk created stay for room 901");

  // Setup: Guest activates PIN 839201
  const setupResult = await setupStayPin(
    prisma,
    created.stayId,
    created.setupCode,
    "839201",
    "839201",
  );
  assert(setupResult.ok, "guest sets PIN 839201");

  // Find a valid seeded menu item
  const nasgor = await prisma.menuItem.findFirst({
    where: { isAvailable: true },
  });
  assert(Boolean(nasgor), "seeded menu item exists");
  const menuItem = nasgor!;

  // 1. Happy path: guest places order with correct PIN
  const placed = await placeOrder(prisma, created.stayId, {
    pin: "839201",
    items: [{ menuItemId: menuItem.id, qty: 2 }],
    clientTotal: menuItem.price * 2,
  });
  assert(placed.status === "PENDING", "order placed with status PENDING (AC-3, AC-4)");
  assert(placed.totalAmount === menuItem.price * 2, "order total computed accurately (AC-3)");
  assert(placed.items.length === 1, "order items created in database transaction");

  // 2. Duplicate order protection: placing identical order immediately
  await expectOrderError(
    () =>
      placeOrder(prisma, created.stayId, {
        pin: "839201",
        items: [{ menuItemId: menuItem.id, qty: 2 }],
        clientTotal: menuItem.price * 2,
      }),
    409,
    "DUPLICATE_ORDER",
    "rapid duplicate order within 10 seconds rejected (AC-7)",
  );

  // Clear dedup for subsequent test cases
  clearOrderDedupCache();

  // 3. Price mismatch check: client total differs from database total
  await expectOrderError(
    () =>
      placeOrder(prisma, created.stayId, {
        pin: "839201",
        items: [{ menuItemId: menuItem.id, qty: 1 }],
        clientTotal: 1000, // Wrong client total
      }),
    409,
    "PRICE_MISMATCH",
    "price mismatch rejected (AC-3)",
  );

  // 4. Unavailable item check
  const unavailable = await prisma.menuItem.create({
    data: {
      categoryId: menuItem.categoryId,
      nameEn: "Temporary Soup",
      nameId: "Sup Sementara",
      price: 50000,
      isAvailable: false,
    },
  });

  await expectOrderError(
    () =>
      placeOrder(prisma, created.stayId, {
        pin: "839201",
        items: [{ menuItemId: unavailable.id, qty: 1 }],
        clientTotal: 50000,
      }),
    400,
    "ITEM_UNAVAILABLE",
    "unavailable menu item rejected (AC-9)",
  );

  await prisma.menuItem.delete({ where: { id: unavailable.id } });

  // 5. Wrong PIN tracking and lockout on 5 misses
  for (let attempt = 1; attempt <= 4; attempt++) {
    await expectOrderError(
      () =>
        placeOrder(prisma, created.stayId, {
          pin: "000000",
          items: [{ menuItemId: menuItem.id, qty: 1 }],
          clientTotal: menuItem.price,
        }),
      401,
      "WRONG_PIN",
      `wrong PIN attempt ${attempt} tracked (AC-5)`,
    );
  }

  // 5th wrong attempt locks the stay
  await expectOrderError(
    () =>
      placeOrder(prisma, created.stayId, {
        pin: "000000",
        items: [{ menuItemId: menuItem.id, qty: 1 }],
        clientTotal: menuItem.price,
      }),
      401,
      "STAY_LOCKED",
      "5th wrong PIN locks the stay (AC-5)",
  );

  // Subsequent attempt blocked with 403 STAY_LOCKED
  await expectOrderError(
    () =>
      placeOrder(prisma, created.stayId, {
        pin: "839201",
        items: [{ menuItemId: menuItem.id, qty: 1 }],
        clientTotal: menuItem.price,
      }),
      403,
      "STAY_LOCKED",
      "locked stay cannot order (AC-6)",
  );

  // 6. Query orders history
  const history = await getStayOrders(prisma, created.stayId);
  assert(history.length >= 1, "order history returned (AC-10)");
  assert(history[0].status === "PENDING", "first order status is PENDING (AC-10)");
  assert(history[0].totalAmount === menuItem.price * 2, "history order total computed (AC-10)");

  // Clean up test rows
  await cleanup(testRooms);
  console.log("\nAll guest order live database checks passed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
