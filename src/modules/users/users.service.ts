import type { IUserRepository, PaginatedResult, UserRecord } from "../../types/repository.types.js";
import type { CreateUserInput, ListUsersInput, LookupUserInput, UserResponseDto } from "../../types/user.types.js";
import { UserStatus } from "../../types/user.types.js";
import { ConflictError, NotFoundError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

export interface IUsersService {
  lookup(query: LookupUserInput): Promise<UserResponseDto>;
  create(input: CreateUserInput): Promise<UserResponseDto>;
  list(query: ListUsersInput): Promise<PaginatedResult<UserResponseDto>>;
}

export class UsersService implements IUsersService {
  constructor(private readonly userRepository: IUserRepository) {}

  private toDto(user: UserRecord): UserResponseDto {
    return {
      created_at: user.created_at.toISOString(),
      email: user.email,
      id: user.id,
      is_verified: user.is_verified,
      outline_id: user.outline_id ?? null,
      status: user.status,
      telegram_id: user.telegram_id ?? null,
      updated_at: user.updated_at.toISOString(),
      verified_at: user.verified_at ? user.verified_at.toISOString() : null,
    };
  }

  async lookup(query: LookupUserInput): Promise<UserResponseDto> {
    logger.debug({ query }, "Executing user lookup query");
    const user = await this.userRepository.findByCriteria({
      email: query.email,
      id: query.id,
      outline_id: query.outline_id,
      telegram_id: query.telegram_id,
    });

    if (!user) {
      logger.warn({ query }, "User lookup returned no matching user");
      throw new NotFoundError("User not found");
    }

    logger.debug({ email: user.email, id: user.id }, "User lookup matched record");
    return this.toDto(user);
  }

  async create(input: CreateUserInput): Promise<UserResponseDto> {
    const email = input.email.toLowerCase();

    const existingByEmail = await this.userRepository.findByEmail(email);
    if (existingByEmail) {
      logger.warn({ email }, "User creation rejected: email already exists");
      throw new ConflictError("A user with this email already exists");
    }

    if (input.telegram_id) {
      const existingByTelegram = await this.userRepository.findByTelegramId(input.telegram_id);
      if (existingByTelegram) {
        logger.warn({ telegram_id: input.telegram_id }, "User creation rejected: telegram_id already exists");
        throw new ConflictError("A user with this telegram_id already exists");
      }
    }

    const created = await this.userRepository.create({
      email,
      is_verified: input.status === UserStatus.ACTIVE,
      outline_id: input.outline_id ?? null,
      status: input.status,
      telegram_id: input.telegram_id ?? null,
      verified_at: input.status === UserStatus.ACTIVE ? new Date() : null,
    });

    logger.info({ email: created.email, id: created.id, status: created.status }, "User created successfully");
    return this.toDto(created);
  }

  async list(query: ListUsersInput): Promise<PaginatedResult<UserResponseDto>> {
    const result = await this.userRepository.findAndCount({
      limit: query.limit,
      page: query.page,
      status: query.status,
    });

    logger.debug({ limit: query.limit, page: query.page, total: result.pagination.total }, "Retrieved paginated users list");

    return {
      data: result.data.map((u) => this.toDto(u)),
      pagination: result.pagination,
    };
  }
}

import { typeOrmUserRepository } from "../../database/repositories/typeOrmUserRepository.js";
export const usersService = new UsersService(typeOrmUserRepository);
