// Staff management by admin (spec 0004, AC-8). Creation sets a 16 char
// temporary password shown once; the staffer must change it before
// reaching any screen.
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { requireStaffRole } from "@/lib/staff-auth";
import { createStaffAccount, isStaffRole, isValidEmail, toStaffPublic, type StaffRole } from "@/lib/staff";

const PAGE_DEFAULT = 20;
const PAGE_MAX = 100;

export async function GET(request: NextRequest): Promise<Response> {
  const gate = await requireStaffRole(["ADMIN"]);
  if ("response" in gate) return gate.response;
  const url = new URL(request.url);
  const take = Math.min(Math.max(Number(url.searchParams.get("take")) || PAGE_DEFAULT, 1), PAGE_MAX);
  const skip = Math.max(Number(url.searchParams.get("skip")) || 0, 0);
  const [items, total] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take, skip }),
    prisma.user.count(),
  ]);
  return Response.json({
    items: items.map((u) => toStaffPublic({ ...u, role: u.role as StaffRole })),
    total,
    take,
    skip,
  });
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
  const b = (body ?? {}) as { name?: unknown; email?: unknown; role?: unknown };
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (!name || !isValidEmail(email)) {
    return apiError("INVALID_INPUT", "Give a name and a valid email.", 422);
  }
  if (!isStaffRole(b.role)) {
    return apiError("INVALID_ROLE", "Role must be FRONT_DESK, KITCHEN, or ADMIN.", 422);
  }
  try {
    const { id, tempPassword } = await createStaffAccount({ name, email, role: b.role });
    return Response.json({ id, tempPassword }, { status: 201 });
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    const code = (err as Error & { code?: string }).code ?? "CREATE_FAILED";
    return apiError(code, status === 409 ? "That email is already registered." : "Could not create the account.", status);
  }
}
