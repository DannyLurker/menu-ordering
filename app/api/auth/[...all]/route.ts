// BetterAuth HTTP surface (spec 0004). Base path stays /api/auth.
// The wrapper adds what BetterAuth does not own: LRU limits plus the
// durable Postgres lockout columns (5 wrong passwords cool down 15 min).
// Wrong credentials always answer generic; nothing names the account.
import type { NextRequest } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, GENERIC_CREDENTIALS_MESSAGE, GENERIC_LOCKED_MESSAGE } from "@/lib/api-error";
import {
  SIGN_IN_ACCOUNT_MAX,
  SIGN_IN_IP_MAX,
  clientIp,
  hitRateLimit,
  isRateLimited,
  signInAccountKey,
  signInIpKey,
} from "@/lib/rate-limit";

const { GET: baseGET, POST: basePOST } = toNextJsHandler(auth);

export const LOCK_THRESHOLD = 5;
export const LOCK_MINUTES = 15;

export function GET(request: NextRequest): Promise<Response> {
  return baseGET(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.endsWith("/sign-in/email")) return basePOST(request);

  let email = "";
  try {
    const body: unknown = await request.clone().json();
    if (body && typeof body === "object" && "email" in body) email = String((body as { email: unknown }).email ?? "");
  } catch {
    return basePOST(request);
  }
  const key = email.trim().toLowerCase();
  const ip = clientIp(request.headers);

  if ((key && isRateLimited(signInAccountKey(key), SIGN_IN_ACCOUNT_MAX)) || isRateLimited(signInIpKey(ip), SIGN_IN_IP_MAX)) {
    return apiError("RATE_LIMITED", GENERIC_LOCKED_MESSAGE, 429);
  }
  if (key) {
    const user = await prisma.user.findUnique({ where: { email: key } });
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      return apiError("LOCKED", GENERIC_LOCKED_MESSAGE, 423);
    }
    if (user?.isDisabled) {
      return apiError("INVALID_CREDENTIALS", GENERIC_CREDENTIALS_MESSAGE, 401);
    }
    hitRateLimit(signInAccountKey(key), SIGN_IN_ACCOUNT_MAX);
  }
  hitRateLimit(signInIpKey(ip), SIGN_IN_IP_MAX);

  const response = await basePOST(request);
  if (key) {
    if (response.ok) {
      await prisma.user.updateMany({
        where: { email: key },
        data: { failedSignInAttempts: 0, lockedUntil: null },
      });
    } else if (response.status === 401) {
      const user = await prisma.user.findUnique({ where: { email: key } });
      if (user && !user.isDisabled && (!user.lockedUntil || user.lockedUntil <= new Date())) {
        const attempts = user.failedSignInAttempts + 1;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedSignInAttempts: attempts,
            lockedUntil: attempts >= LOCK_THRESHOLD ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : user.lockedUntil,
          },
        });
      }
    }
  }
  return response;
}
