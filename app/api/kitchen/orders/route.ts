// Kitchen orders list API route (spec 0010).
// GET returns active orders (PENDING plus PREPARING), and optionally recent completed orders.
// Accessible to KITCHEN, ADMIN, and FRONT_DESK (read only) roles.
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaffRole } from "@/features/staff";
import { getActiveKitchenOrders } from "@/features/kitchen";

export async function GET(request: NextRequest): Promise<Response> {
  const gate = await requireStaffRole(["KITCHEN", "ADMIN", "FRONT_DESK"]);
  if ("response" in gate) return gate.response;

  const { searchParams } = new URL(request.url);
  const includeCompleted =
    searchParams.get("include") === "completed" ||
    searchParams.get("completed") === "true";

  const orders = await getActiveKitchenOrders(prisma, includeCompleted);

  return Response.json({
    ok: true,
    orders,
  });
}
