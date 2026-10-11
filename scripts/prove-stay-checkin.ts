// Proof for spec 0008: runs the stay check in how it works steps against
// the live store and checks every acceptance criterion.
// Run: pnpm tsx scripts/prove-stay-checkin.ts
import "dotenv/config";
import { prisma } from "../lib/db";
import { isStayOrderable, mintStaySession } from "../features/stay-session";
import {
  StayCheckinError,
  createStay,
  reissueSetupCode,
  setupStayPin,
} from "../features/stays";

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function assert(cond: boolean, label: string): void {
  if (!cond) {
    throw new Error(`FAIL: ${label}`);
  }
  console.log(`ok: ${label}`);
}

async function expectCheckinError(
  fn: () => Promise<unknown>,
  status: number,
  code: string,
  label: string,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    assert(err instanceof StayCheckinError, `${label} throws StayCheckinError`);
    assert((err as StayCheckinError).status === status, `${label} status ${status}`);
    assert((err as StayCheckinError).code === code, `${label} code ${code}`);
    return;
  }
  throw new Error(`FAIL: ${label} did not throw`);
}

async function cleanup(roomNumbers: string[]): Promise<void> {
  const stays = await prisma.stay.findMany({ where: { roomNumber: { in: roomNumbers } } });
  const stayIds = stays.map((s) => s.id);
  if (stayIds.length === 0) return;
  await prisma.staySession.deleteMany({ where: { stayId: { in: stayIds } } });
  await prisma.guest.deleteMany({ where: { stayId: { in: stayIds } } });
  await prisma.stay.deleteMany({ where: { id: { in: stayIds } } });
}

async function main(): Promise<void> {
  const rooms = ["801", "802", "803"];
  await cleanup(rooms);
  const today = utcDay(new Date());
  const checkout = new Date(`${today}T00:00:00.000Z`);
  checkout.setUTCDate(checkout.getUTCDate() + 2);
  const checkoutDay = utcDay(checkout);

  // Step 1: desk creates stay 801 with two extra guests.
  const created = await createStay(prisma, {
    roomNumber: "801",
    guestName: "Prove Guest",
    extraNames: ["Prove Plus One", "Prove Plus Two"],
    checkOut: checkoutDay,
  });
  assert(created.stayId.length > 0, "create returns a stay id (AC-1)");
  assert(created.setupCode.length === 8, "create returns the plain setup code once (AC-1)");
  assert(created.duplicate === false, "first create is not a duplicate (AC-1)");
  const guests = await prisma.guest.findMany({ where: { stayId: created.stayId } });
  assert(guests.length === 2, "extra names land as guest rows (AC-1)");

  // Step 2: double submit inside the window returns the first stay.
  const twice = await createStay(prisma, {
    roomNumber: " 801 ",
    guestName: "Prove Guest",
    checkOut: checkoutDay,
  });
  assert(twice.stayId === created.stayId, "double submit returns the first stay (AC-1)");
  assert(twice.duplicate === true, "double submit flags duplicate (AC-1)");
  assert(twice.setupCode !== created.setupCode, "double submit rotates the code (AC-1)");

  // Step 3: a second live stay on room 801 is blocked with the checkout day.
  const clashOut = new Date(`${checkoutDay}T00:00:00.000Z`);
  clashOut.setUTCDate(clashOut.getUTCDate() + 2);
  await expectCheckinError(
    () =>
      createStay(prisma, {
        roomNumber: "801",
        guestName: "Someone Else",
        checkIn: checkoutDay,
        checkOut: utcDay(clashOut),
      }),
    409,
    "ROOM_TAKEN",
    "second live stay on the room is blocked (AC-3)",
  );

  // Step 4: date rules hold.
  await expectCheckinError(
    () => createStay(prisma, { roomNumber: "802", guestName: "Date Guest", checkOut: today }),
    400,
    "INVALID_DATES",
    "checkout on checkin day is rejected (AC-4)",
  );
  await expectCheckinError(
    () => createStay(prisma, { roomNumber: "802", guestName: "Date Guest", checkIn: "2020-01-01", checkOut: today }),
    400,
    "INVALID_DATES",
    "past checkin is rejected (AC-4)",
  );

  // Step 5: guest sets the PIN with the latest code, then it is single use.
  const pin = "482916";
  const setup = await setupStayPin(prisma, created.stayId, twice.setupCode, pin, pin);
  assert(setup.ok === true, "guest sets the PIN with the setup code (AC-2)");
  const row = await prisma.stay.findUnique({ where: { id: created.stayId } });
  assert(row?.pinSetAt instanceof Date, "pinSetAt is stamped (AC-2)");
  assert(row?.pinHash.startsWith("$2b$") === true, "PIN is stored bcrypt (AC-2)");
  assert(row?.setupHash === null, "setup hash is cleared on use (AC-2)");
  await expectCheckinError(
    () => setupStayPin(prisma, created.stayId, twice.setupCode, pin, pin),
    410,
    "SETUP_EXPIRED",
    "a used code answers 410 (AC-2)",
  );

  // Step 6: weak and mismatched PINs are rejected on a fresh stay.
  const weak = await createStay(prisma, { roomNumber: "802", guestName: "Weak Guest", checkOut: checkoutDay });
  await expectCheckinError(
    () => setupStayPin(prisma, weak.stayId, weak.setupCode, "123456", "123456"),
    400,
    "WEAK_PIN",
    "sequence PIN is rejected (AC-2)",
  );
  await expectCheckinError(
    () => setupStayPin(prisma, weak.stayId, weak.setupCode, pin, "000002"),
    400,
    "PIN_MISMATCH",
    "mismatched confirm is rejected (AC-2)",
  );
  await expectCheckinError(
    () => setupStayPin(prisma, "missing-stay", "ABCDEFGH", pin, pin),
    400,
    "SETUP_INVALID",
    "unknown stay answers uniform invalid (AC-2)",
  );

  // Step 7: desk reissues a fresh code for a live stay.
  const reissued = await reissueSetupCode(prisma, weak.stayId);
  assert(reissued.setupCode.length === 8, "reissue returns a fresh code (AC-6)");
  assert(reissued.setupCode !== weak.setupCode, "reissue rotates the code (AC-6)");
  await expectCheckinError(
    () => setupStayPin(prisma, weak.stayId, weak.setupCode, pin, pin),
    400,
    "SETUP_INVALID",
    "the old code stops working after reissue (AC-6)",
  );
  await setupStayPin(prisma, weak.stayId, reissued.setupCode, pin, pin);
  assert(true, "the reissued code sets the PIN (AC-6)");

  // Step 8: the shared orderable check gates mint for expired stays.
  const expired = await createStay(prisma, { roomNumber: "803", guestName: "Gone Guest", checkOut: checkoutDay });
  await prisma.stay.update({ where: { id: expired.stayId }, data: { status: "CHECKED_OUT" } });
  const live = await prisma.stay.findUnique({ where: { id: expired.stayId } });
  assert(isStayOrderable(live!) === false, "checked out stay is not orderable (AC-5)");
  const current = await prisma.stay.findUnique({ where: { id: created.stayId } });
  assert(isStayOrderable(current!) === true, "live stay is orderable (AC-5)");
  try {
    await mintStaySession(prisma, expired.stayId, pin);
    throw new Error("FAIL: expired stay minted (AC-5)");
  } catch (err) {
    assert(err instanceof Error && (err as { status?: number }).status === 403, "expired stay mint is blocked 403 (AC-5)");
  }

  await cleanup(rooms);
  console.log("PROOF PASS: stay check in steps 1 to 8 hold, AC-1 to AC-6 covered.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
