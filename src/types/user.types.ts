import type { z } from "zod";
import type { createUserSchema, listUsersSchema, lookupUserSchema } from "../modules/users/users.schema.js";

export const UserStatus = {
  ACTIVE: "ACTIVE",
  BLOCKED: "BLOCKED",
  PENDING: "PENDING",
} as const;

export type UserStatusType = (typeof UserStatus)[keyof typeof UserStatus];

export type LookupUserInput = z.infer<typeof lookupUserSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;

export interface UserResponseDto {
  id: string;
  email: string;
  telegram_id: string | null;
  outline_id: string | null;
  status: UserStatusType;
  is_verified: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}
