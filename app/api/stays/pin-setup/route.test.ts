// Integration tests for PIN setup route (spec 0008, spec 0009 fix).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

vi.mock("@/features/stays", () => ({
  setupStayPin: vi.fn(),
  pinSetupBody: {
    safeParse: vi.fn(),
  },
  StayCheckinError: class StayCheckinError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

vi.mock("@/features/stay-session", () => ({
  STAY_COOKIE: "stay_session",
  mintStaySession: vi.fn(),
  stayCookieOptions: vi.fn(() => ({ httpOnly: true, secure: false })),
  StayAuthError: class StayAuthError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

import { POST } from "./route";
import { setupStayPin } from "@/features/stays";
import { mintStaySession } from "@/features/stay-session";

const mockSetupStayPin = vi.mocked(setupStayPin);
const mockMintStaySession = vi.mocked(mintStaySession);

function createMockRequest(body: unknown) {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("x-forwarded-for", "127.0.0.1");

  const req = new Request("http://localhost/api/stays/pin-setup", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }) as any;
  req.nextUrl = new URL("http://localhost/api/stays/pin-setup");
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/stays/pin-setup", () => {
  it("returns 422 on invalid request body", async () => {
    const { pinSetupBody } = await import("@/features/stays");
    vi.mocked(pinSetupBody.safeParse).mockReturnValue({
      success: false,
      error: { issues: [{ message: "Required" }] },
    } as any);

    const req = createMockRequest({ stayId: "", setupCode: "", newPin: "", confirmPin: "" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error.code).toBe("INVALID_INPUT");
  });

  it("sets a stay session cookie on successful PIN setup", async () => {
    const { pinSetupBody } = await import("@/features/stays");
    vi.mocked(pinSetupBody.safeParse).mockReturnValue({
      success: true,
      data: {
        stayId: "stay-1",
        setupCode: "ABC123",
        newPin: "123456",
        confirmPin: "123456",
      },
    } as any);

    mockSetupStayPin.mockResolvedValue({ ok: true, pinSetAt: new Date("2026-10-11T12:00:00Z") });
    mockMintStaySession.mockResolvedValue({
      token: "session-token-123",
      expiresAt: new Date("2026-10-12T12:00:00Z"),
    });

    const req = createMockRequest({
      stayId: "stay-1",
      setupCode: "ABC123",
      newPin: "123456",
      confirmPin: "123456",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockMintStaySession).toHaveBeenCalledWith(expect.anything(), "stay-1", "123456");
    expect(res.headers.get("set-cookie")).toContain("stay_session=session-token-123");
  });

  it("does not set a cookie when PIN setup fails", async () => {
    const { pinSetupBody } = await import("@/features/stays");
    vi.mocked(pinSetupBody.safeParse).mockReturnValue({
      success: true,
      data: {
        stayId: "stay-1",
        setupCode: "ABC123",
        newPin: "123456",
        confirmPin: "123456",
      },
    } as any);

    const { StayCheckinError } = await import("@/features/stays");
    mockSetupStayPin.mockRejectedValue(
      new StayCheckinError(400, "WEAK_PIN", "Pick a harder PIN"),
    );

    const req = createMockRequest({
      stayId: "stay-1",
      setupCode: "ABC123",
      newPin: "123456",
      confirmPin: "123456",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.code).toBe("WEAK_PIN");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(mockMintStaySession).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON body", async () => {
    const headers = new Headers();
    headers.set("x-forwarded-for", "127.0.0.1");
    const req = new Request("http://localhost/api/stays/pin-setup", {
      method: "POST",
      headers,
      body: "not valid json",
    }) as any;
    req.nextUrl = new URL("http://localhost/api/stays/pin-setup");

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.code).toBe("BAD_REQUEST");
  });
});
