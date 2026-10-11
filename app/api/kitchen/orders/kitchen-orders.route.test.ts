// Integration tests for kitchen API routes (spec 0010).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

vi.mock("@/features/staff", () => ({
  requireStaffRole: vi.fn(),
}));

vi.mock("@/features/kitchen", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/kitchen")>();
  return {
    ...actual,
    getActiveKitchenOrders: vi.fn(),
    verifyKitchenOrder: vi.fn(),
    updateKitchenOrderEta: vi.fn(),
    markKitchenOrderReady: vi.fn(),
    markKitchenOrderServed: vi.fn(),
    cancelKitchenOrder: vi.fn(),
  };
});

import { GET } from "./route";
import { POST as verifyRoute } from "./[id]/verify/route";
import { PATCH as etaRoute } from "./[id]/eta/route";
import { POST as readyRoute } from "./[id]/ready/route";
import { POST as servedRoute } from "./[id]/served/route";
import { POST as cancelRoute } from "./[id]/cancel/route";

import { requireStaffRole } from "@/features/staff";
import {
  getActiveKitchenOrders,
  verifyKitchenOrder,
  updateKitchenOrderEta,
  markKitchenOrderReady,
  markKitchenOrderServed,
  cancelKitchenOrder,
  KitchenServiceError,
} from "@/features/kitchen";
import { resetRateLimit, kitchenStaffKey } from "@/lib/rate-limit";

const mockRequireStaffRole = vi.mocked(requireStaffRole);
const mockGetActiveOrders = vi.mocked(getActiveKitchenOrders);
const mockVerifyOrder = vi.mocked(verifyKitchenOrder);
const mockUpdateEta = vi.mocked(updateKitchenOrderEta);
const mockMarkReady = vi.mocked(markKitchenOrderReady);
const mockMarkServed = vi.mocked(markKitchenOrderServed);
const mockCancelOrder = vi.mocked(cancelKitchenOrder);

function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
) {
  const headers = new Headers(options.headers || {});
  headers.set("x-forwarded-for", "127.0.0.1");

  const reqInit: RequestInit = {
    method: options.method || "GET",
    headers,
  };

  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    reqInit.body = JSON.stringify(options.body);
  }

  const req = new Request(url, reqInit) as any;
  req.nextUrl = new URL(url);
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit(kitchenStaffKey("staff-kitchen-1"));
});

describe("GET /api/kitchen/orders", () => {
  it("denies unauthenticated request with 401, satisfies AC-2", async () => {
    mockRequireStaffRole.mockResolvedValue({
      response: Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 }),
    });

    const req = createMockRequest("http://localhost/api/kitchen/orders");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns active orders for FRONT_DESK, KITCHEN, or ADMIN, satisfies AC-2, AC-14", async () => {
    mockRequireStaffRole.mockResolvedValue({
      user: {
        id: "staff-desk-1",
        name: "Desk Staff",
        email: "desk@hotel.test",
        role: "FRONT_DESK",
        mustChangePassword: false,
        isDisabled: false,
        locked: false,
      },
    });

    mockGetActiveOrders.mockResolvedValue({
      pending: [],
      preparing: [],
      completed: [],
    });

    const req = createMockRequest("http://localhost/api/kitchen/orders?include=completed");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockGetActiveOrders).toHaveBeenCalledWith(expect.anything(), true);
  });
});

