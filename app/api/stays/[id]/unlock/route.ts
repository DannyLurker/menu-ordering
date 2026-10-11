// Stay PIN unlock by desk or admin (spec 0004, AC-7). Clears the PIN
// counter and lock; the stay session stays revoked, so the guest mints
// again with a correct PIN. The unlock rule lives in the stay session
// service.
import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { requireStaffRole } from "@/features/staff";
import { StayAuthError, unlockStay } from "@/features/stay-session";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await requireStaffRole(["FRONT_DESK", "ADMIN"]);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;
  try {
    const { stayId } = await unlockStay(id);
    return Response.json({ ok: true, stayId });
  } catch (err) {
    if (err instanceof StayAuthError) return apiError(err.code, err.message, err.status);
    throw err;
  }
}
