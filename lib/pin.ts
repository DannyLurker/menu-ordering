// PIN hashing helpers (dev path; the auth slice owns production policy).
// Stored format: scrypt$salt$derivedKeyHex. Never store or log plain PINs.
// PIN format rules (6 digits) also belong to the auth slice, this module only
// hashes and compares whatever it is given.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPin(pin: string, salt?: string): string {
  const s = salt ?? randomBytes(16).toString("hex");
  const derived = scryptSync(pin, s, 64).toString("hex");
  return `scrypt$${s}$${derived}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const derived = scryptSync(pin, parts[1], 64).toString("hex");
  const expected = Buffer.from(parts[2], "hex");
  const actual = Buffer.from(derived, "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
