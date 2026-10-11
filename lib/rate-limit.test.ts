// Unit tests for the free rate limiter (specs 0001 AC PIN limiter split,
// 0004 AC-5). Budgets, check-before-record semantics, recovery reset, key
// shapes, and client IP parsing. Keys are unique per test because the
// module holds one shared in memory store.
import { describe, expect, it } from "vitest";
import {
  ORDER_IP_MAX,
  ORDER_STAY_MAX,
  PINSETUP_IP_MAX,
  PINSETUP_STAY_MAX,
  REISSUE_HOUR_MAX,
  clientIp,
  hitRateLimit,
  isRateLimited,
  mintIpKey,
  mintStayKey,
  orderIpKey,
  orderStayKey,
  pinSetupIpKey,
  pinSetupStayKey,
  rateLimitRetryAfter,
  rateLimitedResponse,
  reissueDeskKey,
  resetRateLimit,
  signInAccountKey,
  signInIpKey,
  takeBudget,
  takeHourBudget,
} from "./rate-limit";

describe("hitRateLimit", () => {
  it("allows hits up to budget then denies, covers AC-5", () => {
    const key = "t-rate-basic";

    for (let i = 0; i < 5; i += 1) {
      expect(hitRateLimit(key, 5).allowed).toBe(true);
    }

    const hitRate = hitRateLimit(key, 5).allowed;
    const hitRatetest = hitRateLimit(key, 5);

    console.log(hitRatetest);

    expect(hitRate).toBe(false);
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
    expect(signInAccountKey("Chef@Example.COM ")).toBe(
      signInAccountKey("chef@example.com"),
    );
    expect(signInAccountKey("a@b.co")).toBe("signin:acct:a@b.co");
  });

  it("namespaces each budget separately", () => {
    expect(signInIpKey("1.2.3.4")).toBe("signin:ip:1.2.3.4");
    expect(mintStayKey("stay-1")).toBe("mint:stay:stay-1");
    expect(mintIpKey("1.2.3.4")).toBe("mint:ip:1.2.3.4");
    expect(new Set([signInIpKey("x"), mintIpKey("x")]).size).toBe(2);
  });

  it("namespaces order create budgets per stay and IP, covers AC-7", () => {
    expect(ORDER_STAY_MAX).toBe(20);
    expect(ORDER_IP_MAX).toBe(60);
    expect(orderStayKey("stay-1")).toBe("order:stay:stay-1");
    expect(orderIpKey("1.2.3.4")).toBe("order:ip:1.2.3.4");
    expect(
      new Set([
        orderStayKey("x"),
        mintStayKey("x"),
        orderIpKey("x"),
        mintIpKey("x"),
      ]).size,
    ).toBe(4);
  });
});

describe("retryAfter and takeBudget", () => {
  it("reports zero under budget and seconds once spent, covers AC-6", () => {
    const key = "t-rate-retry";

    expect(rateLimitRetryAfter(key, 2)).toBe(0);
    expect(takeBudget(key, 2)).toEqual({ allowed: true, retryAfterSec: 0 });
    expect(takeBudget(key, 2)).toEqual({ allowed: true, retryAfterSec: 0 });

    const denied = takeBudget(key, 2);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
    expect(denied.retryAfterSec).toBeLessThanOrEqual(15 * 60);
    expect(rateLimitRetryAfter(key, 2)).toBe(denied.retryAfterSec);

    resetRateLimit(key);
    expect(rateLimitRetryAfter(key, 2)).toBe(0);
  });

  it("answers 429 with code plus retry seconds plus header, covers AC-6, AC-7", async () => {
    const res = rateLimitedResponse(42);
    const body = (await res.json()) as {
      error: { code: string; message: string; retryAfter: number };
    };

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.retryAfter).toBe(42);
    expect(body.error.message.length).toBeGreaterThan(0);
  });
});

describe("check in budgets", () => {
  it("namespaces PIN setup plus reissue budgets apart from mint, covers spec 0008 AC-7", () => {
    expect(PINSETUP_STAY_MAX).toBe(5);
    expect(PINSETUP_IP_MAX).toBe(20);
    expect(REISSUE_HOUR_MAX).toBe(20);
    expect(pinSetupStayKey("stay-1")).toBe("pinsetup:stay:stay-1");
    expect(pinSetupIpKey("1.2.3.4")).toBe("pinsetup:ip:1.2.3.4");
    expect(reissueDeskKey("stay-1")).toBe("reissue:stay:stay-1");
    expect(new Set([pinSetupStayKey("x"), mintStayKey("x"), orderStayKey("x")]).size).toBe(3);
  });

  it("spends the setup stay budget in five then denies with retry, covers spec 0008 AC-7", () => {
    const key = pinSetupStayKey(`t-pinsetup-${Date.now()}`);

    for (let i = 0; i < PINSETUP_STAY_MAX; i += 1) {
      expect(takeBudget(key, PINSETUP_STAY_MAX).allowed).toBe(true);
    }
    const denied = takeBudget(key, PINSETUP_STAY_MAX);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
  });

  it("holds the hourly reissue budget apart from the minute buckets, covers spec 0008 AC-6", () => {
    const key = reissueDeskKey(`t-reissue-${Date.now()}`);

    for (let i = 0; i < REISSUE_HOUR_MAX; i += 1) {
      expect(takeHourBudget(key, REISSUE_HOUR_MAX).allowed).toBe(true);
    }
    const denied = takeHourBudget(key, REISSUE_HOUR_MAX);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
    expect(denied.retryAfterSec).toBeLessThanOrEqual(60 * 60);
  });
});

describe("clientIp", () => {
  it("prefers the first forwarded address, then real ip, then unknown", () => {
    const forwarded = new Headers({
      "x-forwarded-for": "9.9.9.9, 1.1.1.1",
      "x-real-ip": "8.8.8.8",
    });

    expect(clientIp(forwarded)).toBe("9.9.9.9");
    expect(clientIp(new Headers({ "x-real-ip": " 8.8.8.8 " }))).toBe("8.8.8.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
