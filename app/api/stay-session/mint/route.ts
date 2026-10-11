// Guest stay session mint (spec 0004, AC-3). A correct stay PIN mints
// exactly one live row bound to the stay and sets the stay cookie.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, GENERIC_LOCKED_MESSAGE } from "@/lib/api-error";
import {
  MINT_IP_MAX,
  MINT_STAY_MAX,
  clientIp,
  hitRateLimit,
  isRateLimited,
  mintIpKey,
  mintStayKey,
} from "@/lib/rate-limit";
import { STAY_COOKIE, StayAuthError, mintStaySession, stayCookieOptions } from "@/lib/stay-session";

export async function POST(request: NextRequest): Promise<Response> {
  let stayId = "";
  let pin = "";
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object") {
      const b = body as { stayId?: unknown; pin?: unknown };
      stayId = typeof b.stayId === "string" ? b.stayId : "";
      pin = typeof b.pin === "string" ? b.pin : "";
    }
  } catch {
    return apiError("BAD_REQUEST", "Stay and PIN are required.", 400);
  }
  const ip = clientIp(request.headers);
  if (isRateLimited(mintIpKey(ip), MINT_IP_MAX)) {
    return apiError("RATE_LIMITED", GENERIC_LOCKED_MESSAGE, 429);
  }
  hitRateLimit(mintIpKey(ip), MINT_IP_MAX);

  // A locked or inactive stay answers with its own message, not the
  // throttle: the lock is the protection, and the guest needs the call
  // staff wording, not a retry later wording. Its budget is not recorded.
  if (stayId) {
    const stay = await prisma.stay.findUnique({ where: { id: stayId } });
    if (stay && (stay.pinLocked || stay.status !== "ACTIVE")) {
      try {
        await mintStaySession(stayId, pin);
      } catch (err) {
        if (err instanceof StayAuthError) return apiError(err.code, err.message, err.status);
        throw err;
      }
    }
  }
  if (isRateLimited(mintStayKey(stayId || "unknown"), MINT_STAY_MAX)) {
    return apiError("RATE_LIMITED", GENERIC_LOCKED_MESSAGE, 429);
  }
  hitRateLimit(mintStayKey(stayId || "unknown"), MINT_STAY_MAX);

  try {
    const { token, expiresAt } = await mintStaySession(stayId, pin);
    const response = NextResponse.json({ ok: true, stayId, expiresAt: expiresAt.toISOString() });
    response.cookies.set(STAY_COOKIE, token, stayCookieOptions(expiresAt));
    return response;
  } catch (err) {
    if (err instanceof StayAuthError) return apiError(err.code, err.message, err.status);
    throw err;
  }
}
