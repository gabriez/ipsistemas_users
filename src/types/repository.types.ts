import type { UserStatusType } from "./user.types.js";

/**
 * Domain User Model (Agnostic to TypeORM, Prisma, raw SQL, etc.)
 */
export interface UserRecord {
  id: string;
  email: string;
  telegram_id: string | null;
  outline_id: string | null;
  status: UserStatusType;
  is_verified: boolean;
  verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreateUserData {
  email: string;
  telegram_id?: string | null;
  outline_id?: string | null;
  status?: UserStatusType;
  is_verified?: boolean;
  verified_at?: Date | null;
}

export interface UpdateUserData {
  email?: string;
  telegram_id?: string | null;
  outline_id?: string | null;
  status?: UserStatusType;
  is_verified?: boolean;
  verified_at?: Date | null;
}

export interface UserLookupCriteria {
  id?: string;
  email?: string;
  telegram_id?: string;
  outline_id?: string;
}

export interface UserListFilter {
  page?: number;
  limit?: number;
  status?: UserStatusType;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Agnostic Port for User Database Operations
 */
export interface IUserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findByTelegramId(telegramId: string): Promise<UserRecord | null>;
  findByOutlineId(outlineId: string): Promise<UserRecord | null>;
  findByCriteria(criteria: UserLookupCriteria): Promise<UserRecord | null>;
  create(data: CreateUserData): Promise<UserRecord>;
  update(id: string, data: UpdateUserData): Promise<UserRecord>;
  findAndCount(filter: UserListFilter): Promise<PaginatedResult<UserRecord>>;
}
