// Guest stay session revoke (spec 0004). Sign out frees the single live
// row so another device can mint; checkout and PIN lock revoke server side.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { STAY_COOKIE, revokeStaySession } from "@/lib/stay-session";

export async function POST(request: NextRequest): Promise<Response> {
  const token = request.cookies.get(STAY_COOKIE)?.value;
  if (!token) return apiError("NO_SESSION", "No stay session to revoke.", 401);
  await revokeStaySession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(STAY_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
