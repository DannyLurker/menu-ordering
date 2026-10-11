// Shared staff vocabulary (staff slice). Types and role constants live
// here so the repository, the service, and the gates share one source
// without importing each other in circles.
export type StaffRole = "FRONT_DESK" | "KITCHEN" | "ADMIN";

export const STAFF_ROLES: StaffRole[] = ["FRONT_DESK", "KITCHEN", "ADMIN"];

export const ROLE_HOME: Record<StaffRole, string> = {
  FRONT_DESK: "/stays",
  KITCHEN: "/kitchen",
  ADMIN: "/staff",
};

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as string[]).includes(value);
}

export interface StaffPublic {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  mustChangePassword: boolean;
  isDisabled: boolean;
}
