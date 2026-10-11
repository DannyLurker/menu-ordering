// Integration tests for the stay mint route budgets (spec 0007 AC-6,
// AC-8). The handler runs for real with the real LRU limiter; only the
// database is stubbed at the boundary (unknown stays, so no durable
// counter is ever touched). Each test mints under its own stay id so
// budgets never bleed across tests.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({ get: () => undefined })),
}));

vi.mock("@/lib/db", () => ({
  prisma: { stay: { findUnique: vi.fn(async () => null) } },
}));

import { POST } from "./route";
import { resetRateLimit } from "@/lib/rate-limit";

function mintRequest(stayId: string, pin = "000000"): Request {
  return new Request("http://localhost/api/stay-session/mint", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ stayId, pin }),
  });
}

interface ErrorBody {
  error: { code: string; message: string; retryAfter?: number };
}

beforeEach(() => {
  resetRateLimit("mint:stay:probe-never-used");
});

describe("POST /api/stay-session/mint budgets", () => {
  it("answers 422 on a bad body before spending budget", async () => {
    const res = await POST(
      new Request("http://localhost/api/stay-session/mint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin: "1" }),
      }) as never,
    );
    const body = (await res.json()) as ErrorBody;

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("INVALID_INPUT");
  });

  it("answers 401 for an unknown stay with no lock message", async () => {
    const res = await POST(mintRequest(randomUUID()) as never);
    const body = (await res.json()) as ErrorBody;

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("WRONG_PIN");
  });

  it("answers 429 with code plus retry seconds plus header past budget, covers AC-6", async () => {
    const stayId = randomUUID();
    let last: Response | null = null;
    for (let i = 0; i < 6; i += 1) {
      last = await POST(mintRequest(stayId) as never);
    }

    expect(last?.status).toBe(429);
    const body = (await last?.json()) as ErrorBody;
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(typeof body.error.retryAfter).toBe("number");
    expect(body.error.retryAfter ?? 0).toBeGreaterThan(0);
    expect(last?.headers.get("Retry-After")).toBe(String(body.error.retryAfter));
  });

  it("echoes no stay id in the limited answer, covers AC-8", async () => {
    const stayId = randomUUID();
    let raw = "";
    for (let i = 0; i < 6; i += 1) {
      const res = await POST(mintRequest(stayId) as never);
      if (i === 5) raw = await res.text();
    }

    expect(raw).not.toContain(stayId);
  });
});
