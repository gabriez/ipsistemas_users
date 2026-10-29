import { z } from "zod";

export const requestTokenSchema = z.object({
  email: z.email("Invalid email format").trim().toLowerCase(),
  telegram_id: z.string().trim().regex(/^\d+$/, "telegram_id must be a numeric string").optional(),
});

export const verifyTokenSchema = z.object({
  token: z.string().trim().min(4, "Token must be at least 4 characters").max(32, "Token must be at most 32 characters"),
  telegram_id: z.string().trim().regex(/^\d+$/, "telegram_id must be a numeric string"),
});

export type RequestTokenInput = z.infer<typeof requestTokenSchema>;
export type VerifyTokenInput = z.infer<typeof verifyTokenSchema>;