describe("POST /api/kitchen/orders/[id]/verify", () => {
  it("returns 403 if user is not KITCHEN or ADMIN, satisfies AC-14", async () => {
    mockRequireStaffRole.mockResolvedValue({
      response: Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 }),
    });

    const req = createMockRequest("http://localhost/api/kitchen/orders/ord-1/verify", {
      method: "POST",
      body: { etaMinutes: 20 },
    });
    const res = await verifyRoute(req, { params: Promise.resolve({ id: "ord-1" }) });
    expect(res.status).toBe(403);
  });

  it("verifies order and returns 200, satisfies AC-3", async () => {
    mockRequireStaffRole.mockResolvedValue({
      user: {
        id: "staff-kitchen-1",
        name: "Chef Mario",
        email: "chef@hotel.test",
        role: "KITCHEN",
        mustChangePassword: false,
        isDisabled: false,
        locked: false,
      },
    });

    mockVerifyOrder.mockResolvedValue({
      orderId: "ord-1",
      stayId: "stay-1",
      status: "PREPARING",
      verifiedAt: "2026-10-11T12:00:00.000Z",
      etaMinutes: 25,
    });

    const req = createMockRequest("http://localhost/api/kitchen/orders/ord-1/verify", {
      method: "POST",
      body: { etaMinutes: 25 },
    });
    const res = await verifyRoute(req, { params: Promise.resolve({ id: "ord-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("PREPARING");
    expect(data.etaMinutes).toBe(25);
  });

  it("returns 409 Conflict with currentStatus on transition conflict, satisfies AC-13", async () => {
    mockRequireStaffRole.mockResolvedValue({
      user: {
        id: "staff-kitchen-1",
        name: "Chef Mario",
        email: "chef@hotel.test",
        role: "KITCHEN",
        mustChangePassword: false,
        isDisabled: false,
        locked: false,
      },
    });

    mockVerifyOrder.mockRejectedValue(
      new KitchenServiceError("INVALID_TRANSITION", "Order already PREPARING", 409, "PREPARING"),
    );

    const req = createMockRequest("http://localhost/api/kitchen/orders/ord-1/verify", {
      method: "POST",
      body: { etaMinutes: 25 },
    });
    const res = await verifyRoute(req, { params: Promise.resolve({ id: "ord-1" }) });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error.currentStatus).toBe("PREPARING");
  });
});

describe("PATCH /api/kitchen/orders/[id]/eta", () => {
  it("updates ETA and returns 200, satisfies AC-4", async () => {
    mockRequireStaffRole.mockResolvedValue({
      user: {
        id: "staff-kitchen-1",
        name: "Chef Mario",
        email: "chef@hotel.test",
        role: "KITCHEN",
        mustChangePassword: false,
        isDisabled: false,
        locked: false,
      },
    });

    mockUpdateEta.mockResolvedValue({
      orderId: "ord-1",
      stayId: "stay-1",
      status: "PREPARING",
      etaMinutes: 40,
    });

    const req = createMockRequest("http://localhost/api/kitchen/orders/ord-1/eta", {
      method: "PATCH",
      body: { etaMinutes: 40 },
    });
    const res = await etaRoute(req, { params: Promise.resolve({ id: "ord-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.etaMinutes).toBe(40);
  });
});

describe("POST /api/kitchen/orders/[id]/ready", () => {
  it("marks order ready and returns 200, satisfies AC-5", async () => {
    mockRequireStaffRole.mockResolvedValue({
      user: {
        id: "staff-kitchen-1",
        name: "Chef Mario",
        email: "chef@hotel.test",
        role: "KITCHEN",
        mustChangePassword: false,
        isDisabled: false,
        locked: false,
      },
    });

    mockMarkReady.mockResolvedValue({
      orderId: "ord-1",
      stayId: "stay-1",
      status: "READY",
    });

    const req = createMockRequest("http://localhost/api/kitchen/orders/ord-1/ready", {
      method: "POST",
    });
    const res = await readyRoute(req, { params: Promise.resolve({ id: "ord-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("READY");
  });
});

describe("POST /api/kitchen/orders/[id]/served", () => {
  it("marks order served and returns 200, satisfies AC-6", async () => {
    mockRequireStaffRole.mockResolvedValue({
      user: {
        id: "staff-kitchen-1",
        name: "Chef Mario",
        email: "chef@hotel.test",
        role: "KITCHEN",
        mustChangePassword: false,
        isDisabled: false,
        locked: false,
      },
    });

    mockMarkServed.mockResolvedValue({
      orderId: "ord-1",
      stayId: "stay-1",
      status: "SERVED",
      servedAt: "2026-10-11T12:30:00.000Z",
    });

    const req = createMockRequest("http://localhost/api/kitchen/orders/ord-1/served", {
      method: "POST",
    });
    const res = await servedRoute(req, { params: Promise.resolve({ id: "ord-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("SERVED");
  });
});

describe("POST /api/kitchen/orders/[id]/cancel", () => {
  it("cancels order with reason and returns 200, satisfies AC-7", async () => {
    mockRequireStaffRole.mockResolvedValue({
      user: {
        id: "staff-kitchen-1",
        name: "Chef Mario",
        email: "chef@hotel.test",
        role: "KITCHEN",
        mustChangePassword: false,
        isDisabled: false,
        locked: false,
      },
    });

    mockCancelOrder.mockResolvedValue({
      orderId: "ord-1",
      stayId: "stay-1",
      status: "KITCHEN_CANCELLED",
      cancelReason: "Out of ingredients",
    });

    const req = createMockRequest("http://localhost/api/kitchen/orders/ord-1/cancel", {
      method: "POST",
      body: { reason: "Out of ingredients" },
    });
    const res = await cancelRoute(req, { params: Promise.resolve({ id: "ord-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("KITCHEN_CANCELLED");
    expect(data.cancelReason).toBe("Out of ingredients");
  });
});
