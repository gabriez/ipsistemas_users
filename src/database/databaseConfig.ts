import type { DataSourceOptions } from "typeorm";
import { config } from "../config/index.js";
import { UserEntity } from "./entities/UserEntity.js";
import { VerificationTokenEntity } from "./entities/VerificationTokenEntity.js";

export const databaseConfig: DataSourceOptions = config.app.isTest
  ? {
      database: ":memory:",
      dropSchema: true,
      entities: [UserEntity, VerificationTokenEntity],
      logging: false,
      synchronize: true,
      type: "sqlite",
    }
  : {
      charset: "utf8mb4",
      database: config.db.database,
      entities: [UserEntity, VerificationTokenEntity],
      host: config.db.host,
      logging: config.db.logging,
      password: config.db.password,
      port: config.db.port,
      ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
      synchronize: config.db.synchronize,
      type: "mariadb",
      username: config.db.user,
    };

export const dataSourceOptionsCommon: DataSourceOptions = {
  ...databaseConfig,
};
