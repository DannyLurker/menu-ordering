// Unit tests for the free rate limiter (specs 0001 AC PIN limiter split,
// 0004 AC-5). Budgets, check-before-record semantics, recovery reset, key
// shapes, and client IP parsing. Keys are unique per test because the
// module holds one shared in memory store.
import { describe, expect, it } from "vitest";
import {
  clientIp,
  hitRateLimit,
  isRateLimited,
  mintIpKey,
  mintStayKey,
  resetRateLimit,
  signInAccountKey,
  signInIpKey,
} from "./rate-limit";

describe("hitRateLimit", () => {
  it("allows hits up to budget then denies, covers AC-5", () => {
    const key = "t-rate-basic";

    for (let i = 0; i < 5; i += 1) {
      expect(hitRateLimit(key, 5).allowed).toBe(true);
    }
    expect(hitRateLimit(key, 5).allowed).toBe(false);
  });

  it("checks without recording so probes never spend budget, covers AC-5", () => {
    const key = "t-rate-probe";

    expect(isRateLimited(key, 1)).toBe(false);
    expect(isRateLimited(key, 1)).toBe(false);
    expect(hitRateLimit(key, 1).allowed).toBe(true);
    expect(isRateLimited(key, 1)).toBe(true);
  });

  it("resets one key on human verified recovery without touching others, covers AC-5, AC-7", () => {
    const locked = "t-rate-reset-a";
    const other = "t-rate-reset-b";

    hitRateLimit(locked, 1);
    hitRateLimit(other, 1);
    expect(isRateLimited(locked, 1)).toBe(true);

    resetRateLimit(locked);

    expect(isRateLimited(locked, 1)).toBe(false);
    expect(isRateLimited(other, 1)).toBe(true);
  });
});

describe("key builders", () => {
  it("normalises account keys so case and padding share one budget", () => {
    expect(signInAccountKey("Chef@Example.COM ")).toBe(signInAccountKey("chef@example.com"));
    expect(signInAccountKey("a@b.co")).toBe("signin:acct:a@b.co");
  });

  it("namespaces each budget separately", () => {
    expect(signInIpKey("1.2.3.4")).toBe("signin:ip:1.2.3.4");
    expect(mintStayKey("stay-1")).toBe("mint:stay:stay-1");
    expect(mintIpKey("1.2.3.4")).toBe("mint:ip:1.2.3.4");
    expect(new Set([signInIpKey("x"), mintIpKey("x")]).size).toBe(2);
  });
});

describe("clientIp", () => {
  it("prefers the first forwarded address, then real ip, then unknown", () => {
    const forwarded = new Headers({ "x-forwarded-for": "9.9.9.9, 1.1.1.1", "x-real-ip": "8.8.8.8" });

    expect(clientIp(forwarded)).toBe("9.9.9.9");
    expect(clientIp(new Headers({ "x-real-ip": " 8.8.8.8 " }))).toBe("8.8.8.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
