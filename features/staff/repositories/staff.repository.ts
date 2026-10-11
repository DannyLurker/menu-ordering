// Staff data access (staff slice). Reads, lock counters, role writes, and
// session deletes live here. Credential writes go through the BetterAuth
// seams in the service, never direct database calls (spec 0006).
// Scope rule 5: the Prisma instance is passed in, never imported here.
// Route handlers take it from `@/lib/db` and hand it to services, which
// hand it here, so tests can hand a mock instead of a live database.
import type { PrismaClient } from "@/generated/client";
import type { StaffRole } from "../staff.types";

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: StaffRole;
  failedSignInAttempts: number;
  lockedUntil: Date | null;
  mustChangePassword: boolean;
  isDisabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function findStaffByEmail(db: PrismaClient, email: string): Promise<StaffRow | null> {
  const user = await db.user.findUnique({ where: { email } });
  return user ? { ...user, role: user.role as StaffRole } : null;
}

export async function findStaffById(db: PrismaClient, id: string): Promise<StaffRow | null> {
  const user = await db.user.findUnique({ where: { id } });
  return user ? { ...user, role: user.role as StaffRole } : null;
}

export async function listStaffRows(
  db: PrismaClient,
  take: number,
  skip: number,
): Promise<{ items: StaffRow[]; total: number }> {
  const [rows, total] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "desc" }, take, skip }),
    db.user.count(),
  ]);
  return { items: rows.map((u) => ({ ...u, role: u.role as StaffRole })), total };
}

export async function updateStaffRow(
  db: PrismaClient,
  id: string,
  data: {
    role?: StaffRole;
    isDisabled?: boolean;
    failedSignInAttempts?: number;
    lockedUntil?: Date | null;
    mustChangePassword?: boolean;
  },
): Promise<StaffRow> {
  const user = await db.user.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
  return { ...user, role: user.role as StaffRole };
}

export async function deleteStaffSessions(db: PrismaClient, userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

export async function resetSignInCounters(db: PrismaClient, email: string): Promise<void> {
  await db.user.updateMany({ where: { email }, data: { failedSignInAttempts: 0, lockedUntil: null } });
}

export async function clearPasswordChangeFlag(db: PrismaClient, id: string): Promise<void> {
  await db.user.update({
    where: { id },
    data: { mustChangePassword: false, failedSignInAttempts: 0, lockedUntil: null, updatedAt: new Date() },
  });
}
