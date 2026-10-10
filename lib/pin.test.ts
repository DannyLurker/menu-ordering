import { describe, expect, it } from "vitest";
import { hashPin, verifyPin } from "./pin";

describe("hashPin", () => {
  it("stores the PIN as a one way hash that never contains the plain PIN, covers AC-5", () => {
    const hashed = hashPin("246810");

    expect(hashed).not.toContain("246810");
    expect(hashed.startsWith("scrypt$")).toBe(true);
  });

  it("uses a fresh salt each time so the same PIN hashes differently, covers AC-5", () => {
    const first = hashPin("246810");
    const second = hashPin("246810");

    expect(first).not.toBe(second);
    expect(verifyPin("246810", first)).toBe(true);
    expect(verifyPin("246810", second)).toBe(true);
  });
});

describe("verifyPin", () => {
  it("verifies the correct PIN against its own stay hash only, covers AC-2", () => {
    const hashed = hashPin("135790");

    expect(verifyPin("135790", hashed)).toBe(true);
    expect(verifyPin("135791", hashed)).toBe(false);
  });

  it("rejects a wrong PIN on every one of five attempts while the right PIN still works, covers AC-2", () => {
    const hashed = hashPin("135790");

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(verifyPin("000000", hashed)).toBe(false);
    }
    expect(verifyPin("135790", hashed)).toBe(true);
  });

  it("never confuses two stays since a PIN verifies only against its own hash, covers AC-2", () => {
    const stayA = hashPin("111111");
    const stayB = hashPin("222222");

    expect(verifyPin("111111", stayB)).toBe(false);
    expect(verifyPin("222222", stayA)).toBe(false);
  });

  it("returns false for a malformed stored value instead of throwing, covers AC-5", () => {
    expect(verifyPin("123456", "")).toBe(false);
    expect(verifyPin("123456", "notahash")).toBe(false);
    expect(verifyPin("123456", "md5$salt$key")).toBe(false);
    expect(verifyPin("123456", "scrypt$onlytwoparts")).toBe(false);
  });
});
