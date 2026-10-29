import type { DataSourceOptions } from "typeorm";
import { UserEntity } from "./entities/UserEntity.js";
import { VerificationTokenEntity } from "./entities/VerificationTokenEntity.js";

export const DB_HOST = process.env.DB_HOST ?? "localhost";
export const DB_PORT = Number(process.env.DB_PORT ?? "5432");
export const DB_USER = process.env.DB_USER ?? "postgres";
export const DB_PASSWORD = process.env.DB_PASSWORD ?? "postgres";
export const DB_DATABASE = process.env.DB_DATABASE ?? "ipsistemas_users";

export const isTestEnv = process.env.NODE_ENV === "test" || process.env.VITEST === "true" || process.env.DB_TYPE === "sqlite";

export const databaseConfig: DataSourceOptions = isTestEnv
  ? {
      database: ":memory:",
      dropSchema: true,
      entities: [UserEntity, VerificationTokenEntity],
      logging: false,
      synchronize: true,
      type: "sqlite",
    }
  : {
      database: DB_DATABASE,
      entities: [UserEntity, VerificationTokenEntity],
      host: DB_HOST,
      logging: process.env.DB_LOGGING === "true",
      password: DB_PASSWORD,
      port: DB_PORT,
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      synchronize: process.env.DB_SYNCHRONIZE === "true",
      type: "postgres",
      username: DB_USER,
    };

export const dataSourceOptionsCommon: DataSourceOptions = {
  ...databaseConfig,
};
