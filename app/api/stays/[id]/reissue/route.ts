// Desk setup code reissue (spec 0008, AC-6). Authenticated desk or admin
// only; throttled hourly per stay. The reissue rule lives in the stay
// service.
import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { REISSUE_HOUR_MAX, rateLimitedResponse, reissueDeskKey, takeHourBudget } from "@/lib/rate-limit";
import { requireStaffRole } from "@/features/staff";
import { StayCheckinError, reissueSetupCode } from "@/features/stays";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await requireStaffRole(["FRONT_DESK", "ADMIN"]);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;
  const budget = takeHourBudget(reissueDeskKey(id), REISSUE_HOUR_MAX);
  if (!budget.allowed) {
    return rateLimitedResponse(budget.retryAfterSec, "Slow down and try again later. / Perlambat dan coba lagi nanti.");
  }
  try {
    const reissued = await reissueSetupCode(prisma, id);
    return Response.json({
      ok: true,
      stayId: reissued.stayId,
      setupCode: reissued.setupCode,
      setupExpiresAt: reissued.setupExpiresAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof StayCheckinError) return apiError(err.code, err.message, err.status);
    throw err;
  }
}
