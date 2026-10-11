// Stay check in input shapes (stay slice, spec 0008). Routes parse with
// these first and answer 422 on failure; services receive typed values.
import { z } from "zod";

export const createStayBody = z.object({
  roomNumber: z.string().min(1).max(20),
  guestName: z.string().min(1).max(100),
  extraNames: z.array(z.string().min(1).max(100)).max(5).optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const pinSetupBody = z.object({
  stayId: z.string().min(1),
  setupCode: z.string().min(1).max(16),
  newPin: z.string().regex(/^\d{6}$/),
  confirmPin: z.string().min(1),
});

export type CreateStayInput = z.infer<typeof createStayBody>;
export type PinSetupInput = z.infer<typeof pinSetupBody>;
