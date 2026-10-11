// Stay PIN unlock by desk or admin (spec 0004, AC-7). Clears the PIN
// counter and lock; the stay session stays revoked, so the guest mints
// again with a correct PIN.
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { requireStaffRole } from "@/lib/staff-auth";
import { mintStayKey, resetRateLimit } from "@/lib/rate-limit";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await requireStaffRole(["FRONT_DESK", "ADMIN"]);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;
  const stay = await prisma.stay.findUnique({ where: { id } });
  if (!stay) return apiError("UNKNOWN_STAY", "Unknown stay.", 404);
  await prisma.stay.update({
    where: { id: stay.id },
    data: { failedPinAttempts: 0, pinLocked: false },
  });
  // Human verified recovery: the guest's next mint must not trip on the
  // brute force budget that caused the lock.
  resetRateLimit(mintStayKey(stay.id));
  return Response.json({ ok: true, stayId: stay.id });
}
