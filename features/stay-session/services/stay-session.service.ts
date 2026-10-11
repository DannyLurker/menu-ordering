// Guest stay session service (stay session slice). Mint, lock, and revoke
// rules live here. Data access goes through the repository, so routes stay
// thin and later slices (checkout, ordering) reuse these functions.
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { PrismaClient } from "@/generated/client";
import { mintStayKey, resetRateLimit } from "@/lib/rate-limit";
import {
  createStaySessionRow,
  findLiveSession,
  findSessionRow,
  findStayById,
  recordWrongPinAttempt,
  resetFailedPinCount,
  resetPinCounters,
  revokeExpiredSessions,
  revokeSessionsByTokenHash,
  revokeSessionsForStay,
  updatePinHash,
} from "../repositories/stay-session.repository";
import { hashPin, isScryptRow, verifyPin } from "../../../lib/pin";

export const STAY_COOKIE = "stay_session";
export const STAY_TOKEN_BYTES = 32;
export const STAY_MAX_DAYS = 30;
export const PIN_LOCK_THRESHOLD = 5;

/** Hotel local noon (WIB, UTC+7, no daylight saving) on the given date. */
export function checkoutExpiry(checkOut: Date, now = new Date()): Date {
  const noonUtc = new Date(
    Date.UTC(
      checkOut.getUTCFullYear(),
      checkOut.getUTCMonth(),
      checkOut.getUTCDate(),
      5,
      0,
      0,
    ),
  );
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
export function stayCoversToday(
  stay: { checkIn: Date; checkOut: Date },
  today = new Date(),
): boolean {
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

function liveReuseError(): StayAuthError {
  return new StayAuthError(
    409,
    "SESSION_LIVE",
    "This stay is already signed in on another device. Sign out there first, or ask the front desk for help.",
  );
}

export async function mintStaySession(
  db: PrismaClient,
  stayId: string,
  pin: string,
): Promise<StayMint> {
  const stay = await findStayById(db, stayId);
  if (!stay || !/^\d{6}$/.test(pin)) {
    throw new StayAuthError(401, "WRONG_PIN", "Wrong PIN. Try again.");
  }
  if (stay.status !== "ACTIVE" || !stayCoversToday(stay)) {
    throw new StayAuthError(
      403,
      "STAY_NOT_ACTIVE",
      "This stay cannot sign in. Please contact the front desk.",
    );
  }
  if (stay.pinLocked) {
    throw new StayAuthError(
      403,
      "STAY_LOCKED",
      "This stay is locked. Please contact the front desk.",
    );
  }
  const matched = await verifyPin(pin, stay.pinHash);
  if (!matched) {
    const attempts = stay.failedPinAttempts + 1;
    const locked = attempts >= PIN_LOCK_THRESHOLD;
    await recordWrongPinAttempt(db, stay.id, attempts, locked);
    if (locked) await revokeSessionsForStay(db, stay.id);
    throw new StayAuthError(
      401,
      locked ? "STAY_LOCKED" : "WRONG_PIN",
      locked
        ? "Too many wrong PINs. Please contact the front desk."
        : "Wrong PIN. Try again.",
    );
  }
  if (isScryptRow(stay.pinHash)) {
    // Lazy upgrade: the PIN proved itself against the old format, so the
    // row converges to bcrypt now with no staff action and no flag day.
    await updatePinHash(db, stay.id, await hashPin(pin));
  }
  const now = new Date();
  await resetFailedPinCount(db, stay.id);
  // Expired rows are dead history: revoke them so the live index only ever
  // sees the one row that matters. A still live row means 409 with a hint.
  await revokeExpiredSessions(db, stay.id, now);
  const live = await findLiveSession(db, stay.id, now);
  if (live) throw liveReuseError();
  const token = randomBytes(STAY_TOKEN_BYTES).toString("base64url");
  const expiresAt = checkoutExpiry(stay.checkOut, now);
  try {
    await createStaySessionRow(db, {
      stayId: stay.id,
      tokenHash: hashStayToken(token),
      expiresAt,
    });
  } catch {
    throw liveReuseError();
  }
  return { token, expiresAt };
}

/**
 * Lightweight peek for the mint route's throttle ordering: a locked or
 * inactive stay answers with its own message before any budget is spent.
 */
export async function peekStay(
  db: PrismaClient,
  stayId: string,
): Promise<{ pinLocked: boolean; status: string } | null> {
  return findStayById(db, stayId);
}

/** Desk or admin PIN unlock: clears the counter and lock, frees the mint
 * budget, and leaves the session revoked so the guest mints again. */
export async function unlockStay(db: PrismaClient, stayId: string): Promise<{ stayId: string }> {
  const stay = await findStayById(db, stayId);
  if (!stay) throw new StayAuthError(404, "UNKNOWN_STAY", "Unknown stay.");
  await resetPinCounters(db, stay.id);
  // Human verified recovery: the guest's next mint must not trip on the
  // brute force budget that caused the lock.
  resetRateLimit(mintStayKey(stay.id));
  return { stayId: stay.id };
}

/** Resolve a presented token to its stay id, or null when revoked/expired. */
export async function resolveStaySession(
  db: PrismaClient,
  token: string,
): Promise<string | null> {
  const row = await findSessionRow(db, hashStayToken(token));
  if (!row || row.revoked || row.expiresAt <= new Date()) return null;
  return row.stayId;
}

export async function revokeStaySession(db: PrismaClient, token: string): Promise<void> {
  await revokeSessionsByTokenHash(db, hashStayToken(token));
}

/** Checkout and PIN lock revoke at once (AC-6, AC-7). Later slices call this. */
export async function revokeStaySessionsForStay(db: PrismaClient, stayId: string): Promise<void> {
  await revokeSessionsForStay(db, stayId);
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
