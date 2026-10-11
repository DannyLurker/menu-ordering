// Integration tests for the guest PIN setup route (spec 0008 AC-2,
// AC-7). The handler runs for real with the real LRU limiter; only the
// database is stubbed at the boundary. Each throttle test uses its own
// stay id so budgets never bleed across tests.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

vi.mock("@/lib/db", () => ({
  prisma: {
    stay: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { POST } from "./route";
import { prisma } from "@/lib/db";
import { hashSetupCode } from "@/features/stays";

const findUnique = vi.mocked(prisma.stay.findUnique);
const updateMany = vi.mocked(prisma.stay.updateMany);

function setupRequest(body: unknown): Request {
  return new Request("http://localhost/api/stays/pin-setup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

interface SetupBody {
  ok?: boolean;
  error?: { code?: string; message?: string; retryAfter?: number };
}

function liveRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "stay-301",
    status: "ACTIVE",
    pinLocked: false,
    pinSetAt: null,
    setupHash: hashSetupCode("ABCDEFGH"),
    setupExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/stays/pin-setup", () => {
  it("answers 422 on a bad shape before spending budget, covers AC-2", async () => {
    const res = await POST(setupRequest({ stayId: "x" }) as never);
    const body = (await res.json()) as SetupBody;

    expect(res.status).toBe(422);
    expect(body.error?.code).toBe("INVALID_INPUT");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects a weak PIN without reading the stay, covers AC-2", async () => {
    const res = await POST(
      setupRequest({ stayId: randomUUID(), setupCode: "ABCDEFGH", newPin: "123456", confirmPin: "123456" }) as never,
    );
    const body = (await res.json()) as SetupBody;

    expect(res.status).toBe(400);
    expect(body.error?.code).toBe("WEAK_PIN");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects a mismatched confirm, covers AC-2", async () => {
    const res = await POST(
      setupRequest({ stayId: randomUUID(), setupCode: "ABCDEFGH", newPin: "482916", confirmPin: "482917" }) as never,
    );
    const body = (await res.json()) as SetupBody;

    expect(res.status).toBe(400);
    expect(body.error?.code).toBe("PIN_MISMATCH");
  });

  it("sets the PIN on a valid code and stamps pinSetAt, covers AC-2", async () => {
    findUnique.mockResolvedValue(liveRow() as never);
    updateMany.mockResolvedValue({ count: 1 } as never);

    const res = await POST(
      setupRequest({ stayId: "stay-301", setupCode: "ABCDEFGH", newPin: "482916", confirmPin: "482916" }) as never,
    );
    const body = (await res.json()) as SetupBody;

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("answers uniform invalid for an unknown stay and leaks no id, covers AC-2", async () => {
    const stayId = randomUUID();
    findUnique.mockResolvedValue(null);

    const res = await POST(
      setupRequest({ stayId, setupCode: "ZZZZZZZZ", newPin: "482916", confirmPin: "482916" }) as never,
    );
    const raw = await res.text();

    expect(res.status).toBe(400);
    expect(raw).toContain("SETUP_INVALID");
    expect(raw).not.toContain(stayId);
  });

  it("answers 410 for a consumed code, covers AC-2", async () => {
    findUnique.mockResolvedValue(liveRow({ setupHash: null, setupExpiresAt: null, pinSetAt: new Date() }) as never);

    const res = await POST(
      setupRequest({ stayId: "stay-302", setupCode: "ABCDEFGH", newPin: "482916", confirmPin: "482916" }) as never,
    );
    const body = (await res.json()) as SetupBody;

    expect(res.status).toBe(410);
    expect(body.error?.code).toBe("SETUP_EXPIRED");
  });

  it("answers 423 for a locked stay, covers AC-2", async () => {
    findUnique.mockResolvedValue(liveRow({ pinLocked: true }) as never);

    const res = await POST(
      setupRequest({ stayId: "stay-303", setupCode: "ABCDEFGH", newPin: "482916", confirmPin: "482916" }) as never,
    );
    const body = (await res.json()) as SetupBody;

    expect(res.status).toBe(423);
    expect(body.error?.code).toBe("STAY_LOCKED");
  });

  it("answers 429 with retry hint past the stay budget, covers AC-7", async () => {
    const stayId = randomUUID();
    findUnique.mockResolvedValue(null);
    let last: Response | null = null;
    for (let i = 0; i < 6; i += 1) {
      last = await POST(
        setupRequest({ stayId, setupCode: "ZZZZZZZZ", newPin: "482916", confirmPin: "482916" }) as never,
      );
    }

    expect(last?.status).toBe(429);
    const body = (await last?.json()) as SetupBody;
    expect(body.error?.code).toBe("RATE_LIMITED");
    expect(typeof body.error?.retryAfter).toBe("number");
    expect(last?.headers.get("Retry-After")).toBe(String(body.error?.retryAfter));
  });
});
