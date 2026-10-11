// Stay session request schemas (stay session slice). The mint body
// parses here first; handlers answer 400 or 422 on failure, the service
// receives typed values and never revalidates shapes.
import { z } from "zod";

export const mintBody = z.object({
  stayId: z.string().min(1),
  pin: z.string().regex(/^\d{6}$/),
});
