// Forced password change (spec 0004, AC-8). Staffers created with a
// temporary password clear mustChangePassword here before reaching any
// screen. The temp gate is the only screen this endpoint shares with.
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { getStaffUserWithFlags } from "@/lib/staff-auth";

export const NEXT_PASSWORD_MIN = 10;

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getStaffUserWithFlags();
  if (!user || user.isDisabled || user.locked) {
    return apiError("UNAUTHORIZED", "Sign in required.", 401);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "Current and new passwords are required.", 400);
  }
  const b = (body ?? {}) as { current?: unknown; next?: unknown };
  if (typeof b.current !== "string" || !b.current || typeof b.next !== "string" || b.next.length < NEXT_PASSWORD_MIN) {
    return apiError("WEAK_PASSWORD", `The new password must be at least ${NEXT_PASSWORD_MIN} characters.`, 422);
  }
  try {
    await auth.api.changePassword({
      body: { currentPassword: b.current, newPassword: b.next, revokeOtherSessions: true },
      headers: request.headers,
    });
  } catch {
    return apiError("INVALID_CURRENT", "The current password is wrong.", 401);
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { mustChangePassword: false, failedSignInAttempts: 0, lockedUntil: null, updatedAt: new Date() },
  });
  return Response.json({ ok: true });
}
