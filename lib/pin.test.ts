import { randomBytes, scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BCRYPT_COST, hashPin, isScryptRow, verifyPin } from "./pin";

function scryptRow(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(pin, salt, 64).toString("hex")}`;
}

describe("hashPin", () => {
  it("stores the PIN as a bcrypt hash that never contains the plain PIN, covers AC-1, AC-5, AC-6", async () => {
    const hashed = await hashPin("246810");

    expect(hashed).not.toContain("246810");
    expect(hashed.startsWith("$2b$")).toBe(true);
  });

  it("uses cost 10 and a fresh salt each time, covers AC-1", async () => {
    const first = await hashPin("246810");
    const second = await hashPin("246810");

    expect(
      first.startsWith(`$2b$${String(BCRYPT_COST).padStart(2, "0")}$`),
    ).toBe(true);
    expect(first).not.toBe(second);
    expect(await verifyPin("246810", first)).toBe(true);
    expect(await verifyPin("246810", second)).toBe(true);
  });

  it("throws on an empty PIN instead of hashing nothing, covers AC-5", async () => {
    await expect(hashPin("")).rejects.toThrow();
  });
});

describe("verifyPin", () => {
  it("verifies the correct PIN against its own stay hash only, covers AC-1", async () => {
    const hashed = await hashPin("135790");

    expect(await verifyPin("135790", hashed)).toBe(true);
    expect(await verifyPin("135791", hashed)).toBe(false);
  });

  it("rejects a wrong PIN on every one of five attempts while the right PIN still works, covers AC-2", async () => {
    const hashed = await hashPin("135790");

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(await verifyPin("000000", hashed)).toBe(false);
    }
    expect(await verifyPin("135790", hashed)).toBe(true);
  });

  it("never confuses two stays since a PIN verifies only against its own hash, covers AC-1", async () => {
    const stayA = await hashPin("111111");
    const stayB = await hashPin("222222");

    expect(await verifyPin("111111", stayB)).toBe(false);
    expect(await verifyPin("222222", stayA)).toBe(false);
  });

  it("verifies an old scrypt row byte for byte as before, covers AC-2", async () => {
    const stored = scryptRow("135790");

    expect(await verifyPin("135790", stored)).toBe(true);
    expect(await verifyPin("135791", stored)).toBe(false);
  });

  it("returns false for a malformed stored value instead of throwing, covers AC-5", async () => {
    expect(await verifyPin("123456", "")).toBe(false);
    expect(await verifyPin("123456", "notahash")).toBe(false);
    expect(await verifyPin("123456", "md5$salt$key")).toBe(false);
    expect(await verifyPin("123456", "scrypt$onlytwoparts")).toBe(false);
  });
});

describe("isScryptRow", () => {
  it("spots old rows by prefix so verify branches correctly, covers AC-2, AC-3", async () => {
    expect(isScryptRow(scryptRow("135790"))).toBe(true);
    expect(isScryptRow(await hashPin("135790"))).toBe(false);
    expect(isScryptRow("")).toBe(false);
    expect(isScryptRow("notahash")).toBe(false);
  });
});
