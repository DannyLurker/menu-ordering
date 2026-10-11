// Single staff account by admin (spec 0004, AC-8). An admin cannot demote
// or disable their own account: those transitions are rejected. The body
// parses with zod first; the update rules live in the staff service.
import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { StaffError, requireStaffRole, updateStaffAccount, updateStaffBody } from "@/features/staff";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await requireStaffRole(["ADMIN"]);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "Nothing to update.", 400);
  }
  const parsed = updateStaffBody.safeParse(body);
  if (!parsed.success) return apiError("INVALID_INPUT", "Check the fields and try again.", 422);
  try {
    const updated = await updateStaffAccount({ adminId: gate.user.id, targetId: id, ...parsed.data });
    return Response.json(updated);
  } catch (err) {
    if (err instanceof StaffError) return apiError(err.code, err.message, err.status);
    throw err;
  }
}
