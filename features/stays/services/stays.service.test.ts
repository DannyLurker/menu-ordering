// Unit tests for stay check in helpers (scope feature 6, spec 0008).
// Pure functions only, no database: date rules, weak PIN screen, setup
// code shape, room compare form, and guest masking.
import { describe, expect, it, afterAll } from "vitest";
import { prisma } from "../../../lib/db";
import {
  StayCheckinError,
  createStay,
  generateSetupCode,
  hashSetupCode,
  isWeakPin,
  listRecentStays,
  maskGuestName,
  normalizeRoom,
  parseDateOnly,
  reissueSetupCode,
  setupStayPin,
  validateStayDates,
} from "./stays.service";

const TODAY = new Date("2026-10-11T03:00:00.000Z");

describe("normalizeRoom", () => {
  it("trims, collapses spaces, and uppercases, covers AC-3", () => {
    expect(normalizeRoom("  101a ")).toBe("101A");
    expect(normalizeRoom("101  A")).toBe("101 A");
    expect(normalizeRoom("101A")).toBe("101A");
  });
});

describe("parseDateOnly", () => {
  it("parses YYYY-MM-DD as UTC midnight, covers AC-4", () => {
    expect(parseDateOnly("2026-10-12")).toEqual(new Date("2026-10-12T00:00:00.000Z"));
  });

  it("rejects malformed and impossible dates, covers AC-4", () => {
    expect(parseDateOnly("12-10-2026")).toBeNull();
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("not-a-date")).toBeNull();
  });
});

describe("validateStayDates", () => {
  it("accepts a same day start with a later checkout, covers AC-4", () => {
    const { checkIn, checkOut } = validateStayDates("2026-10-11", "2026-10-13", TODAY);
    expect(checkIn).toEqual(new Date("2026-10-11T00:00:00.000Z"));
    expect(checkOut).toEqual(new Date("2026-10-13T00:00:00.000Z"));
  });

  it("defaults a missing check in to today, covers AC-4", () => {
    const { checkIn } = validateStayDates(undefined, "2026-10-12", TODAY);
    expect(checkIn).toEqual(new Date("2026-10-11T00:00:00.000Z"));
  });

  it("rejects checkout on or before checkin, covers AC-4", () => {
    expect(() => validateStayDates("2026-10-12", "2026-10-12", TODAY)).toThrow(StayCheckinError);
    expect(() => validateStayDates("2026-10-13", "2026-10-12", TODAY)).toThrow(StayCheckinError);
  });

  it("rejects past checkin and spans over the night cap, covers AC-4", () => {
    expect(() => validateStayDates("2026-10-10", "2026-10-12", TODAY)).toThrow(StayCheckinError);
    expect(() => validateStayDates("2026-10-11", "2026-11-12", TODAY)).toThrow(StayCheckinError);
  });

  it("accepts exactly the 30 night cap, covers AC-4", () => {
    const { checkOut } = validateStayDates("2026-10-11", "2026-11-10", TODAY);
    expect(checkOut).toEqual(new Date("2026-11-10T00:00:00.000Z"));
  });
});

describe("isWeakPin", () => {
  it("blocks repeats and straight runs, covers AC-2", () => {
    expect(isWeakPin("000000")).toBe(true);
    expect(isWeakPin("777777")).toBe(true);
    expect(isWeakPin("123456")).toBe(true);
    expect(isWeakPin("654321")).toBe(true);
    expect(isWeakPin("012345")).toBe(true);
    expect(isWeakPin("987654")).toBe(true);
  });

  it("accepts non patterned codes and rejects bad shapes, covers AC-2", () => {
    expect(isWeakPin("482916")).toBe(false);
    expect(isWeakPin("102938")).toBe(false);
    expect(isWeakPin("12345")).toBe(true);
    expect(isWeakPin("abcdef")).toBe(true);
  });
});

