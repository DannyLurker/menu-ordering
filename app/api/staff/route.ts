// Staff management by admin (spec 0004, AC-8). Creation sets a 16 char
// temporary password shown once; the staffer must change it before
// reaching any screen. Bodies and queries parse with zod first; the
// account rules live in the staff service.
import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { requireStaffRole } from "@/features/staff";
import {
  StaffError,
  createStaffAccount,
  createStaffBody,
  listStaffAccounts,
  staffListQuery,
} from "@/features/staff";

export async function GET(request: NextRequest): Promise<Response> {
  const gate = await requireStaffRole(["ADMIN"]);
  if ("response" in gate) return gate.response;
  const query = staffListQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!query.success) return apiError("INVALID_INPUT", "Check the paging fields and try again.", 422);
  const { items, total } = await listStaffAccounts(prisma, query.data);
  return Response.json({ items, total, take: query.data.take, skip: query.data.skip });
}

export async function POST(request: NextRequest): Promise<Response> {
  const gate = await requireStaffRole(["ADMIN"]);
  if ("response" in gate) return gate.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "Name, email, and role are required.", 400);
  }
  const parsed = createStaffBody.safeParse(body);
  if (!parsed.success) {
    const paths = parsed.error.issues.map((issue) => String(issue.path[0] ?? ""));
    if (paths.includes("role")) {
      return apiError("INVALID_ROLE", "Role must be FRONT_DESK, KITCHEN, or ADMIN.", 422);
    }
    return apiError("INVALID_INPUT", "Give a name and a valid email.", 422);
  }
  try {
    const { id, tempPassword } = await createStaffAccount(prisma, parsed.data);
    return Response.json({ id, tempPassword }, { status: 201 });
  } catch (err) {
    if (err instanceof StaffError) return apiError(err.code, err.message, err.status);
    throw err;
  }
}
