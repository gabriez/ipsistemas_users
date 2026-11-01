import type { z } from "zod";
import type { inviteUserSchema, requestTokenSchema, verifyTokenSchema } from "../modules/auth/auth.schema.js";

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type RequestTokenInput = z.infer<typeof requestTokenSchema>;
export type VerifyTokenInput = z.infer<typeof verifyTokenSchema>;

export interface InviteUserResponseDto {
  id: string;
  email: string;
  telegram_id: string | null;
  outline_id: string | null;
  status: string;
  is_verified: boolean;
}
