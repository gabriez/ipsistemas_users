import AppDataSource from "../../database/appDataSource.js";
import { UserEntity, UserStatus } from "../../database/entities/UserEntity.js";
import { ConflictError, NotFoundError } from "../../utils/errors.js";
import type { CreateUserInput, ListUsersInput, LookupUserInput } from "./users.schema.js";

export class UsersService {
  private userRepository = AppDataSource.getRepository(UserEntity);

  async lookup(query: LookupUserInput) {
    const whereConditions: Array<Record<string, unknown>> = [];

    if (query.id) {
      whereConditions.push({ id: query.id });
    }
    if (query.telegram_id) {
      whereConditions.push({ telegram_id: query.telegram_id });
    }
    if (query.email) {
      whereConditions.push({ email: query.email.toLowerCase() });
    }

    const user = await this.userRepository.findOne({
      where: whereConditions,
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return {
      created_at: user.created_at.toISOString(),
      email: user.email,
      id: user.id,
      is_verified: user.is_verified,
      outline_id: user.outline_id ?? null,
      status: user.status,
      telegram_id: user.telegram_id ?? null,
      updated_at: user.updated_at.toISOString(),
      verified_at: user.verified_at?.toISOString() ?? null,
    };
  }

  async create(input: CreateUserInput) {
    const email = input.email.toLowerCase();

    const existingByEmail = await this.userRepository.findOne({
      where: { email },
    });
    if (existingByEmail) {
      throw new ConflictError("A user with this email already exists");
    }

    if (input.telegram_id) {
      const existingByTelegram = await this.userRepository.findOne({
        where: { telegram_id: input.telegram_id },
      });
      if (existingByTelegram) {
        throw new ConflictError("A user with this telegram_id already exists");
      }
    }

    const user = this.userRepository.create({
      email,
      is_verified: input.status === UserStatus.ACTIVE,
      outline_id: input.outline_id ?? null,
      status: input.status,
      telegram_id: input.telegram_id ?? null,
      verified_at: input.status === UserStatus.ACTIVE ? new Date() : null,
    });

    await this.userRepository.save(user);

    return {
      created_at: user.created_at.toISOString(),
      email: user.email,
      id: user.id,
      is_verified: user.is_verified,
      outline_id: user.outline_id,
      status: user.status,
      telegram_id: user.telegram_id,
      updated_at: user.updated_at.toISOString(),
      verified_at: user.verified_at?.toISOString() ?? null,
    };
  }

  async list(query: ListUsersInput) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [users, total] = await this.userRepository.findAndCount({
      order: { created_at: "DESC" },
      skip,
      take: limit,
      where: query.status ? { status: query.status } : {},
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: users.map((user) => ({
        created_at: user.created_at.toISOString(),
        email: user.email,
        id: user.id,
        is_verified: user.is_verified,
        outline_id: user.outline_id ?? null,
        status: user.status,
        telegram_id: user.telegram_id ?? null,
        updated_at: user.updated_at.toISOString(),
        verified_at: user.verified_at?.toISOString() ?? null,
      })),
      pagination: {
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit,
        page,
        total,
        totalPages,
      },
    };
  }
}

export const usersService = new UsersService();
