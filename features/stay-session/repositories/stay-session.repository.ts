// Stay session data access (stay session slice). Every Prisma call for
// stays and stay sessions lives here. The service owns the mint and lock
// rules, routes own HTTP.
// Scope rule 5: the Prisma instance is passed in, never imported here.
// Route handlers take it from `@/lib/db` and hand it to services, which
// hand it here, so tests can hand a mock instead of a live database.
import type { PrismaClient } from "@/generated/client";

export interface StayRow {
  id: string;
  status: string;
  checkIn: Date;
  checkOut: Date;
  pinHash: string;
  failedPinAttempts: number;
  pinLocked: boolean;
}

export async function findStayById(db: PrismaClient, stayId: string): Promise<StayRow | null> {
  return db.stay.findUnique({ where: { id: stayId } });
}

export async function recordWrongPinAttempt(
  db: PrismaClient,
  stayId: string,
  attempts: number,
  locked: boolean,
): Promise<void> {
  await db.stay.update({ where: { id: stayId }, data: { failedPinAttempts: attempts, pinLocked: locked } });
}

export async function resetPinCounters(db: PrismaClient, stayId: string): Promise<void> {
  await db.stay.update({ where: { id: stayId }, data: { failedPinAttempts: 0, pinLocked: false } });
}

export async function updatePinHash(db: PrismaClient, stayId: string, pinHash: string): Promise<void> {
  await db.stay.update({ where: { id: stayId }, data: { pinHash } });
}

export async function resetFailedPinCount(db: PrismaClient, stayId: string): Promise<void> {
  await db.stay.update({ where: { id: stayId }, data: { failedPinAttempts: 0 } });
}

export async function revokeExpiredSessions(db: PrismaClient, stayId: string, now: Date): Promise<void> {
  await db.staySession.updateMany({ where: { stayId, revoked: false, expiresAt: { lte: now } }, data: { revoked: true } });
}

export async function findLiveSession(
  db: PrismaClient,
  stayId: string,
  now: Date,
): Promise<{ id: string } | null> {
  return db.staySession.findFirst({ where: { stayId, revoked: false, expiresAt: { gt: now } } });
}

export async function createStaySessionRow(
  db: PrismaClient,
  input: { stayId: string; tokenHash: string; expiresAt: Date },
): Promise<void> {
  await db.staySession.create({ data: input });
}

export async function findSessionRow(
  db: PrismaClient,
  tokenHash: string,
): Promise<{ stayId: string; revoked: boolean; expiresAt: Date } | null> {
  return db.staySession.findUnique({ where: { tokenHash } });
}

export async function revokeSessionsByTokenHash(db: PrismaClient, tokenHash: string): Promise<void> {
  await db.staySession.updateMany({ where: { tokenHash, revoked: false }, data: { revoked: true } });
}

export async function revokeSessionsForStay(db: PrismaClient, stayId: string): Promise<void> {
  await db.staySession.updateMany({ where: { stayId, revoked: false }, data: { revoked: true } });
}
