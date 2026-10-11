// Own staff profile (spec 0004). Powers the sign in redirect and the
// password change screen.
import { apiError } from "@/lib/api-error";
import { getStaffUserWithFlags } from "@/lib/staff-auth";
import { toStaffPublic } from "@/lib/staff";

export async function GET(): Promise<Response> {
  const user = await getStaffUserWithFlags();
  if (!user || user.isDisabled || user.locked) {
    return apiError("UNAUTHORIZED", "Sign in required.", 401);
  }
  return Response.json(toStaffPublic(user));
}
