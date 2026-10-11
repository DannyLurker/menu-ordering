// Service tests for stay sessions with PIN hashing (scope feature 16,
// spec 0005). Mint, lockout, and the lazy scrypt to bcrypt
// upgrade run against the local database with throwaway stays, following
// the data model test precedent, and clean up after themselves.
// Needs local Postgres with migrations applied.
import { randomBytes, scryptSync } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/db";
import { hashPin } from "../../../lib/pin";
import {
  StayAuthError,
  mintStaySession,
  resolveStaySession,
  revokeStaySession,
} from "./stay-session.service";

const RUN = Date.now().toString(36);
const room = (tag: string): string => `T16-${RUN}-${tag}`;

function scryptRow(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(pin, salt, 64).toString("hex")}`;
}

async function makeStay(tag: string, pinHash: string, locked = false): Promise<string> {
  const now = new Date();
  const checkout = new Date(now);
  checkout.setDate(checkout.getDate() + 2);
  const stay = await prisma.stay.create({
    data: {
      roomNumber: room(tag),
      guestName: `T16 ${tag}`,
      checkIn: now,
      checkOut: checkout,
      status: "ACTIVE",
      pinHash,
      failedPinAttempts: 0,
      pinLocked: locked,
    },
  });
  return stay.id;
}

afterAll(async () => {
  const stays = await prisma.stay.findMany({ where: { roomNumber: { startsWith: `T16-${RUN}-` } } });
  const ids = stays.map((s) => s.id);
  if (ids.length > 0) {
    await prisma.staySession.deleteMany({ where: { stayId: { in: ids } } });
    await prisma.stay.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.$disconnect();
});

describe("mintStaySession lazy upgrade", () => {
  it("mints on a scrypt row and upgrades it to bcrypt, covers AC-2, AC-3", async () => {
    const id = await makeStay("upgrade", scryptRow("654321"));

    const minted = await mintStaySession(prisma, id, "654321");
    const row = await prisma.stay.findUnique({ where: { id } });

    expect(minted.token.length).toBeGreaterThan(0);
    expect(minted.expiresAt instanceof Date).toBe(true);
    expect(row?.pinHash.startsWith("$2b$")).toBe(true);
  });

  it("rejects a wrong PIN on a scrypt row without upgrading it, covers AC-2", async () => {
    const id = await makeStay("wrong", scryptRow("654321"));

    await expect(mintStaySession(prisma, id, "000000")).rejects.toMatchObject({ status: 401, code: "WRONG_PIN" });
    const row = await prisma.stay.findUnique({ where: { id } });

    expect(row?.pinHash.startsWith("scrypt$")).toBe(true);
    expect(row?.failedPinAttempts).toBe(1);
  });

  it("mints on a bcrypt row and resolves then revokes the session, covers AC-1, AC-4", async () => {
    const id = await makeStay("bcrypt", await hashPin("654321"));

    const minted = await mintStaySession(prisma, id, "654321");
    expect(await resolveStaySession(prisma, minted.token)).toBe(id);

    await revokeStaySession(prisma, minted.token);
    expect(await resolveStaySession(prisma, minted.token)).toBeNull();
  });

  it("refuses a locked stay without touching its hash, covers AC-4", async () => {
    const before = scryptRow("654321");
    const id = await makeStay("locked", before, true);

    await expect(mintStaySession(prisma, id, "654321")).rejects.toMatchObject({ status: 403 });
    const row = await prisma.stay.findUnique({ where: { id } });

    expect(row?.pinHash).toBe(before);
  });

  it("answers 401 for an unknown stay, covers AC-4", async () => {
    await expect(mintStaySession(prisma, "00000000-0000-0000-0000-000000000000", "654321")).rejects.toBeInstanceOf(
      StayAuthError,
    );
  });
});
