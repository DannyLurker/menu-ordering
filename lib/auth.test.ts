// Config level tests for the staff password hasher (spec 0006 AC-1).
// These pin that the BetterAuth password config writes and checks bcrypt
// rows, so creation and sign in agree by construction.
import { describe, expect, it } from "vitest";
import { STAFF_PASSWORD_COST, auth } from "./auth";

describe("staff password config", () => {
  it("hashes through bcryptjs at cost 10, covers AC-1", async () => {
    const ctx = await auth.$context;

    const hashed = await ctx.password.hash("Temp-Secret-12345");

    expect(hashed.startsWith(`$2b$${String(STAFF_PASSWORD_COST).padStart(2, "0")}$`)).toBe(true);
    expect(STAFF_PASSWORD_COST).toBe(10);
  });

  it("verifies the right secret and rejects the wrong one, covers AC-1", async () => {
    const ctx = await auth.$context;
    const hashed = await ctx.password.hash("Temp-Secret-12345");

    expect(await ctx.password.verify({ hash: hashed, password: "Temp-Secret-12345" })).toBe(true);
    expect(await ctx.password.verify({ hash: hashed, password: "Wrong-Secret-00000" })).toBe(false);
  });
});
