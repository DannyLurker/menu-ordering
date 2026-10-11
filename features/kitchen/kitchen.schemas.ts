// Validation schemas for kitchen order inputs (spec 0010).
import { z } from "zod";

export const verifyOrderInputSchema = z.object({
  etaMinutes: z
    .number()
    .int("Estimated time must be a whole number · Estimasi waktu harus berupa bilangan bulat")
    .min(1, "Estimated time must be at least 1 minute · Estimasi waktu minimal 1 menit")
    .max(120, "Estimated time cannot exceed 120 minutes · Estimasi waktu maksimal 120 menit"),
});

export type VerifyOrderInput = z.infer<typeof verifyOrderInputSchema>;

export const updateEtaInputSchema = z.object({
  etaMinutes: z
    .number()
    .int("Estimated time must be a whole number · Estimasi waktu harus berupa bilangan bulat")
    .min(1, "Estimated time must be at least 1 minute · Estimasi waktu minimal 1 menit")
    .max(120, "Estimated time cannot exceed 120 minutes · Estimasi waktu maksimal 120 menit"),
});

export type UpdateEtaInput = z.infer<typeof updateEtaInputSchema>;

export const cancelOrderInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Cancel reason cannot be blank · Alasan pembatalan tidak boleh kosong")
    .max(200, "Cancel reason cannot exceed 200 characters · Alasan pembatalan maksimal 200 karakter"),
});

export type CancelOrderInput = z.infer<typeof cancelOrderInputSchema>;
