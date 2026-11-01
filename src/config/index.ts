import * as dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const configSchema = z.object({
  app: z.object({
    env: z.enum(["development", "production", "test"]).default("development"),
    isTest: z.boolean(),
    port: z.coerce.number().int().positive().default(3000),
  }),
  db: z.object({
    database: z.string().default("ipsistemas_users"),
    host: z.string().default("localhost"),
    logging: z.boolean().default(false),
    password: z.string().default("mariadb_password"),
    port: z.coerce.number().int().positive().default(3306),
    ssl: z.boolean().default(false),
    synchronize: z.boolean().default(false),
    type: z.enum(["mariadb", "sqlite"]).default("mariadb"),
    user: z.string().default("root"),
  }),
  security: z.object({
    internalApiKey: z.string().min(1, "INTERNAL_API_KEY must not be empty"),
    otpSecret: z.string().optional(),
  }),
  outline: z.object({
    apiUrl: z.url().default("https://app.getoutline.com"),
    apiKey: z.string().min(1, "OUTLINE_API_KEY must not be empty"),
    webhookSecret: z.string().optional(),
  }),
});

export type AppConfig = z.infer<typeof configSchema>;

function loadConfig(): AppConfig {
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true" || process.env.DB_TYPE === "sqlite";

  const rawConfig = {
    app: {
      env: process.env.NODE_ENV ?? "development",
      isTest,
      port: process.env.PORT ?? "3000",
    },
    db: {
      database: process.env.DB_DATABASE ?? "ipsistemas_users",
      host: process.env.DB_HOST ?? "localhost",
      logging: process.env.DB_LOGGING === "true",
      password: process.env.DB_PASSWORD ?? "mariadb_password",
      port: process.env.DB_PORT ?? "3306",
      ssl: process.env.DB_SSL === "true",
      synchronize: process.env.DB_SYNCHRONIZE === "true",
      type: isTest ? "sqlite" : "mariadb",
      user: process.env.DB_USER ?? "root",
    },
    security: {
      internalApiKey: process.env.INTERNAL_API_KEY ?? (isTest ? "test-secret-key" : "change_this_to_a_secure_key"),
      otpSecret: process.env.OTP_SECRET,
    },
    outline: {
      apiUrl: process.env.OUTLINE_API_URL ?? "https://app.getoutline.com",
      apiKey: process.env.OUTLINE_API_KEY ?? (isTest ? "test-outline-key" : "change_this_to_outline_key"),
      webhookSecret: process.env.OUTLINE_WEBHOOK_SECRET ?? (isTest ? "test-outline-webhook-secret" : undefined),
    },
  };

  const parsed = configSchema.parse(rawConfig);
  return Object.freeze(parsed);
}

/**
 * Global immutable Application Configuration Singleton
 */
export const config: Readonly<AppConfig> = loadConfig();

export default config;
