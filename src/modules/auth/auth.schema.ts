import { z } from "zod";

export const inviteUserSchema = z.object({
  email: z.email("Formato de email invalido").trim().toLowerCase(),
  telegram_id: z.string().trim().regex(/^\d+$/, "telegram_id must be a numeric string"),
  name: z.string().trim().max(100).min(0).optional(),
});

/**
 * Legacy OTP schemas (retained for backward-compatible domain logic)
 */
export const requestTokenSchema = z.object({
  email: z.email("Formato de email invalido").trim().toLowerCase(),
  telegram_id: z.string().trim().regex(/^\d+$/, "telegram_id must be a numeric string").optional(),
});

export const verifyTokenSchema = z.object({
  token: z.string().trim().min(4, "Token must be at least 4 characters").max(32, "Token must be at most 32 characters"),
  telegram_id: z.string().trim().regex(/^\d+$/, "telegram_id must be a numeric string"),
});
