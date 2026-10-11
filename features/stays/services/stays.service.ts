// Stay check in service (stay slice, spec 0008). Desk creates the stay,
// the guest sets a PIN with the one time setup code, desk reissues on loss.
// Data access goes through the repository, so routes stay thin.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@/generated/client";
import { hashPin } from "../../../lib/pin";
import {
  consumeSetupCode,
  createStayRow,
  findActiveStays,
  findGuestStay,
  findRecentStays,
  findStayForSetup,
  setSetupCode,
  type RecentStayRow,
} from "../repositories/stays.repository";

export const SETUP_TTL_MIN = 15;
export const SETUP_CODE_LEN = 8;
export const SETUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const IDEMPOTENCY_SEC = 10;
export const LIST_PAGE = 20;
export const STAY_MAX_NIGHTS = 30;
export const MAX_EXTRA_GUESTS = 5;

export class StayCheckinError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Room compare form: case and spacing never block or duplicate a room. */
export function normalizeRoom(roomNumber: string): string {
  return roomNumber.trim().replace(/\s+/g, " ").toUpperCase();
}

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Strict date only parse: YYYY-MM-DD means UTC midnight, nothing else. */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

/**
 * Stay date rules (spec 0008 AC-4): checkOut after checkIn, span within the
 * night cap, checkIn defaults to today, past checkIn allowed for today only.
 * Today is UTC day, the same truth the mint path uses.
 */
export function validateStayDates(
  checkInRaw: string | undefined,
  checkOutRaw: string,
  today = new Date(),
): { checkIn: Date; checkOut: Date } {
  const todayDay = utcDay(today);
  const checkIn = checkInRaw === undefined ? new Date(`${todayDay}T00:00:00.000Z`) : parseDateOnly(checkInRaw);
  const checkOut = parseDateOnly(checkOutRaw);
  if (!checkIn || !checkOut) {
    throw new StayCheckinError(400, "INVALID_DATES", "Give valid dates as YYYY-MM-DD. / Gunakan tanggal valid YYYY-MM-DD.");
  }
  if (utcDay(checkIn) < todayDay) {
    throw new StayCheckinError(
      400,
      "INVALID_DATES",
      "Check in cannot be in the past. / Tanggal masuk tidak boleh lampau.",
    );
  }
  if (checkOut <= checkIn) {
    throw new StayCheckinError(
      400,
      "INVALID_DATES",
      "Check out must be after check in. / Tanggal keluar harus setelah tanggal masuk.",
    );
  }
  const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
  if (nights > STAY_MAX_NIGHTS) {
    throw new StayCheckinError(
      400,
      "INVALID_DATES",
      `Stays run at most ${STAY_MAX_NIGHTS} nights. / Maksimal ${STAY_MAX_NIGHTS} malam.`,
    );
  }
  return { checkIn, checkOut };
}

/**
 * Weak PIN screen (spec 0008 AC-2): repeats, plus straight ascending or
 * descending runs across all six digits, never become a stay secret.
 */
export function isWeakPin(pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) return true;
  const digits = pin.split("").map(Number);
  if (digits.every((d) => d === digits[0])) return true;
  const ascending = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 1) % 10);
  const descending = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 9) % 10);
  return ascending || descending;
}

/** One time setup code: 8 chars, no confusing I O 0 1, from random bytes. */
export function generateSetupCode(): string {
  const bytes = randomBytes(SETUP_CODE_LEN);
  let code = "";
  for (const byte of bytes) {
    code += SETUP_ALPHABET[byte % SETUP_ALPHABET.length];
  }
  return code;
}

export function hashSetupCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Guest confirm display: first name plus last initial, full when one word. */
export function maskGuestName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

const SETUP_INVALID_MESSAGE =
  "This code is invalid or expired. Check it and try again, or ask the front desk. / Kode tidak valid atau kedaluwarsa. Periksa kembali atau hubungi resepsionis.";

export interface StayCreated {
  stayId: string;
  roomNumber: string;
  checkIn: Date;
  checkOut: Date;
  setupCode: string;
  setupExpiresAt: Date;
  duplicate: boolean;
}

