// Staff request schemas (staff slice). Every staff route body and query
// parses here first; handlers answer 400 or 422 on failure, services
// receive typed values and never revalidate shapes.
import { z } from "zod";

export const NEXT_PASSWORD_MIN = 10;

export const staffRole = z.enum(["FRONT_DESK", "KITCHEN", "ADMIN"]);

export const createStaffBody = z.object({
  name: z.string().trim().min(1),
  email: z.email().trim().toLowerCase(),
  role: staffRole,
});

export const updateStaffBody = z.object({
  role: staffRole.optional(),
  isDisabled: z.boolean().optional(),
  unlock: z.unknown().optional(),
});

export const reissueBody = z.object({
  userId: z.string().min(1),
});

export const passwordBody = z.object({
  current: z.string().min(1),
  next: z.string().min(NEXT_PASSWORD_MIN),
});

export const staffListQuery = z.object({
  take: z.coerce.number().int().min(1).max(100).catch(20),
  skip: z.coerce.number().int().min(0).catch(0),
});
