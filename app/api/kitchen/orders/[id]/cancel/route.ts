// Kitchen order cancel API route (spec 0010, AC-7, AC-11, AC-14).
// Transitions PENDING or PREPARING to KITCHEN_CANCELLED, requires reason (1 to 200 chars),
// records cancelledBy and cancelReason, and emits order.status.changed.
import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { requireStaffRole } from "@/features/staff";
import {
  KitchenServiceError,
  cancelKitchenOrder,
  cancelOrderInputSchema,
} from "@/features/kitchen";
import { checkKitchenMutationRateLimit } from "@/features/kitchen/kitchen.rate-limit";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const gate = await requireStaffRole(["KITCHEN", "ADMIN"]);
  if ("response" in gate) return gate.response;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(
      "INVALID_INPUT",
      "Valid JSON body is required · Format JSON yang valid diperlukan",
      400,
    );
  }

  const parsed = cancelOrderInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "INVALID_INPUT",
      parsed.error.issues[0]?.message || "Invalid cancel reason",
      400,
    );
  }

  const limited = checkKitchenMutationRateLimit(gate.user.id, request.headers);
  if (limited) return limited;

  try {
    const result = await cancelKitchenOrder(
      prisma,
      id,
      parsed.data.reason,
      gate.user.id,
    );
    return Response.json(result);
  } catch (err) {
    if (err instanceof KitchenServiceError) {
      return Response.json(
        {
          error: {
            code: err.code,
            message: err.message,
            currentStatus: err.currentStatus,
          },
        },
        { status: err.status },
      );
    }
    throw err;
  }
}
