// BetterAuth HTTP surface (spec 0004). Base path stays /api/auth.
// The wrapper adds what BetterAuth does not own: LRU limits plus the
// durable Postgres lockout columns (5 wrong passwords cool down 15 min).
// Wrong credentials always answer generic; nothing names the account.
// The lockout rules live in the staff service; this file only parses the
// request, enforces the budgets, and delegates the password check.
import type { NextRequest } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/features/staff";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import {
  SIGN_IN_ACCOUNT_MAX,
  SIGN_IN_IP_MAX,
  clientIp,
  hitRateLimit,
  isRateLimited,
  rateLimitRetryAfter,
  rateLimitedResponse,
  signInAccountKey,
  signInIpKey,
} from "@/lib/rate-limit";
import {
  StaffError,
  checkSignInAllowed,
  recordSignInFailure,
  recordSignInSuccess,
} from "@/features/staff";

const { GET: baseGET, POST: basePOST } = toNextJsHandler(auth);

export function GET(request: NextRequest): Promise<Response> {
  return baseGET(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.endsWith("/sign-in/email")) return basePOST(request);

  let email = "";
  try {
    const body: unknown = await request.clone().json();
    if (body && typeof body === "object" && "email" in body)
      email = String((body as { email: unknown }).email ?? "");
  } catch {
    return basePOST(request);
  }
  const key = email.trim().toLowerCase();
  const ip = clientIp(request.headers);

  if (
    (key && isRateLimited(signInAccountKey(key), SIGN_IN_ACCOUNT_MAX)) ||
    isRateLimited(signInIpKey(ip), SIGN_IN_IP_MAX)
  ) {
    const limitedKey = key && isRateLimited(signInAccountKey(key), SIGN_IN_ACCOUNT_MAX)
      ? signInAccountKey(key)
      : signInIpKey(ip);
    const limitedMax = limitedKey.startsWith("signin:acct")
      ? SIGN_IN_ACCOUNT_MAX
      : SIGN_IN_IP_MAX;
    return rateLimitedResponse(rateLimitRetryAfter(limitedKey, limitedMax));
  }
  if (key) {
    try {
      await checkSignInAllowed(prisma, key);
    } catch (err) {
      if (err instanceof StaffError)
        return apiError(err.code, err.message, err.status);
      throw err;
    }
    hitRateLimit(signInAccountKey(key), SIGN_IN_ACCOUNT_MAX);
  }
  hitRateLimit(signInIpKey(ip), SIGN_IN_IP_MAX);

  const response = await basePOST(request);
  if (key) {
    if (response.ok) {
      await recordSignInSuccess(prisma, key);
    } else if (response.status === 401) {
      await recordSignInFailure(prisma, key);
    }
  }
  return response;
}
