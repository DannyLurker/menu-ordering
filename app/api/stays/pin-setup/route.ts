// Guest PIN setup with the one time code (spec 0008, AC-2). Open surface:
// the setup code is the credential, throttled per stay plus per IP. The
// setup rules live in the stay service. On success a stay session is
// minted and set as a cookie so the guest is signed in immediately.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import {
  PINSETUP_IP_MAX,
  PINSETUP_STAY_MAX,
  clientIp,
  pinSetupIpKey,
  pinSetupStayKey,
  rateLimitedResponse,
  takeBudget,
} from "@/lib/rate-limit";
import { StayCheckinError, pinSetupBody, setupStayPin } from "@/features/stays";
import {
  STAY_COOKIE,
  StayAuthError,
  mintStaySession,
  stayCookieOptions,
} from "@/features/stay-session";

const CALL_DESK_MESSAGE =
  "Too many tries. Please contact the front desk. / Terlalu banyak percobaan. Hubungi resepsionis.";

export async function POST(request: NextRequest): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "Stay, code, and PIN are required.", 400);
  }
  const parsed = pinSetupBody.safeParse(rawBody);
  if (!parsed.success) {
    return apiError(
      "INVALID_INPUT",
      "Give a valid stay, setup code, and 6 digit PIN.",
      422,
    );
  }
  const { stayId, setupCode, newPin, confirmPin } = parsed.data;

  const stayBudget = takeBudget(
    pinSetupStayKey(stayId || "unknown"),
    PINSETUP_STAY_MAX,
  );

  if (!stayBudget.allowed)
    return rateLimitedResponse(stayBudget.retryAfterSec, CALL_DESK_MESSAGE);

  const ipBudget = takeBudget(
    pinSetupIpKey(clientIp(request.headers)),
    PINSETUP_IP_MAX,
  );

  if (!ipBudget.allowed)
    return rateLimitedResponse(ipBudget.retryAfterSec, CALL_DESK_MESSAGE);
  try {
    const result = await setupStayPin(
      prisma,
      stayId,
      setupCode,
      newPin,
      confirmPin,
    );

    const { token, expiresAt } = await mintStaySession(prisma, stayId, newPin);

    const response = NextResponse.json({
      ok: true,
      pinSetAt: result.pinSetAt.toISOString(),
    });
    response.cookies.set(STAY_COOKIE, token, stayCookieOptions(expiresAt));

    return response;
  } catch (err) {
    if (err instanceof StayCheckinError)
      return apiError(err.code, err.message, err.status);
    if (err instanceof StayAuthError)
      return apiError(err.code, err.message, err.status);
    throw err;
  }
}
