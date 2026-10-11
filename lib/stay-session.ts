// Guest stay sessions (spec 0004). One live row per stay, bound to the
// stay cookie. Tokens are 32 random bytes; only the SHA256 hash is stored.
// PINs and tokens are never logged.
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { verifyPin } from "./pin";

export const STAY_COOKIE = "stay_session";
export const STAY_TOKEN_BYTES = 32;
export const STAY_MAX_DAYS = 30;
export const PIN_LOCK_THRESHOLD = 5;

/** Hotel local noon (WIB, UTC+7, no daylight saving) on the given date. */
export function checkoutExpiry(checkOut: Date, now = new Date()): Date {
  const noonUtc = new Date(Date.UTC(checkOut.getUTCFullYear(), checkOut.getUTCMonth(), checkOut.getUTCDate(), 5, 0, 0));
  const cap = new Date(now.getTime() + STAY_MAX_DAYS * 24 * 60 * 60 * 1000);
  return noonUtc < cap ? noonUtc : cap;
}

export function hashStayToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** A stay can mint while ACTIVE and covering today (spec 0002 validity). */
export function stayCoversToday(stay: { checkIn: Date; checkOut: Date }, today = new Date()): boolean {
  const day = utcDay(today);
  return utcDay(stay.checkIn) <= day && day <= utcDay(stay.checkOut);
}

export interface StayMint {
  token: string;
  expiresAt: Date;
}

export class StayAuthError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function mintStaySession(stayId: string, pin: string): Promise<StayMint> {
  const stay = await prisma.stay.findUnique({ where: { id: stayId } });
  if (!stay || !/^\d{6}$/.test(pin)) {
    throw new StayAuthError(401, "WRONG_PIN", "Wrong PIN. Try again.");
  }
  if (stay.status !== "ACTIVE" || !stayCoversToday(stay)) {
    throw new StayAuthError(403, "STAY_NOT_ACTIVE", "This stay cannot sign in. Please contact the front desk.");
  }
  if (stay.pinLocked) {
    throw new StayAuthError(403, "STAY_LOCKED", "This stay is locked. Please contact the front desk.");
  }
  if (!verifyPin(pin, stay.pinHash)) {
    const attempts = stay.failedPinAttempts + 1;
    const locked = attempts >= PIN_LOCK_THRESHOLD;
    await prisma.stay.update({
      where: { id: stay.id },
      data: { failedPinAttempts: attempts, pinLocked: locked },
    });
    if (locked) await revokeStaySessionsForStay(stay.id);
    throw new StayAuthError(
      401,
      locked ? "STAY_LOCKED" : "WRONG_PIN",
      locked ? "Too many wrong PINs. Please contact the front desk." : "Wrong PIN. Try again.",
    );
  }
  const now = new Date();
  await prisma.stay.update({
    where: { id: stay.id },
    data: { failedPinAttempts: 0 },
  });
  // Expired rows are dead history: revoke them so the live index only ever
  // sees the one row that matters. A still live row means 409 with a hint.
  await prisma.staySession.updateMany({
    where: { stayId: stay.id, revoked: false, expiresAt: { lte: now } },
    data: { revoked: true },
  });
  const live = await prisma.staySession.findFirst({
    where: { stayId: stay.id, revoked: false, expiresAt: { gt: now } },
  });
  if (live) {
    throw new StayAuthError(
      409,
      "SESSION_LIVE",
      "This stay is already signed in on another device. Sign out there first, or ask the front desk for help.",
    );
  }
  const token = randomBytes(STAY_TOKEN_BYTES).toString("base64url");
  const expiresAt = checkoutExpiry(stay.checkOut, now);
  try {
    await prisma.staySession.create({
      data: { stayId: stay.id, tokenHash: hashStayToken(token), expiresAt },
    });
  } catch {
    throw new StayAuthError(
      409,
      "SESSION_LIVE",
      "This stay is already signed in on another device. Sign out there first, or ask the front desk for help.",
    );
  }
  return { token, expiresAt };
}

/** Resolve a presented token to its stay id, or null when revoked/expired. */
export async function resolveStaySession(token: string): Promise<string | null> {
  const row = await prisma.staySession.findUnique({ where: { tokenHash: hashStayToken(token) } });
  if (!row || row.revoked || row.expiresAt <= new Date()) return null;
  return row.stayId;
}

export async function revokeStaySession(token: string): Promise<void> {
  await prisma.staySession.updateMany({
    where: { tokenHash: hashStayToken(token), revoked: false },
    data: { revoked: true },
  });
}

/** Checkout and PIN lock revoke at once (AC-6, AC-7). Later slices call this. */
export async function revokeStaySessionsForStay(stayId: string): Promise<void> {
  await prisma.staySession.updateMany({
    where: { stayId, revoked: false },
    data: { revoked: true },
  });
}

export function stayCookieOptions(expiresAt: Date): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  expires: Date;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  };
}

export async function readStayToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(STAY_COOKIE)?.value ?? null;
}
