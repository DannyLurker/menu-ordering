// Integration tests for the stay creation route (spec 0008 AC-1, AC-3,
// AC-4). The handler runs for real; the staff gate is stubbed at the
// boundary and the database is stubbed (no durable rows are ever written).
// Each test uses its own room so app level state never bleeds across tests.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/staff", () => ({
  requireStaffRole: vi.fn(async () => ({ user: { id: "desk-1", role: "FRONT_DESK" } })),
}));

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
import { requireStaffRole } from "@/features/staff";
import { prisma } from "@/lib/db";

const gate = vi.mocked(requireStaffRole);
const findMany = vi.mocked(prisma.stay.findMany);
const createRow = vi.mocked(prisma.stay.create);

function createRequest(body: unknown): Request {
  return new Request("http://localhost/api/stays", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

interface CreatedBody {
  ok?: boolean;
  stayId?: string;
  setupCode?: string;
  duplicate?: boolean;
  error?: { code?: string; message?: string };
}

beforeEach(() => {
  vi.clearAllMocks();
  gate.mockResolvedValue({ user: { id: "desk-1", role: "FRONT_DESK" } } as never);
});

describe("POST /api/stays", () => {
  it("answers 400 on an unreadable body, covers AC-1", async () => {
    const res = await POST(
      new Request("http://localhost/api/stays", { method: "POST" }) as never,
    );
    const body = (await res.json()) as CreatedBody;

    expect(res.status).toBe(400);
    expect(body.error?.code).toBe("BAD_REQUEST");
  });

  it("answers 422 on a bad shape before touching the store, covers AC-1", async () => {
    const res = await POST(createRequest({ roomNumber: "V201", guestName: "No Date" }) as never);
    const body = (await res.json()) as CreatedBody;

    expect(res.status).toBe(422);
    expect(body.error?.code).toBe("INVALID_INPUT");
    expect(findMany).not.toHaveBeenCalled();
  });

  it("creates the stay and returns the plain code once, covers AC-1", async () => {
    findMany.mockResolvedValue([]);
    createRow.mockResolvedValue({ id: "stay-201" } as never);

    const res = await POST(
      createRequest({ roomNumber: "V201", guestName: "Route Guest", extraNames: ["Plus"], checkOut: "2026-10-20" }) as never,
    );
    const body = (await res.json()) as CreatedBody;

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.stayId).toBe("stay-201");
    expect(body.setupCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(body.duplicate).toBe(false);
  });

  it("answers 409 naming the checkout day when the room is live, covers AC-3", async () => {
    findMany.mockResolvedValue([
      {
        id: "stay-live",
        roomNumber: "V202",
        guestName: "Other",
        checkIn: new Date("2026-10-11T00:00:00.000Z"),
        checkOut: new Date("2026-10-15T00:00:00.000Z"),
        createdAt: new Date("2026-10-11T01:00:00.000Z"),
      },
    ] as never);

    const res = await POST(
      createRequest({ roomNumber: "v202", guestName: "Clash Guest", checkIn: "2026-10-15", checkOut: "2026-10-17" }) as never,
    );
    const body = (await res.json()) as CreatedBody;

    expect(res.status).toBe(409);
    expect(body.error?.code).toBe("ROOM_TAKEN");
    expect(body.error?.message).toContain("2026-10-15");
    expect(createRow).not.toHaveBeenCalled();
  });

  it("passes the role gate answer through without reaching the service, covers AC-1", async () => {
    gate.mockResolvedValueOnce({
      response: Response.json({ error: { code: "FORBIDDEN", message: "Your role cannot use this." } }, { status: 403 }),
    } as never);

    const res = await POST(
      createRequest({ roomNumber: "V203", guestName: "No Role", checkOut: "2026-10-20" }) as never,
    );
    const body = (await res.json()) as CreatedBody;

    expect(res.status).toBe(403);
    expect(body.error?.code).toBe("FORBIDDEN");
    expect(findMany).not.toHaveBeenCalled();
  });
});
