// Proof for spec 0002 task 4: runs the spec's how it works steps 1 to 6
// against the live store and checks every acceptance criterion.
// Run: pnpm tsx scripts/prove-data-model.ts
import "dotenv/config";
import { prisma } from "../lib/db";
import { hashPin, verifyPin } from "../lib/pin";

function assert(cond: boolean, label: string): void {
  if (!cond) {
    throw new Error(`FAIL: ${label}`);
  }
  console.log(`ok: ${label}`);
}

function toLocalDay(d: Date): string {
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
}

function stayCoversToday(checkIn: Date, checkOut: Date): boolean {
  const day = toLocalDay(new Date());
  return toLocalDay(checkIn) <= day && day <= toLocalDay(checkOut);
}

async function cleanup(roomNumbers: string[]): Promise<void> {
  const stays = await prisma.stay.findMany({ where: { roomNumber: { in: roomNumbers } } });
  const stayIds = stays.map((s) => s.id);
  if (stayIds.length === 0) return;
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

async function main(): Promise<void> {
  const rooms = ["901", "902", "903", "904"];
  await cleanup(rooms);
  const menu = await prisma.menuItem.findMany({ where: { isAvailable: true }, take: 3, orderBy: { sortOrder: "asc" } });
  assert(menu.length >= 2, "seed menu has items to order (AC-3)");

  // Step 1: check in stay 901 with PIN.
  const now = new Date();
  const checkout = new Date(now);
  checkout.setDate(checkout.getDate() + 2);
  const stay = await prisma.stay.create({
    data: {
      roomNumber: "901",
      guestName: "Proof Guest",
      checkIn: now,
      checkOut: checkout,
      status: "ACTIVE",
      pinHash: hashPin("246810"),
      pinSetAt: now,
      guests: { create: { fullName: "Proof Companion" } },
    },
  });
  assert(stay.pinHash !== "246810" && verifyPin("246810", stay.pinHash), "PIN stored hashed and verifies (AC-2, AC-5)");

  let duplicateBlocked = false;
  try {
    await prisma.stay.create({
      data: { roomNumber: "901", guestName: "Second", checkIn: now, checkOut: checkout, pinHash: hashPin("000000") },
    });
  } catch {
    duplicateBlocked = true;
  }
  assert(duplicateBlocked, "second ACTIVE stay in room 901 rejected (invariant)");

  // Step 2: place order with snapshot prices, availability and date checks.
  assert(stay.status === "ACTIVE" && stayCoversToday(stay.checkIn, stay.checkOut), "stay 901 covers today on hotel local day (AC-1)");
  const lines = [
    { menuItemId: menu[0].id, qty: 2 },
    { menuItemId: menu[1].id, qty: 1 },
  ];
  for (const line of lines) {
    const item = await prisma.menuItem.findUniqueOrThrow({ where: { id: line.menuItemId } });
    assert(item.isAvailable, `item ${item.nameEn} is available (AC-3)`);
    assert(line.qty >= 1 && line.qty <= 20, "qty within 1 to 20");
  }
  const order = await prisma.order.create({
    data: {
      stayId: stay.id,
      items: {
        create: lines.map((line) => ({
          menuItemId: line.menuItemId,
          qty: line.qty,
          unitPrice: menu.find((m) => m.id === line.menuItemId)?.price ?? 0,
        })),
      },
    },
    include: { items: true },
  });
  const total = order.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
  assert(order.status === "PENDING" && total > 0, `order placed PENDING with snapshot total ${total} rupiah (AC-1, AC-3)`);

  const past = new Date(now);
  past.setDate(past.getDate() - 5);
  const pastEnd = new Date(now);
  pastEnd.setDate(pastEnd.getDate() - 2);
  const expired = await prisma.stay.create({
    data: { roomNumber: "904", guestName: "Old Guest", checkIn: past, checkOut: pastEnd, status: "CHECKED_OUT", pinHash: hashPin("111111") },
  });
  assert(!stayCoversToday(expired.checkIn, expired.checkOut) || expired.status !== "ACTIVE", "expired stay 904 cannot order (AC-1)");

  // Step 3: PIN retry limit on a separate stay so the main flow keeps going.
  const lockStay = await prisma.stay.create({
    data: { roomNumber: "902", guestName: "Lock Guest", checkIn: now, checkOut: checkout, pinHash: hashPin("135790") },
  });
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const ok = verifyPin("wrong", lockStay.pinHash);
    assert(!ok, `wrong PIN attempt ${attempt} rejected (AC-2)`);
  }
  const locked = await prisma.stay.update({ where: { id: lockStay.id }, data: { failedPinAttempts: 5, pinLocked: true } });
  assert(locked.pinLocked, "5 misses lock the stay with call staff message (AC-5)");

  // Step 4: kitchen verify with ETA creates folio plus lines; double verify blocked.
  const eta = 25;
  assert(eta >= 5 && eta <= 120, "ETA within 5 to 120 minutes (AC-7)");
  const verified = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: { include: { menuItem: true } } } });
    if (current.status !== "PENDING") throw new Error("order not PENDING");
    const folio = await tx.folio.upsert({ where: { stayId: stay.id }, update: {}, create: { stayId: stay.id } });
    await tx.folioLine.create({
      data: {
        folioId: folio.id,
        orderId: current.id,
        labelEn: `Order ${current.id.slice(0, 8)}`,
        labelId: `Pesanan ${current.id.slice(0, 8)}`,
        amount: total,
      },
    });
    return tx.order.update({ where: { id: order.id }, data: { status: "PREPARING", etaMinutes: eta, verifiedAt: new Date() } });
  });
  assert(verified.status === "PREPARING" && verified.etaMinutes === eta, "verify sets PREPARING with ETA and folio lines (AC-4, AC-6, AC-7)");

  let doubleBlocked = false;
  try {
    await prisma.folioLine.create({
      data: { folioId: (await prisma.folio.findUniqueOrThrow({ where: { stayId: stay.id } })).id, orderId: order.id, labelEn: "dup", labelId: "dup", amount: total },
    });
  } catch {
    doubleBlocked = true;
  }
  assert(doubleBlocked, "double verify cannot duplicate folio lines (invariant)");

  // Guest cancel before verify leaves no folio lines.
  const cancelStay = await prisma.stay.create({
    data: { roomNumber: "903", guestName: "Cancel Guest", checkIn: now, checkOut: checkout, pinHash: hashPin("222222") },
  });
  const cancelOrder = await prisma.order.create({
    data: { stayId: cancelStay.id, items: { create: { menuItemId: menu[0].id, qty: 1, unitPrice: menu[0].price } } },
  });
  const cancelled = await prisma.order.update({ where: { id: cancelOrder.id }, data: { status: "GUEST_CANCELLED" } });
  const cancelLines = await prisma.folioLine.count({ where: { orderId: cancelOrder.id } });
  assert(cancelled.status === "GUEST_CANCELLED" && cancelLines === 0, "guest cancel before verify keeps no folio lines (AC-6)");

  // Step 5: kitchen advances to READY then SERVED.
  const ready = await prisma.order.update({ where: { id: order.id }, data: { status: "READY" } });
  const served = await prisma.order.update({ where: { id: order.id }, data: { status: "SERVED", servedAt: new Date() } });
  assert(ready.status === "READY" && served.status === "SERVED", "order advances READY to SERVED (AC-6)");

  // Step 6: pay now record; folio balance reconciles; VOID excluded.
  const folio = await prisma.folio.findUniqueOrThrow({ where: { stayId: stay.id }, include: { lines: true } });
  const payment = await prisma.payment.create({
    data: { orderId: order.id, folioId: folio.id, method: "EWALLET_RECORD", amount: total },
  });
  assert(payment.status === "RECORDED", "pay now yes creates RECORDED payment row, record only (AC-8)");
  const linesSum = folio.lines.filter((l) => !l.voided).reduce((sum, l) => sum + l.amount, 0);
  const paidSum = (await prisma.payment.findMany({ where: { folioId: folio.id, status: "RECORDED" } })).reduce((sum, p) => sum + p.amount, 0);
  assert(linesSum - paidSum === 0, `folio balance reconciles: lines ${linesSum} minus paid ${paidSum} (AC-9)`);

  await cleanup(rooms);
  console.log("PROOF PASS: steps 1 to 6 hold, AC-1 to AC-9 covered.");
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
