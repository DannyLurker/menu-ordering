// Temporary password reissue by admin (spec 0004). The new secret shows
// once and is never logged. Reissue also clears the sign in lock and drops
// existing sessions, since a lost temp password means a lost device.
// The body parses with zod first; rotation lives in the staff service.
import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { requireStaffRole } from "@/features/staff";
import { StaffError, reissueBody, reissueTempPassword } from "@/features/staff";

export async function POST(request: NextRequest): Promise<Response> {
  const gate = await requireStaffRole(["ADMIN"]);
  if ("response" in gate) return gate.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "A staff user id is required.", 400);
  }
  const parsed = reissueBody.safeParse(body);
  if (!parsed.success) return apiError("BAD_REQUEST", "A staff user id is required.", 400);
  try {
    const tempPassword = await reissueTempPassword(prisma, parsed.data.userId);
    return Response.json({ userId: parsed.data.userId, tempPassword });
  } catch (err) {
    if (err instanceof StaffError) return apiError(err.code, err.message, err.status);
    throw err;
  }
}
