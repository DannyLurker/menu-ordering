// Kitchen order mark ready API route (spec 0010, AC-5, AC-11, AC-14).
// Transitions PREPARING to READY and emits order.status.changed.
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaffRole } from "@/features/staff";
import { KitchenServiceError, markKitchenOrderReady } from "@/features/kitchen";
import { checkKitchenMutationRateLimit } from "@/features/kitchen/kitchen.rate-limit";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const gate = await requireStaffRole(["KITCHEN", "ADMIN"]);
  if ("response" in gate) return gate.response;

  const { id } = await context.params;

  const limited = checkKitchenMutationRateLimit(gate.user.id, request.headers);
  if (limited) return limited;

  try {
    const result = await markKitchenOrderReady(prisma, id);
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
