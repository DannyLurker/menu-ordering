// Integration tests for the auth route wrapper budgets (spec 0007
// AC-6). The budget is pre spent through the real limiter, so the
// limited answer is reached before BetterAuth or the database are ever
// touched. Each test signs in under its own account id so budgets never
// bleed across tests.
import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({ get: () => undefined })),
}));

import { POST } from "./route";
import {
  SIGN_IN_ACCOUNT_MAX,
  hitRateLimit,
  resetRateLimit,
  signInAccountKey,
} from "@/lib/rate-limit";

function signInRequest(email: string): Request {
  return new Request("http://localhost/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "wrong-password-long-enough" }),
  });
}

interface ErrorBody {
  error: { code: string; message: string; retryAfter?: number };
}

describe("POST /api/auth/sign-in/email budgets", () => {
  it("answers 429 with code plus retry seconds plus header past budget, covers AC-6", async () => {
    const email = `prove-${randomUUID().slice(0, 8)}@example.com`;
    resetRateLimit(signInAccountKey(email));
    for (let i = 0; i < SIGN_IN_ACCOUNT_MAX; i += 1) {
      hitRateLimit(signInAccountKey(email), SIGN_IN_ACCOUNT_MAX);
    }

    const res = await POST(signInRequest(email) as never);
    const body = (await res.json()) as ErrorBody;

    expect(res.status).toBe(429);
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(typeof body.error.retryAfter).toBe("number");
    expect(body.error.retryAfter ?? 0).toBeGreaterThan(0);
    expect(res.headers.get("Retry-After")).toBe(String(body.error.retryAfter));
    resetRateLimit(signInAccountKey(email));
  });

  it("echoes no account id in the limited answer, covers AC-8", async () => {
    const email = `probe-${randomUUID().slice(0, 8)}@example.com`;
    resetRateLimit(signInAccountKey(email));
    for (let i = 0; i < SIGN_IN_ACCOUNT_MAX; i += 1) {
      hitRateLimit(signInAccountKey(email), SIGN_IN_ACCOUNT_MAX);
    }

    const res = await POST(signInRequest(email) as never);
    const raw = await res.text();

    expect(res.status).toBe(429);
    expect(raw).not.toContain(email);
    resetRateLimit(signInAccountKey(email));
  });
});
