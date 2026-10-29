import { z } from "zod";
import { UserStatus } from "../../database/entities/UserEntity.js";

export const lookupUserSchema = z
  .object({
    email: z.email().trim().toLowerCase().optional(),
    id: z.uuid().trim().optional(),
    telegram_id: z.string().trim().regex(/^\d+$/, "telegram_id must be a numeric string").optional(),
  })
  .refine((data) => Boolean(data.id || data.email || data.telegram_id), {
    message: "At least one identifier (id, email, or telegram_id) must be provided",
  });

export const createUserSchema = z.object({
  email: z.email("Invalid email format").trim().toLowerCase(),
  outline_id: z.string().trim().optional(),
  status: z.enum([UserStatus.PENDING, UserStatus.ACTIVE, UserStatus.BLOCKED]).default(UserStatus.PENDING),
  telegram_id: z.string().trim().regex(/^\d+$/, "telegram_id must be a numeric string").optional(),
});

export const listUsersSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
  status: z.enum([UserStatus.PENDING, UserStatus.ACTIVE, UserStatus.BLOCKED]).optional(),
});

export type LookupUserInput = z.infer<typeof lookupUserSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
