// Integration tests for guest orders route (spec 0009).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

vi.mock("@/features/stay-session", () => ({
  STAY_COOKIE: "stay_session",
  resolveStaySession: vi.fn(),
}));

vi.mock("@/features/orders", () => ({
  placeOrder: vi.fn(),
  getStayOrders: vi.fn(),
  createOrderInputSchema: {
    safeParse: vi.fn(),
  },
  OrderServiceError: class OrderServiceError extends Error {
    status: number;
    code: string;
    details?: unknown;
    constructor(status: number, code: string, message: string, details?: unknown) {
      super(message);
      this.status = status;
      this.code = code;
      this.details = details;
    }
  },
}));

import { GET, POST } from "./route";
import { resolveStaySession } from "@/features/stay-session";
import {
  OrderServiceError,
  createOrderInputSchema,
  getStayOrders,
  placeOrder,
} from "@/features/orders";

const mockResolveSession = vi.mocked(resolveStaySession);
const mockPlaceOrder = vi.mocked(placeOrder);
const mockGetStayOrders = vi.mocked(getStayOrders);
const mockSafeParse = vi.mocked(createOrderInputSchema.safeParse);

function createMockRequest(
  url: string,
  options: {
    method?: string;
    cookie?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
) {
  const headers = new Headers(options.headers || {});
  headers.set("x-forwarded-for", "127.0.0.1");
  if (options.cookie) {
    headers.set("cookie", `stay_session=${options.cookie}`);
  }

  const reqInit: RequestInit = {
    method: options.method || "GET",
    headers,
  };

  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    reqInit.body = JSON.stringify(options.body);
  }

  // Mimic NextRequest cookies
  const req = new Request(url, reqInit) as any;
  req.cookies = {
    get: (name: string) => (name === "stay_session" && options.cookie ? { value: options.cookie } : undefined),
  };
  req.nextUrl = new URL(url);

  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/orders", () => {
  it("returns 401 when stay session cookie is missing", async () => {
    const req = createMockRequest("http://localhost/api/orders", { method: "POST", body: {} });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when stay session is expired or revoked", async () => {
    mockResolveSession.mockResolvedValue(null);

    const req = createMockRequest("http://localhost/api/orders", {
      method: "POST",
      cookie: "expired-token",
      body: {},
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 422 on invalid request body", async () => {
    mockResolveSession.mockResolvedValue("stay-1");
    mockSafeParse.mockReturnValue({
      success: false,
      error: { issues: [{ message: "PIN must be exactly 6 digits." }] } as any,
    });

    const req = createMockRequest("http://localhost/api/orders", {
      method: "POST",
      cookie: "valid-token",
      body: { pin: "bad" },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error.code).toBe("INVALID_INPUT");
  });

  it("creates order and returns 201 on success", async () => {
    mockResolveSession.mockResolvedValue("stay-1");
    mockSafeParse.mockReturnValue({
      success: true,
      data: {
        pin: "123456",
        items: [{ menuItemId: "m1", qty: 2 }],
        clientTotal: 100000,
      },
    } as any);

    mockPlaceOrder.mockResolvedValue({
      orderId: "ord-1",
      status: "PENDING",
      placedAt: new Date("2026-10-11T12:00:00Z"),
      totalAmount: 100000,
      items: [
        {
          id: "oi-1",
          menuItemId: "m1",
          qty: 2,
          unitPrice: 50000,
          nameEn: "Fried Rice",
          nameId: "Nasi Goreng",
        },
      ],
    });

    const req = createMockRequest("http://localhost/api/orders", {
      method: "POST",
      cookie: "valid-token",
      body: { pin: "123456", items: [{ menuItemId: "m1", qty: 2 }], clientTotal: 100000 },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.ok).toBe(true);
    expect(data.orderId).toBe("ord-1");
    expect(data.status).toBe("PENDING");
  });

  it("forwards OrderServiceError status, code, and details", async () => {
    mockResolveSession.mockResolvedValue("stay-1");
    mockSafeParse.mockReturnValue({
      success: true,
      data: {
        pin: "999999",
        items: [{ menuItemId: "m1", qty: 1 }],
        clientTotal: 50000,
      },
    } as any);

    mockPlaceOrder.mockRejectedValue(
      new OrderServiceError(401, "WRONG_PIN", "Wrong PIN.", { remainingAttempts: 3 }),
    );

    const req = createMockRequest("http://localhost/api/orders", {
      method: "POST",
      cookie: "valid-token",
      body: { pin: "999999", items: [{ menuItemId: "m1", qty: 1 }], clientTotal: 50000 },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error.code).toBe("WRONG_PIN");
    expect(data.error.details.remainingAttempts).toBe(3);
  });
});

describe("GET /api/orders", () => {
  it("returns 401 when stay session cookie is missing", async () => {
    const req = createMockRequest("http://localhost/api/orders", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with list of orders for valid stay session", async () => {
    mockResolveSession.mockResolvedValue("stay-1");
    mockGetStayOrders.mockResolvedValue([
      {
        id: "ord-1",
        status: "PENDING",
        placedAt: new Date("2026-10-11T12:00:00Z"),
        etaMinutes: null,
        totalAmount: 100000,
        items: [],
      },
    ]);

    const req = createMockRequest("http://localhost/api/orders", {
      method: "GET",
      cookie: "valid-token",
    });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.orders).toHaveLength(1);
    expect(data.orders[0].id).toBe("ord-1");
  });
});

