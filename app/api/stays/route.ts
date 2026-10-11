// Stay creation by desk or admin (spec 0008, AC-1). One form submit makes
// the stay plus guest rows and returns the one time setup code exactly once.
// The creation rules live in the stay service.
import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { requireStaffRole } from "@/features/staff";
import { StayCheckinError, createStay, createStayBody } from "@/features/stays";

export async function POST(request: NextRequest): Promise<Response> {
  const gate = await requireStaffRole(["FRONT_DESK", "ADMIN"]);
  if ("response" in gate) return gate.response;
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "Room, guest, and dates are required.", 400);
  }
  const parsed = createStayBody.safeParse(rawBody);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Give a valid room, guest name, and dates.", 422);
  }
  try {
    const created = await createStay(prisma, parsed.data);
    return Response.json({
      ok: true,
      stayId: created.stayId,
      roomNumber: created.roomNumber,
      checkIn: created.checkIn.toISOString(),
      checkOut: created.checkOut.toISOString(),
      setupCode: created.setupCode,
      setupExpiresAt: created.setupExpiresAt.toISOString(),
      duplicate: created.duplicate,
    });
  } catch (err) {
    if (err instanceof StayCheckinError) return apiError(err.code, err.message, err.status);
    throw err;
  }
}
