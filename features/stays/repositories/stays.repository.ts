// Stay check in data access (stay slice). Every Prisma call for stay
// creation, PIN setup, and reissue lives here. The service owns the rules,
// routes own HTTP.
// Scope rule 5: the Prisma instance is passed in, never imported here.
import type { PrismaClient } from "@/generated/client";

export interface ActiveStayRow {
  id: string;
  roomNumber: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  createdAt: Date;
}

export interface SetupStayRow {
  id: string;
  status: string;
  pinLocked: boolean;
  pinSetAt: Date | null;
  setupHash: string | null;
  setupExpiresAt: Date | null;
}

export async function findActiveStays(db: PrismaClient): Promise<ActiveStayRow[]> {
  return db.stay.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, roomNumber: true, guestName: true, checkIn: true, checkOut: true, createdAt: true },
  });
}

export async function findStayForSetup(db: PrismaClient, stayId: string): Promise<SetupStayRow | null> {
  return db.stay.findUnique({
    where: { id: stayId },
    select: { id: true, status: true, pinLocked: true, pinSetAt: true, setupHash: true, setupExpiresAt: true },
  });
}

/** Public guest confirm read: room plus names only, never secrets. */
export async function findGuestStay(
  db: PrismaClient,
  stayId: string,
): Promise<{ id: string; roomNumber: string; guestName: string } | null> {
  return db.stay.findUnique({
    where: { id: stayId },
    select: { id: true, roomNumber: true, guestName: true },
  });
}

export async function createStayRow(
  db: PrismaClient,
  data: {
    roomNumber: string;
    guestName: string;
    checkIn: Date;
    checkOut: Date;
    pinHash: string;
    setupHash: string;
    setupExpiresAt: Date;
    extraNames: string[];
  },
): Promise<{ id: string }> {
  return db.stay.create({
    data: {
      roomNumber: data.roomNumber,
      guestName: data.guestName,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      status: "ACTIVE",
      pinHash: data.pinHash,
      setupHash: data.setupHash,
      setupExpiresAt: data.setupExpiresAt,
      guests: { create: data.extraNames.map((fullName) => ({ fullName })) },
    },
    select: { id: true },
  });
}

/**
 * Atomic compare and clear for PIN setup: exactly one concurrent caller
 * wins. Returns the number of rows that took the new PIN (0 or 1).
 */
export async function consumeSetupCode(
  db: PrismaClient,
  stayId: string,
  setupHash: string,
  now: Date,
  pinHash: string,
): Promise<number> {
  const result = await db.stay.updateMany({
    where: { id: stayId, setupHash, setupExpiresAt: { gt: now }, pinLocked: false },
    data: {
      pinHash,
      pinSetAt: now,
      setupHash: null,
      setupExpiresAt: null,
      failedPinAttempts: 0,
    },
  });
  return result.count;
}

export async function setSetupCode(
  db: PrismaClient,
  stayId: string,
  setupHash: string,
  setupExpiresAt: Date,
): Promise<void> {
  await db.stay.update({ where: { id: stayId }, data: { setupHash, setupExpiresAt } });
}

export interface RecentStayRow {
  id: string;
  roomNumber: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  status: string;
  pinSetAt: Date | null;
  createdAt: Date;
}

export async function findRecentStays(db: PrismaClient, take: number): Promise<RecentStayRow[]> {
  return db.stay.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      roomNumber: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      status: true,
      pinSetAt: true,
      createdAt: true,
    },
  });
}
