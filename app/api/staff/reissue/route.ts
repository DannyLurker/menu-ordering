// Temporary password reissue by admin (spec 0004). The new secret shows
// once and is never logged. Reissue also clears the sign in lock and drops
// existing sessions, since a lost temp password means a lost device.
import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { requireStaffRole } from "@/lib/staff-auth";
import { reissueTempPassword } from "@/lib/staff";

export async function POST(request: NextRequest): Promise<Response> {
  const gate = await requireStaffRole(["ADMIN"]);
  if ("response" in gate) return gate.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "A staff user id is required.", 400);
  }
  const userId = (body as { userId?: unknown } | null)?.userId;
  if (typeof userId !== "string" || !userId) {
    return apiError("BAD_REQUEST", "A staff user id is required.", 400);
  }
  try {
    const tempPassword = await reissueTempPassword(userId);
    return Response.json({ userId, tempPassword });
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return apiError("UNKNOWN_USER", "Unknown staff account.", status === 404 ? 404 : 500);
  }
}