export async function createStay(
  db: PrismaClient,
  input: { roomNumber: string; guestName: string; extraNames?: string[]; checkIn?: string; checkOut: string },
  now = new Date(),
): Promise<StayCreated> {
  const roomNumber = input.roomNumber.trim();
  const guestName = input.guestName.trim();
  const extraNames = (input.extraNames ?? []).map((name) => name.trim()).filter(Boolean);
  if (!roomNumber || !guestName) {
    throw new StayCheckinError(400, "INVALID_INPUT", "Room and guest name are required. / Nomor kamar dan nama tamu wajib diisi.");
  }
  if (extraNames.length > MAX_EXTRA_GUESTS) {
    throw new StayCheckinError(
      400,
      "INVALID_INPUT",
      `At most ${MAX_EXTRA_GUESTS} extra guests. / Maksimal ${MAX_EXTRA_GUESTS} tamu tambahan.`,
    );
  }
  const { checkIn, checkOut } = validateStayDates(input.checkIn, input.checkOut, now);
  const wanted = normalizeRoom(roomNumber);

  const active = await findActiveStays(db);

  // Double submit inside the idempotency window returns the first stay with
  // a fresh code (the old hash is overwritten, so only one code ever works).
  // This runs before the room clash check, or a retry would read as taken.
  const cutoff = new Date(now.getTime() - IDEMPOTENCY_SEC * 1000);
  const recent = active.find(
    (stay) =>
      normalizeRoom(stay.roomNumber) === wanted &&
      stay.checkIn.getTime() === checkIn.getTime() &&
      stay.checkOut.getTime() === checkOut.getTime() &&
      stay.guestName.trim() === guestName &&
      stay.createdAt > cutoff,
  );
  const setupCode = generateSetupCode();
  const setupExpiresAt = new Date(now.getTime() + SETUP_TTL_MIN * 60 * 1000);
  if (recent) {
    await setSetupCode(db, recent.id, hashSetupCode(setupCode), setupExpiresAt);
    console.log(`[stays] checkin.duplicate stay=${recent.id} room=${wanted}`);
    return { stayId: recent.id, roomNumber: recent.roomNumber, checkIn, checkOut, setupCode, setupExpiresAt, duplicate: true };
  }

  const clash = active.find((stay) => normalizeRoom(stay.roomNumber) === wanted);
  if (clash) {
    throw new StayCheckinError(
      409,
      "ROOM_TAKEN",
      `Room ${clash.roomNumber} is taken until ${utcDay(clash.checkOut)}. / Kamar ${clash.roomNumber} terisi hingga ${utcDay(clash.checkOut)}.`,
    );
  }

  // The temp PIN must never equal a choosable PIN: random bytes, hashed.
  const tempPin = randomBytes(32).toString("base64url");
  const { id } = await createStayRow(db, {
    roomNumber,
    guestName,
    checkIn,
    checkOut,
    pinHash: await hashPin(tempPin),
    setupHash: hashSetupCode(setupCode),
    setupExpiresAt,
    extraNames,
  });
  console.log(`[stays] checkin.created stay=${id} room=${wanted}`);
  return { stayId: id, roomNumber, checkIn, checkOut, setupCode, setupExpiresAt, duplicate: false };
}

