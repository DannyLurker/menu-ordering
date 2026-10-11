// Integration tests for the desk reissue route (spec 0008 AC-6). The
// handler runs for real; the staff gate is stubbed at the boundary and the
// database is stubbed (no durable rows are ever written).
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
const findUnique = vi.mocked(prisma.stay.findUnique);
const updateRow = vi.mocked(prisma.stay.update);

function reissueRequest(id: string): { request: Request; context: { params: Promise<{ id: string }> } } {
  return {
    request: new Request(`http://localhost/api/stays/${id}/reissue`, { method: "POST" }) as never,
    context: { params: Promise.resolve({ id }) },
  };
}

interface ReissueBody {
  ok?: boolean;
  stayId?: string;
  setupCode?: string;
  error?: { code?: string; message?: string };
}

beforeEach(() => {
  vi.clearAllMocks();
  gate.mockResolvedValue({ user: { id: "desk-1", role: "FRONT_DESK" } } as never);
});

describe("POST /api/stays/[id]/reissue", () => {
  it("returns a fresh code for a live stay, covers AC-6", async () => {
    findUnique.mockResolvedValue({ id: "stay-401", status: "ACTIVE" } as never);
    updateRow.mockResolvedValue({} as never);

    const { request, context } = reissueRequest("stay-401");
    const res = await POST(request as never, context);
    const body = (await res.json()) as ReissueBody;

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.stayId).toBe("stay-401");
    expect(body.setupCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it("answers 404 for an unknown stay, covers AC-6", async () => {
    findUnique.mockResolvedValue(null);

    const { request, context } = reissueRequest("missing-stay");
    const res = await POST(request as never, context);
    const body = (await res.json()) as ReissueBody;

    expect(res.status).toBe(404);
    expect(body.error?.code).toBe("UNKNOWN_STAY");
    expect(updateRow).not.toHaveBeenCalled();
  });

  it("answers 409 for a stay that is no longer active, covers AC-6", async () => {
    findUnique.mockResolvedValue({ id: "stay-402", status: "CHECKED_OUT" } as never);

    const { request, context } = reissueRequest("stay-402");
    const res = await POST(request as never, context);
    const body = (await res.json()) as ReissueBody;

    expect(res.status).toBe(409);
    expect(body.error?.code).toBe("STAY_NOT_ACTIVE");
  });

  it("passes the role gate answer through without touching the store, covers AC-6", async () => {
    gate.mockResolvedValueOnce({
      response: Response.json({ error: { code: "FORBIDDEN", message: "Your role cannot use this." } }, { status: 403 }),
    } as never);

    const { request, context } = reissueRequest("stay-403");
    const res = await POST(request as never, context);

    expect(res.status).toBe(403);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
