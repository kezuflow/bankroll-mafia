import { z } from "zod";

export const heistParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const paymentBodySchema = z
  .object({
    signature: z.string().min(32).max(128),
  })
  .strict();
