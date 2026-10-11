// Staff account management (spec 0004). Server only: temp passwords are
// handed to the admin once in the create response and never logged.
// Password rows mirror BetterAuth sign up exactly (provider credential,
// accountId equals user id) so sign in verifies them.
import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "./db";

export type StaffRole = "FRONT_DESK" | "KITCHEN" | "ADMIN";

export const STAFF_ROLES: StaffRole[] = ["FRONT_DESK", "KITCHEN", "ADMIN"];

export const ROLE_HOME: Record<StaffRole, string> = {
  FRONT_DESK: "/stays",
  KITCHEN: "/kitchen",
  ADMIN: "/staff",
};

const TEMP_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateTempPassword(length = 16): string {
  const bytes = randomBytes(length);
  let out = "";
  for (const b of bytes) out += TEMP_ALPHABET[b % TEMP_ALPHABET.length];
  return out;
}

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as string[]).includes(value);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export interface StaffPublic {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  mustChangePassword: boolean;
  isDisabled: boolean;
}

export async function createStaffAccount(input: {
  name: string;
  email: string;
  role: StaffRole;
}): Promise<{ id: string; tempPassword: string }> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error("Email already registered.");
    (err as Error & { status?: number; code?: string }).status = 409;
    (err as Error & { status?: number; code?: string }).code = "EMAIL_TAKEN";
    throw err;
  }
  const tempPassword = generateTempPassword();
  const hash = await hashPassword(tempPassword);
  const now = new Date();
  const id = randomUUID();
  await prisma.$transaction([
    prisma.user.create({
      data: {
        id,
        name: input.name.trim(),
        email,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
        role: input.role,
        mustChangePassword: true,
        isDisabled: false,
      },
    }),
    prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: hash,
        createdAt: now,
        updatedAt: now,
      },
    }),
  ]);
  return { id, tempPassword };
}

export async function reissueTempPassword(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const err = new Error("Unknown staff account.");
    (err as Error & { status?: number; code?: string }).status = 404;
    (err as Error & { status?: number; code?: string }).code = "UNKNOWN_USER";
    throw err;
  }
  const tempPassword = generateTempPassword();
  const hash = await hashPassword(tempPassword);
  const now = new Date();
  await prisma.$transaction([
    prisma.account.updateMany({
      where: { userId, providerId: "credential" },
      data: { password: hash, updatedAt: now },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        mustChangePassword: true,
        failedSignInAttempts: 0,
        lockedUntil: null,
        updatedAt: now,
      },
    }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);
  return tempPassword;
}

export function toStaffPublic(user: {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  mustChangePassword: boolean;
  isDisabled: boolean;
}): StaffPublic {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    isDisabled: user.isDisabled,
  };
}
