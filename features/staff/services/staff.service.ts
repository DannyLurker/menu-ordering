// Staff account service (staff slice). Business rules live here: temp
// secrets, lockout counting, self guards, password rotation. Data access
// goes through the repository, so routes stay thin and any later caller
// reuses these functions instead of copying the rules.
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/client";
import { auth } from "../../../lib/auth";
import {
  GENERIC_CREDENTIALS_MESSAGE,
  GENERIC_LOCKED_MESSAGE,
} from "@/lib/api-error";
import { resetRateLimit, signInAccountKey } from "@/lib/rate-limit";
import {
  clearPasswordChangeFlag,
  deleteStaffSessions,
  findStaffByEmail,
  findStaffById,
  listStaffRows,
  resetSignInCounters,
  updateStaffRow,
} from "../repositories/staff.repository";
import {
  ROLE_HOME,
  isStaffRole,
  type StaffPublic,
  type StaffRole,
} from "../staff.types";

export const LOCK_THRESHOLD = 5;
export const LOCK_MINUTES = 15;

const TEMP_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export class StaffError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function generateTempPassword(length = 16): string {
  const bytes = randomBytes(length);
  let out = "";
  for (const b of bytes) out += TEMP_ALPHABET[b % TEMP_ALPHABET.length];
  return out;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

export { ROLE_HOME };

export async function createStaffAccount(
  db: PrismaClient,
  input: {
    name: string;
    email: string;
    role: StaffRole;
  },
): Promise<{ id: string; tempPassword: string }> {
  const email = input.email.trim().toLowerCase();
  const existing = await findStaffByEmail(db, email);
  if (existing)
    throw new StaffError(
      409,
      "EMAIL_TAKEN",
      "That email is already registered.",
    );
  const tempPassword = generateTempPassword();
  // Creation seam (spec 0006): the adapter writes the user with the role
  // and links the credential in the same shape as BetterAuth sign up, so
  // the temp hashes through the configured hasher.
  const ctx = await auth.$context;
  const created = await ctx.internalAdapter.createUser(
    { name: input.name.trim(), email, emailVerified: false, role: input.role, mustChangePassword: true },
    { method: "email-password" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: await ctx.password.hash(tempPassword),
  });
  return { id: created.id, tempPassword };
}

export async function reissueTempPassword(db: PrismaClient, userId: string): Promise<string> {
  const user = await findStaffById(db, userId);
  if (!user)
    throw new StaffError(404, "UNKNOWN_USER", "Unknown staff account.");
  const tempPassword = generateTempPassword();
  const ctx = await auth.$context;
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(tempPassword));
  await updateStaffRow(db, userId, {
    mustChangePassword: true,
    failedSignInAttempts: 0,
    lockedUntil: null,
  });
  await deleteStaffSessions(db, userId);
  return tempPassword;
}

/**
 * Pre sign in gate for the auth route wrapper. Unknown emails return null
 * so BetterAuth answers; locked or disabled accounts fail here with
 * generic messages before any password check runs.
 */
export async function checkSignInAllowed(db: PrismaClient, email: string): Promise<null> {
  const user = await findStaffByEmail(db, email);
  if (!user) return null;
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new StaffError(423, "LOCKED", GENERIC_LOCKED_MESSAGE);
  }
  if (user.isDisabled)
    throw new StaffError(
      401,
      "INVALID_CREDENTIALS",
      GENERIC_CREDENTIALS_MESSAGE,
    );
  return null;
}

export async function recordSignInSuccess(db: PrismaClient, email: string): Promise<void> {
  await resetSignInCounters(db, email);
}

/** Wrong password bookkeeping: five misses lock the account for 15 min. */
export async function recordSignInFailure(db: PrismaClient, email: string): Promise<void> {
  const user = await findStaffByEmail(db, email);
  if (
    !user ||
    user.isDisabled ||
    (user.lockedUntil && user.lockedUntil > new Date())
  )
    return;
  const attempts = user.failedSignInAttempts + 1;
  await updateStaffRow(db, user.id, {
    failedSignInAttempts: attempts,
    lockedUntil:
      attempts >= LOCK_THRESHOLD
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
        : user.lockedUntil,
  });
}

export async function changeStaffPassword(
  db: PrismaClient,
  input: {
    userId: string;
    current: string;
    next: string;
    headers: Headers;
  },
): Promise<void> {
  try {
    await auth.api.changePassword({
      body: {
        currentPassword: input.current,
        newPassword: input.next,
        revokeOtherSessions: true,
      },
      headers: input.headers,
    });
  } catch {
    throw new StaffError(
      401,
      "INVALID_CURRENT",
      "The current password is wrong.",
    );
  }
  await clearPasswordChangeFlag(db, input.userId);
}

export async function listStaffAccounts(
  db: PrismaClient,
  input: {
    take: number;
    skip: number;
  },
): Promise<{
  items: StaffPublic[];
  total: number;
}> {
  const { items, total } = await listStaffRows(db, input.take, input.skip);
  return { items: items.map(toStaffPublic), total };
}

export async function updateStaffAccount(
  db: PrismaClient,
  input: {
    adminId: string;
    targetId: string;
    role?: unknown;
    isDisabled?: unknown;
    unlock?: unknown;
  },
): Promise<StaffPublic> {
  const target = await findStaffById(db, input.targetId);
  if (!target)
    throw new StaffError(404, "UNKNOWN_USER", "Unknown staff account.");
  const data: {
    role?: StaffRole;
    isDisabled?: boolean;
    failedSignInAttempts?: number;
    lockedUntil?: null;
  } = {};
  if (input.role !== undefined) {
    if (!isStaffRole(input.role)) {
      throw new StaffError(
        422,
        "INVALID_ROLE",
        "Role must be FRONT_DESK, KITCHEN, or ADMIN.",
      );
    }
    data.role = input.role;
  }
  if (input.isDisabled !== undefined) {
    if (typeof input.isDisabled !== "boolean") {
      throw new StaffError(
        422,
        "INVALID_INPUT",
        "isDisabled must be true or false.",
      );
    }
    data.isDisabled = input.isDisabled;
  }
  if (input.unlock === true) {
    data.failedSignInAttempts = 0;
    data.lockedUntil = null;
  }
  if (Object.keys(data).length === 0)
    throw new StaffError(400, "BAD_REQUEST", "Nothing to update.");
  if (
    target.id === input.adminId &&
    ((data.role !== undefined && data.role !== "ADMIN") ||
      data.isDisabled === true)
  ) {
    throw new StaffError(
      403,
      "SELF_GUARD",
      "An admin cannot demote or disable their own account.",
    );
  }
  const updated = await updateStaffRow(db, target.id, data);
  if (input.unlock === true) {
    // Human verified recovery: the next sign in must not trip on the
    // brute force budget that caused the lock.
    resetRateLimit(signInAccountKey(updated.email));
  }
  return toStaffPublic(updated);
}
