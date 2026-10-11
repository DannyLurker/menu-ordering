// Guest stay session mint (spec 0004, AC-3). A correct stay PIN mints
// exactly one live row bound to the stay and sets the stay cookie.
// This file parses the request and enforces the budgets; the mint and
// lock rules live in the stay session service.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import {
  MINT_IP_MAX,
  MINT_STAY_MAX,
  clientIp,
  hitRateLimit,
  isRateLimited,
  mintIpKey,
  mintStayKey,
  rateLimitRetryAfter,
  rateLimitedResponse,
} from "@/lib/rate-limit";
import {
  STAY_COOKIE,
  StayAuthError,
  mintBody,
  mintStaySession,
  peekStay,
  stayCookieOptions,
} from "@/features/stay-session";

export async function POST(request: NextRequest): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "Stay and PIN are required.", 400);
  }
  const parsed = mintBody.safeParse(rawBody);
  if (!parsed.success) return apiError("INVALID_INPUT", "Give a valid stay and a 6 digit PIN.", 422);
  const { stayId, pin } = parsed.data;
  const ip = clientIp(request.headers);
  if (isRateLimited(mintIpKey(ip), MINT_IP_MAX)) {
    return rateLimitedResponse(rateLimitRetryAfter(mintIpKey(ip), MINT_IP_MAX));
  }
  hitRateLimit(mintIpKey(ip), MINT_IP_MAX);

  // A locked or inactive stay answers with its own message, not the
  // throttle: the lock is the protection, and the guest needs the call
  // staff wording, not a retry later wording. Its budget is not recorded.
  if (stayId) {
    const stay = await peekStay(prisma, stayId);
    if (stay && (stay.pinLocked || stay.status !== "ACTIVE")) {
      return mintAndSetCookie(stayId, pin);
    }
  }
  if (isRateLimited(mintStayKey(stayId || "unknown"), MINT_STAY_MAX)) {
    return rateLimitedResponse(
      rateLimitRetryAfter(mintStayKey(stayId || "unknown"), MINT_STAY_MAX),
    );
  }
  hitRateLimit(mintStayKey(stayId || "unknown"), MINT_STAY_MAX);
  return mintAndSetCookie(stayId, pin);
}

async function mintAndSetCookie(stayId: string, pin: string): Promise<Response> {
  try {
    const { token, expiresAt } = await mintStaySession(prisma, stayId, pin);
    const response = NextResponse.json({ ok: true, stayId, expiresAt: expiresAt.toISOString() });
    response.cookies.set(STAY_COOKIE, token, stayCookieOptions(expiresAt));
    return response;
  } catch (err) {
    if (err instanceof StayAuthError) return apiError(err.code, err.message, err.status);
    throw err;
  }
}
