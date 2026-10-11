// Forced password change (spec 0004, AC-8). Staffers created with a
// temporary password clear mustChangePassword here before reaching any
// screen. The body parses with zod first; rotation lives in the service.
import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import {
  NEXT_PASSWORD_MIN,
  StaffError,
  changeStaffPassword,
  getStaffUserWithFlags,
  passwordBody,
} from "@/features/staff";

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getStaffUserWithFlags();
  if (!user || user.isDisabled || user.locked) {
    return apiError("UNAUTHORIZED", "Sign in required.", 401);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(
      "BAD_REQUEST",
      "Current and new passwords are required.",
      400,
    );
  }
  const parsed = passwordBody.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "WEAK_PASSWORD",
      `The new password must be at least ${NEXT_PASSWORD_MIN} characters.`,
      422,
    );
  }
  try {
    await changeStaffPassword({
      userId: user.id,
      ...parsed.data,
      headers: request.headers,
    });
  } catch (err) {
    if (err instanceof StaffError)
      return apiError(err.code, err.message, err.status);
    throw err;
  }
  return Response.json({ ok: true });
}
