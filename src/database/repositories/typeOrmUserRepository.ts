import type { Repository } from "typeorm";
import AppDataSource from "../../database/appDataSource.js";
import { UserEntity } from "../../database/entities/UserEntity.js";
import type {
  CreateUserData,
  IUserRepository,
  PaginatedResult,
  UpdateUserData,
  UserListFilter,
  UserLookupCriteria,
  UserRecord,
} from "../../types/repository.types.js";
import { UserStatus } from "../../types/user.types.js";

export class TypeOrmUserRepository implements IUserRepository {
  private repo: Repository<UserEntity>;

  constructor(repository?: Repository<UserEntity>) {
    this.repo = repository ?? AppDataSource.getRepository(UserEntity);
  }

  private toDomain(entity: UserEntity): UserRecord {
    return {
      created_at: entity.created_at,
      deleted_at: entity.deleted_at ?? null,
      email: entity.email,
      id: entity.id,
      is_verified: entity.is_verified,
      outline_id: entity.outline_id ?? null,
      status: entity.status,
      telegram_id: entity.telegram_id ?? null,
      updated_at: entity.updated_at,
      verified_at: entity.verified_at ?? null,
    };
  }

  async findById(id: string): Promise<UserRecord | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.trim().toLowerCase();
    const entity = await this.repo.findOne({ where: { email: normalized } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByTelegramId(telegramId: string): Promise<UserRecord | null> {
    const entity = await this.repo.findOne({ where: { telegram_id: telegramId.trim() } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByOutlineId(outlineId: string): Promise<UserRecord | null> {
    const entity = await this.repo.findOne({ where: { outline_id: outlineId.trim() } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByCriteria(criteria: UserLookupCriteria): Promise<UserRecord | null> {
    const whereConditions: Array<Record<string, unknown>> = [];

    if (criteria.id) {
      whereConditions.push({ id: criteria.id });
    }
    if (criteria.telegram_id) {
      whereConditions.push({ telegram_id: criteria.telegram_id.trim() });
    }
    if (criteria.outline_id) {
      whereConditions.push({ outline_id: criteria.outline_id.trim() });
    }
    if (criteria.email) {
      whereConditions.push({ email: criteria.email.trim().toLowerCase() });
    }

    if (whereConditions.length === 0) {
      return null;
    }

    const entity = await this.repo.findOne({ where: whereConditions });
    return entity ? this.toDomain(entity) : null;
  }

  async create(data: CreateUserData): Promise<UserRecord> {
    const entity = this.repo.create({
      email: data.email.trim().toLowerCase(),
      is_verified: data.is_verified ?? false,
      outline_id: data.outline_id ?? null,
      status: data.status ?? UserStatus.PENDING,
      telegram_id: data.telegram_id ?? null,
      verified_at: data.verified_at ?? null,
    });

    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async update(id: string, data: UpdateUserData): Promise<UserRecord> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new Error(`User with id ${id} not found for update`);
    }

    if (data.email !== undefined) {
      entity.email = data.email.trim().toLowerCase();
    }
    if (data.telegram_id !== undefined) {
      entity.telegram_id = data.telegram_id;
    }
    if (data.outline_id !== undefined) {
      entity.outline_id = data.outline_id;
    }
    if (data.status !== undefined) {
      entity.status = data.status;
    }
    if (data.is_verified !== undefined) {
      entity.is_verified = data.is_verified;
    }
    if (data.verified_at !== undefined) {
      entity.verified_at = data.verified_at;
    }

    const updated = await this.repo.save(entity);
    return this.toDomain(updated);
  }

  async findAndCount(filter: UserListFilter): Promise<PaginatedResult<UserRecord>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const [entities, total] = await this.repo.findAndCount({
      order: { created_at: "DESC" },
      skip,
      take: limit,
      where: filter.status ? { status: filter.status } : {},
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: entities.map((e) => this.toDomain(e)),
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

export const typeOrmUserRepository = new TypeOrmUserRepository();
