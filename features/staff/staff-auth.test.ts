// Gate tests for staff identity (spec 0004 AC-2, AC-4, AC-8). The session
// source (BetterAuth) and request headers are mocked at the boundary;
// every branch below is our own gate logic.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("../../lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "../../lib/auth";
import { getStaffUser, getStaffUserWithFlags, requireStaffRole } from "./staff-auth";

const getSession = vi.mocked(auth.api.getSession);

function sessionUser(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "u1",
    name: "Night Chef",
    email: "chef@example.com",
    role: "KITCHEN",
    mustChangePassword: false,
    isDisabled: false,
    lockedUntil: null,
    ...overrides,
  };
}

beforeEach(() => {
  getSession.mockReset();
});

describe("getStaffUser", () => {
  it("returns null with no session, covers AC-4", async () => {
    getSession.mockResolvedValue(null);

    expect(await getStaffUser()).toBeNull();
  });

  it("returns null for an unknown role, a disabled user, or a locked user, covers AC-2, AC-4", async () => {
    getSession.mockResolvedValue({ user: sessionUser({ role: "OWNER" }), session: {} });
    expect(await getStaffUser()).toBeNull();

    getSession.mockResolvedValue({ user: sessionUser({ isDisabled: true }), session: {} });
    expect(await getStaffUser()).toBeNull();

    getSession.mockResolvedValue({ user: sessionUser({ lockedUntil: new Date(Date.now() + 60000) }), session: {} });
    expect(await getStaffUser()).toBeNull();
  });

  it("returns the user when the session is valid and the lock expired, covers AC-2", async () => {
    getSession.mockResolvedValue({ user: sessionUser({ lockedUntil: new Date(Date.now() - 60000) }), session: {} });

    const user = await getStaffUser();

    expect(user?.role).toBe("KITCHEN");
    expect(user?.locked).toBe(false);
  });
});

describe("getStaffUserWithFlags", () => {
  it("keeps must change and disabled flags for precise gates, covers AC-8", async () => {
    getSession.mockResolvedValue({ user: sessionUser({ mustChangePassword: true }), session: {} });

    expect((await getStaffUserWithFlags())?.mustChangePassword).toBe(true);
  });
});

describe("requireStaffRole", () => {
  async function codeOf(gate: Awaited<ReturnType<typeof requireStaffRole>>): Promise<{ status: number; code: string } | null> {
    if ("user" in gate) return null;
    const body = (await gate.response.json()) as { error: { code: string } };
    return { status: gate.response.status, code: body.error.code };
  }

  it("answers 401 with no usable session, covers AC-4", async () => {
    getSession.mockResolvedValue(null);

    expect(await codeOf(await requireStaffRole(["KITCHEN"]))).toEqual({ status: 401, code: "UNAUTHORIZED" });
  });

  it("answers 403 while a temp password is pending, covers AC-8", async () => {
    getSession.mockResolvedValue({ user: sessionUser({ mustChangePassword: true }), session: {} });

    expect(await codeOf(await requireStaffRole(["KITCHEN"]))).toEqual({ status: 403, code: "MUST_CHANGE_PASSWORD" });
  });

  it("answers 403 on the wrong role and passes the user on the right one, covers AC-2", async () => {
    getSession.mockResolvedValue({ user: sessionUser(), session: {} });

    expect(await codeOf(await requireStaffRole(["ADMIN"]))).toEqual({ status: 403, code: "FORBIDDEN" });

    const gate = await requireStaffRole(["KITCHEN", "ADMIN"]);
    expect("user" in gate && gate.user.role).toBe("KITCHEN");
  });
});
