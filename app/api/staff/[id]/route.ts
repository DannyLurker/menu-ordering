// Single staff account by admin (spec 0004, AC-8). An admin cannot demote
// or disable their own account: those transitions are rejected.
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { requireStaffRole } from "@/lib/staff-auth";
import { resetRateLimit, signInAccountKey } from "@/lib/rate-limit";
import { isStaffRole, toStaffPublic, type StaffRole } from "@/lib/staff";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await requireStaffRole(["ADMIN"]);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return apiError("UNKNOWN_USER", "Unknown staff account.", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "Nothing to update.", 400);
  }
  const b = (body ?? {}) as { role?: unknown; isDisabled?: unknown; unlock?: unknown };
  const data: { role?: StaffRole; isDisabled?: boolean; failedSignInAttempts?: number; lockedUntil?: null; updatedAt?: Date } = {};
  if (b.role !== undefined) {
    if (!isStaffRole(b.role)) {
      return apiError("INVALID_ROLE", "Role must be FRONT_DESK, KITCHEN, or ADMIN.", 422);
    }
    data.role = b.role;
  }
  if (b.isDisabled !== undefined) {
    if (typeof b.isDisabled !== "boolean") return apiError("INVALID_INPUT", "isDisabled must be true or false.", 422);
    data.isDisabled = b.isDisabled;
  }
  if (b.unlock === true) {
    data.failedSignInAttempts = 0;
    data.lockedUntil = null;
  }
  if (Object.keys(data).length === 0) return apiError("BAD_REQUEST", "Nothing to update.", 400);

  const selfDemote = data.role !== undefined && data.role !== "ADMIN" && target.id === gate.user.id;
  const selfDisable = data.isDisabled === true && target.id === gate.user.id;
  if (selfDemote || selfDisable) {
    return apiError("SELF_GUARD", "An admin cannot demote or disable their own account.", 403);
  }
  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { ...data, updatedAt: new Date() },
  });
  if (b.unlock === true) {
    // Human verified recovery: the staffer's next sign in must not trip on
    // the brute force budget that caused the lock.
    resetRateLimit(signInAccountKey(updated.email));
  }
  return Response.json(toStaffPublic({ ...updated, role: updated.role as StaffRole }));
}
