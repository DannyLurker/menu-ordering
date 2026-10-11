// Guest orders API route (spec 0009).
// Authenticated via stay session cookie. POST places a new order with room PIN verification;
// GET retrieves active order history for the stay.
import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import {
  ORDER_IP_MAX,
  ORDER_STAY_MAX,
  clientIp,
  hitRateLimit,
  isRateLimited,
  orderIpKey,
  orderStayKey,
  rateLimitRetryAfter,
  rateLimitedResponse,
} from "@/lib/rate-limit";
import { STAY_COOKIE, resolveStaySession } from "@/features/stay-session";
import {
  OrderServiceError,
  createOrderInputSchema,
  getStayOrders,
  placeOrder,
} from "@/features/orders";

export async function POST(request: NextRequest): Promise<Response> {
  const token = request.cookies.get(STAY_COOKIE)?.value;
  if (!token) {
    return apiError(
      "UNAUTHORIZED",
      "Active stay session required. Please sign in to your room. / Sesi menginap aktif diperlukan. Silakan masuk ke kamar Anda.",
      401,
    );
  }

  const stayId = await resolveStaySession(prisma, token);
  if (!stayId) {
    return apiError(
      "UNAUTHORIZED",
      "Your stay session has expired or was revoked. Please sign in again. / Sesi menginap Anda telah berakhir atau dicabut. Silakan masuk kembali.",
      401,
    );
  }

  // Rate limit checks by client IP and stay
  const ip = clientIp(request.headers);
  const ipKey = orderIpKey(ip);
  if (isRateLimited(ipKey, ORDER_IP_MAX)) {
    return rateLimitedResponse(rateLimitRetryAfter(ipKey, ORDER_IP_MAX));
  }

  const stayKey = orderStayKey(stayId);
  if (isRateLimited(stayKey, ORDER_STAY_MAX)) {
    return rateLimitedResponse(rateLimitRetryAfter(stayKey, ORDER_STAY_MAX));
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(
      "BAD_REQUEST",
      "A valid order payload is required. / Data pesanan yang valid diperlukan.",
      400,
    );
  }

  const parsed = createOrderInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError(
      "INVALID_INPUT",
      parsed.error.issues[0]?.message || "Invalid order inputs.",
      422,
    );
  }

  // Hit rate limits only on structurally valid submissions
  hitRateLimit(ipKey, ORDER_IP_MAX);
  hitRateLimit(stayKey, ORDER_STAY_MAX);

  try {
    const summary = await placeOrder(prisma, stayId, parsed.data);
    return Response.json(
      {
        ok: true,
        orderId: summary.orderId,
        status: summary.status,
        placedAt: summary.placedAt.toISOString(),
        totalAmount: summary.totalAmount,
        items: summary.items,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof OrderServiceError) {
      const errorPayload: Record<string, unknown> = {
        code: err.code,
        message: err.message,
      };
      if (err.details !== undefined) {
        errorPayload.details = err.details;
      }
      return Response.json({ error: errorPayload }, { status: err.status });
    }
    throw err;
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const token = request.cookies.get(STAY_COOKIE)?.value;
  if (!token) {
    return apiError(
      "UNAUTHORIZED",
      "Active stay session required. / Sesi menginap aktif diperlukan.",
      401,
    );
  }

  const stayId = await resolveStaySession(prisma, token);
  if (!stayId) {
    return apiError(
      "UNAUTHORIZED",
      "Your stay session has expired. / Sesi menginap Anda telah berakhir.",
      401,
    );
  }

  const orders = await getStayOrders(prisma, stayId);
  return Response.json({
    orders: orders.map((o) => ({
      ...o,
      placedAt: o.placedAt.toISOString(),
      verifiedAt: o.verifiedAt ? o.verifiedAt.toISOString() : null,
    })),
  });
}