describe("generateSetupCode", () => {
  it("makes 8 chars from the plain alphabet, covers AC-1", () => {
    for (let i = 0; i < 25; i += 1) {
      const code = generateSetupCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    }
    expect(generateSetupCode()).not.toBe(generateSetupCode());
  });

  it("hashes case insensitively to 64 hex chars, covers AC-2", () => {
    expect(hashSetupCode("abcdefgh")).toBe(hashSetupCode("ABCDEFGH"));
    expect(hashSetupCode("ABCDEFGH")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("maskGuestName", () => {
  it("shows first name plus last initial, full when one word, covers AC-8", () => {
    expect(maskGuestName("Budi Santoso")).toBe("Budi S.");
    expect(maskGuestName("Budi")).toBe("Budi");
    expect(maskGuestName("  Siti  Ayu  Lestari ")).toBe("Siti L.");
  });
});

const RUN = Date.now().toString(36);
const room = (tag: string): string => `VT-${RUN}-${tag}`;

function checkoutDay(nightsAhead = 2): string {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + nightsAhead);
  return day.toISOString().slice(0, 10);
}

async function cleanup(): Promise<void> {
  const stays = await prisma.stay.findMany({ where: { roomNumber: { startsWith: `VT-${RUN}-` } } });
  const ids = stays.map((s) => s.id);
  if (ids.length === 0) return;
  await prisma.staySession.deleteMany({ where: { stayId: { in: ids } } });
  await prisma.guest.deleteMany({ where: { stayId: { in: ids } } });
  await prisma.stay.deleteMany({ where: { id: { in: ids } } });
}

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("createStay orchestration", () => {
  it("creates the stay with guests and a one time code, covers AC-1", async () => {
    const created = await createStay(prisma, {
      roomNumber: room("a"),
      guestName: "Orch Guest",
      extraNames: ["Orch Plus"],
      checkOut: checkoutDay(),
    });

    expect(created.duplicate).toBe(false);
    expect(created.setupCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    const row = await prisma.stay.findUnique({ where: { id: created.stayId } });
    expect(row?.pinSetAt).toBeNull();
    expect(row?.pinHash.startsWith("$2b$")).toBe(true);
    expect(row?.setupHash).toHaveLength(64);
    const guests = await prisma.guest.findMany({ where: { stayId: created.stayId } });
    expect(guests.map((g) => g.fullName)).toEqual(["Orch Plus"]);
  });

  it("returns the first stay with a rotated code on double submit, covers AC-1", async () => {
    const input = { roomNumber: room("b"), guestName: "Double Guest", checkOut: checkoutDay() };
    const first = await createStay(prisma, input);
    const second = await createStay(prisma, { roomNumber: ` ${first.roomNumber.toLowerCase()} `, guestName: "Double Guest", checkOut: checkoutDay() });

    expect(second.stayId).toBe(first.stayId);
    expect(second.duplicate).toBe(true);
    expect(second.setupCode).not.toBe(first.setupCode);
  });

  it("blocks a second live stay on the room with the checkout day, covers AC-3", async () => {
    const first = await createStay(prisma, { roomNumber: room("c"), guestName: "First Guest", checkOut: checkoutDay() });

    await expect(
      createStay(prisma, { roomNumber: first.roomNumber, guestName: "Clash Guest", checkIn: checkoutDay(), checkOut: checkoutDay(4) }),
    ).rejects.toMatchObject({ status: 409, code: "ROOM_TAKEN" });
  });

  it("lists recent stays newest first, covers AC-8", async () => {
    const first = await createStay(prisma, { roomNumber: room("d1"), guestName: "List One", checkOut: checkoutDay() });
    const second = await createStay(prisma, { roomNumber: room("d2"), guestName: "List Two", checkOut: checkoutDay() });

    const rows = await listRecentStays(prisma, 50);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(first.stayId);
    expect(ids).toContain(second.stayId);
    expect(ids.indexOf(second.stayId)).toBeLessThan(ids.indexOf(first.stayId));
  });
});

describe("setupStayPin orchestration", () => {
  it("sets the PIN and clears the code atomically, covers AC-2", async () => {
    const created = await createStay(prisma, { roomNumber: room("e"), guestName: "Pin Guest", checkOut: checkoutDay() });

    const result = await setupStayPin(prisma, created.stayId, created.setupCode, "482916", "482916");
    expect(result.ok).toBe(true);
    const row = await prisma.stay.findUnique({ where: { id: created.stayId } });
    expect(row?.pinSetAt instanceof Date).toBe(true);
    expect(row?.pinHash.startsWith("$2b$")).toBe(true);
    expect(row?.setupHash).toBeNull();
  });

  it("answers 410 on a consumed code and 400 on a foreign code, covers AC-2", async () => {
    const created = await createStay(prisma, { roomNumber: room("f"), guestName: "Reuse Guest", checkOut: checkoutDay() });
    await setupStayPin(prisma, created.stayId, created.setupCode, "482916", "482916");

    await expect(setupStayPin(prisma, created.stayId, created.setupCode, "482916", "482916")).rejects.toMatchObject({
      status: 410,
      code: "SETUP_EXPIRED",
    });
    await expect(setupStayPin(prisma, created.stayId, "ZZZZZZZZ", "482916", "482916")).rejects.toMatchObject({
      status: 410,
      code: "SETUP_EXPIRED",
    });
  });

  it("answers 423 on a locked stay and 410 past expiry, covers AC-2", async () => {
    const locked = await createStay(prisma, { roomNumber: room("g"), guestName: "Locked Guest", checkOut: checkoutDay() });
    await prisma.stay.update({ where: { id: locked.stayId }, data: { pinLocked: true } });
    await expect(setupStayPin(prisma, locked.stayId, locked.setupCode, "482916", "482916")).rejects.toMatchObject({
      status: 423,
      code: "STAY_LOCKED",
    });

    const stale = await createStay(prisma, { roomNumber: room("h"), guestName: "Stale Guest", checkOut: checkoutDay() });
    await prisma.stay.update({ where: { id: stale.stayId }, data: { setupExpiresAt: new Date("2020-01-01T00:00:00.000Z") } });
    await expect(setupStayPin(prisma, stale.stayId, stale.setupCode, "482916", "482916")).rejects.toMatchObject({
      status: 410,
      code: "SETUP_EXPIRED",
    });
  });
});

describe("reissueSetupCode orchestration", () => {
  it("rotates the code and kills the old one, covers AC-6", async () => {
    const created = await createStay(prisma, { roomNumber: room("i"), guestName: "Reissue Guest", checkOut: checkoutDay() });
    const reissued = await reissueSetupCode(prisma, created.stayId);

    expect(reissued.setupCode).not.toBe(created.setupCode);
    await expect(setupStayPin(prisma, created.stayId, created.setupCode, "482916", "482916")).rejects.toMatchObject({
      status: 400,
      code: "SETUP_INVALID",
    });
    const done = await setupStayPin(prisma, created.stayId, reissued.setupCode, "482916", "482916");
    expect(done.ok).toBe(true);
  });

  it("answers 404 unknown and 409 inactive, covers AC-6", async () => {
    await expect(reissueSetupCode(prisma, "missing-stay")).rejects.toMatchObject({ status: 404, code: "UNKNOWN_STAY" });
    const created = await createStay(prisma, { roomNumber: room("j"), guestName: "Gone Guest", checkOut: checkoutDay() });
    await prisma.stay.update({ where: { id: created.stayId }, data: { status: "CHECKED_OUT" } });
    await expect(reissueSetupCode(prisma, created.stayId)).rejects.toMatchObject({ status: 409, code: "STAY_NOT_ACTIVE" });
  });
});