export async function setupStayPin(
  db: PrismaClient,
  stayId: string,
  setupCode: string,
  newPin: string,
  confirmPin: string,
  now = new Date(),
): Promise<{ ok: true; pinSetAt: Date }> {
  if (newPin !== confirmPin) {
    throw new StayCheckinError(400, "PIN_MISMATCH", "PIN entries differ. Type the same PIN twice. / Entri PIN berbeda. Ketik PIN yang sama dua kali.");
  }
  if (isWeakPin(newPin)) {
    console.log(`[stays] pinsetup.fail stay=${stayId} reason=WEAK_PIN`);
    throw new StayCheckinError(
      400,
      "WEAK_PIN",
      "Pick a harder 6 digit PIN, not a repeat or sequence. / Pilih PIN 6 digit yang lebih sulit, bukan angka berulang atau berurutan.",
    );
  }
  const stay = await findStayForSetup(db, stayId);
  if (!stay) {
    console.log(`[stays] pinsetup.fail stay=unknown reason=SETUP_INVALID`);
    throw new StayCheckinError(400, "SETUP_INVALID", SETUP_INVALID_MESSAGE);
  }
  if (stay.pinLocked) {
    console.log(`[stays] pinsetup.fail stay=${stay.id} reason=STAY_LOCKED`);
    throw new StayCheckinError(423, "STAY_LOCKED", "This stay is locked. Please contact the front desk. / Data ini terkunci. Hubungi resepsionis.");
  }
  const presented = hashSetupCode(setupCode);
  if (!stay.setupHash || !stay.setupExpiresAt) {
    // Cleared after a real setup reads as used (410); a stay that never
    // held a code reads as invalid (400). Same message either way.
    const code = stay.pinSetAt ? 410 : 400;
    const name = stay.pinSetAt ? "SETUP_EXPIRED" : "SETUP_INVALID";
    console.log(`[stays] pinsetup.fail stay=${stay.id} reason=${name}`);
    throw new StayCheckinError(code, name, SETUP_INVALID_MESSAGE);
  }
  if (!sameHash(stay.setupHash, presented)) {
    console.log(`[stays] pinsetup.fail stay=${stay.id} reason=SETUP_INVALID`);
    throw new StayCheckinError(400, "SETUP_INVALID", SETUP_INVALID_MESSAGE);
  }
  if (stay.setupExpiresAt <= now) {
    console.log(`[stays] pinsetup.fail stay=${stay.id} reason=SETUP_EXPIRED`);
    throw new StayCheckinError(410, "SETUP_EXPIRED", SETUP_INVALID_MESSAGE);
  }
  const taken = await consumeSetupCode(db, stay.id, presented, now, await hashPin(newPin));
  if (taken !== 1) {
    console.log(`[stays] pinsetup.fail stay=${stay.id} reason=SETUP_RACE`);
    throw new StayCheckinError(410, "SETUP_EXPIRED", SETUP_INVALID_MESSAGE);
  }
  console.log(`[stays] pinsetup.ok stay=${stay.id}`);
  return { ok: true, pinSetAt: now };
}

export async function reissueSetupCode(
  db: PrismaClient,
  stayId: string,
  now = new Date(),
): Promise<{ stayId: string; setupCode: string; setupExpiresAt: Date }> {
  const stay = await findStayForSetup(db, stayId);
  if (!stay) throw new StayCheckinError(404, "UNKNOWN_STAY", "Unknown stay. / Data menginap tidak dikenal.");
  if (stay.status !== "ACTIVE") {
    throw new StayCheckinError(
      409,
      "STAY_NOT_ACTIVE",
      "This stay is not active, so no new code. / Data ini tidak aktif.",
    );
  }
  const setupCode = generateSetupCode();
  const setupExpiresAt = new Date(now.getTime() + SETUP_TTL_MIN * 60 * 1000);
  await setSetupCode(db, stay.id, hashSetupCode(setupCode), setupExpiresAt);
  console.log(`[stays] setup.reissued stay=${stay.id}`);
  return { stayId: stay.id, setupCode, setupExpiresAt };
}

export async function listRecentStays(db: PrismaClient, take = LIST_PAGE): Promise<RecentStayRow[]> {
  return findRecentStays(db, take);
}

/**
 * Guest confirm peek for the PIN setup screen: room plus masked name, or
 * null when the stay is unknown. Never returns secrets.
 */
export async function peekGuestStay(
  db: PrismaClient,
  stayId: string,
): Promise<{ stayId: string; roomNumber: string; maskedName: string } | null> {
  const stay = await findGuestStay(db, stayId);
  if (!stay) return null;
  return { stayId: stay.id, roomNumber: stay.roomNumber, maskedName: maskGuestName(stay.guestName) };
}
