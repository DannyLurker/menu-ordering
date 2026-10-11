// Server side staff gates (spec 0004). Role comes only from the User.role
// column; client claims never decide access. Every sensitive route calls
// requireStaffRole, and proxy.ts mirrors the same rules at the edge.
import { headers } from "next/headers";
import { auth } from "../../lib/auth";
import type { StaffRole } from "./staff.types";
import { apiError } from "@/lib/api-error";

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  mustChangePassword: boolean;
  isDisabled: boolean;
  locked: boolean;
}

function toStaffUser(raw: {
  id: string;
  name: string;
  email: string;
  role?: unknown;
  mustChangePassword?: unknown;
  isDisabled?: unknown;
  lockedUntil?: unknown;
}): StaffUser | null {
  if (
    raw.role !== "FRONT_DESK" &&
    raw.role !== "KITCHEN" &&
    raw.role !== "ADMIN"
  )
    return null;
  const lockedUntil = raw.lockedUntil instanceof Date ? raw.lockedUntil : null;
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: raw.role,
    mustChangePassword: raw.mustChangePassword === true,
    isDisabled: raw.isDisabled === true,
    locked: lockedUntil !== null && lockedUntil > new Date(),
  };
}

/** Full staff identity, or null when signed out, disabled, or locked. */
export async function getStaffUser(): Promise<StaffUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const user = toStaffUser(session.user as Parameters<typeof toStaffUser>[0]);
  if (!user || user.isDisabled || user.locked) return null;
  return user;
}

/** Same as getStaffUser but keeps flags, for gates that report precisely. */
export async function getStaffUserWithFlags(): Promise<StaffUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return toStaffUser(session.user as Parameters<typeof toStaffUser>[0]);
}

export type StaffGate = { user: StaffUser } | { response: Response };

/**
 * Route handler gate: signed in, unlocked, enabled, password current,
 * and holding one of the allowed roles. Must change users reach only
 * sign in plus password change (AC-8).
 */
export async function requireStaffRole(roles: StaffRole[]): Promise<StaffGate> {
  const user = await getStaffUserWithFlags();
  if (!user || user.isDisabled || user.locked) {
    return { response: apiError("UNAUTHORIZED", "Sign in required.", 401) };
  }
  if (user.mustChangePassword) {
    return {
      response: apiError(
        "MUST_CHANGE_PASSWORD",
        "Set a new password before continuing.",
        403,
      ),
    };
  }
  if (!roles.includes(user.role)) {
    return {
      response: apiError("FORBIDDEN", "Your role cannot use this.", 403),
    };
  }
  return { user };
}
