// Staff data access (staff slice). Reads, lock counters, role writes, and
// session deletes live here. Credential writes go through the BetterAuth
// seams in the service, never direct database calls (spec 0006).
import { prisma } from "@/lib/db";
import type { StaffRole } from "../types";

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

export async function findStaffByEmail(email: string): Promise<StaffRow | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  return user ? { ...user, role: user.role as StaffRole } : null;
}

export async function findStaffById(id: string): Promise<StaffRow | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? { ...user, role: user.role as StaffRole } : null;
}

export async function listStaffRows(take: number, skip: number): Promise<{ items: StaffRow[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take, skip }),
    prisma.user.count(),
  ]);
  return { items: rows.map((u) => ({ ...u, role: u.role as StaffRole })), total };
}

export async function updateStaffRow(
  id: string,
  data: {
    role?: StaffRole;
    isDisabled?: boolean;
    failedSignInAttempts?: number;
    lockedUntil?: Date | null;
    mustChangePassword?: boolean;
  },
): Promise<StaffRow> {
  const user = await prisma.user.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
  return { ...user, role: user.role as StaffRole };
}

export async function deleteStaffSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export async function resetSignInCounters(email: string): Promise<void> {
  await prisma.user.updateMany({ where: { email }, data: { failedSignInAttempts: 0, lockedUntil: null } });
}

export async function clearPasswordChangeFlag(id: string): Promise<void> {
  await prisma.user.update({
    where: { id },
    data: { mustChangePassword: false, failedSignInAttempts: 0, lockedUntil: null, updatedAt: new Date() },
  });
}
