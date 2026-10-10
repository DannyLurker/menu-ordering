import { describe, expect, it, vi } from "vitest";
import { prisma } from "./db";

describe("prisma client", () => {
  it("exposes every data model table the slices build on", () => {
    const delegates = [
      "stay",
      "guest",
      "menuCategory",
      "menuItem",
      "order",
      "orderItem",
      "folio",
      "folioLine",
      "payment",
    ] as const;

    for (const delegate of delegates) {
      expect(prisma[delegate]).toBeDefined();
    }
  });

  it("returns the same instance on repeat import so the app shares one pool", async () => {
    const again = (await import("./db")).prisma;

    expect(again).toBe(prisma);
  });

  it("fails fast with a clear message when DATABASE_URL is missing", async () => {
    const shared = globalThis as unknown as { prisma?: unknown };
    const saved = shared.prisma;
    delete shared.prisma;
    vi.stubEnv("DATABASE_URL", "");
    vi.resetModules();
    try {
      await expect(import("./db")).rejects.toThrow(/DATABASE_URL/);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
      if (saved !== undefined) shared.prisma = saved;
    }
  });
});
