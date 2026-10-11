// Stay session data access (stay session slice). Every Prisma call for
// stays and stay sessions lives here. The service owns the mint and lock
// rules, routes own HTTP.
import { prisma } from "@/lib/db";

export interface StayRow {
  id: string;
  status: string;
  checkIn: Date;
  checkOut: Date;
  pinHash: string;
  failedPinAttempts: number;
  pinLocked: boolean;
}

export async function findStayById(stayId: string): Promise<StayRow | null> {
  return prisma.stay.findUnique({ where: { id: stayId } });
}

export async function recordWrongPinAttempt(stayId: string, attempts: number, locked: boolean): Promise<void> {
  await prisma.stay.update({ where: { id: stayId }, data: { failedPinAttempts: attempts, pinLocked: locked } });
}

export async function resetPinCounters(stayId: string): Promise<void> {
  await prisma.stay.update({ where: { id: stayId }, data: { failedPinAttempts: 0, pinLocked: false } });
}

export async function updatePinHash(stayId: string, pinHash: string): Promise<void> {
  await prisma.stay.update({ where: { id: stayId }, data: { pinHash } });
}

export async function resetFailedPinCount(stayId: string): Promise<void> {
  await prisma.stay.update({ where: { id: stayId }, data: { failedPinAttempts: 0 } });
}

export async function revokeExpiredSessions(stayId: string, now: Date): Promise<void> {
  await prisma.staySession.updateMany({ where: { stayId, revoked: false, expiresAt: { lte: now } }, data: { revoked: true } });
}

export async function findLiveSession(stayId: string, now: Date): Promise<{ id: string } | null> {
  return prisma.staySession.findFirst({ where: { stayId, revoked: false, expiresAt: { gt: now } } });
}

export async function createStaySessionRow(input: { stayId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
  await prisma.staySession.create({ data: input });
}

export async function findSessionRow(tokenHash: string): Promise<{ stayId: string; revoked: boolean; expiresAt: Date } | null> {
  return prisma.staySession.findUnique({ where: { tokenHash } });
}

export async function revokeSessionsByTokenHash(tokenHash: string): Promise<void> {
  await prisma.staySession.updateMany({ where: { tokenHash, revoked: false }, data: { revoked: true } });
}

export async function revokeSessionsForStay(stayId: string): Promise<void> {
  await prisma.staySession.updateMany({ where: { stayId, revoked: false }, data: { revoked: true } });
}
