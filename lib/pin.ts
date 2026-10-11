// PIN hashing on bcryptjs with scrypt compat (spec 0005). New PINs hash
// with bcryptjs async at cost 10. Stored rows branch on prefix: `scrypt$`
// rows check the old way, `$2b$` rows use the library compare, unknown
// prefixes fail closed. Never store or log plain PINs.
import { compare, hash } from "bcryptjs";
import { scryptSync, timingSafeEqual } from "node:crypto";

export const BCRYPT_COST = 10;
const SCRYPT_PREFIX = "scrypt$";
const SCRYPT_KEY_LEN = 64;

export function isScryptRow(stored: string): boolean {
  return stored.startsWith(SCRYPT_PREFIX);
}

export async function hashPin(pin: string): Promise<string> {
  if (!pin) throw new Error("A PIN is required to hash.");
  return hash(pin, BCRYPT_COST);
}

function verifyScrypt(pin: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = Buffer.from(parts[2], "hex");
    actual = Buffer.from(
      scryptSync(pin, parts[1], SCRYPT_KEY_LEN).toString("hex"),
      "hex",
    );
  } catch {
    return false;
  }
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  if (!pin || !stored) return false;
  if (isScryptRow(stored)) return verifyScrypt(pin, stored);
  try {
    return await compare(pin, stored);
  } catch {
    return false;
  }
}
