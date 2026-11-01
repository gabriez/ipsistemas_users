import "reflect-metadata";
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { config } from "../config/index.js";
import AppDataSource from "../database/appDataSource.js";
import { UserEntity, UserStatus } from "../database/entities/UserEntity.js";

describe("Users Integration Tests", () => {
  let app: Express;
  const API_KEY = config.security.internalApiKey;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    app = createApp();
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  beforeEach(async () => {
    const userRepo = AppDataSource.getRepository(UserEntity);
    await userRepo.clear();
  });

  describe("POST /api/v1/users", () => {
    it("should create a new user with status PENDING by default", async () => {
      const response = await request(app).post("/api/v1/users").set("x-api-key", API_KEY).send({
        email: "pedro@ipsistemas.com",
        telegram_id: "1122334455",
      });

      expect(response.status).toBe(201);
      expect(response.body.email).toBe("pedro@ipsistemas.com");
      expect(response.body.telegram_id).toBe("1122334455");
      expect(response.body.status).toBe(UserStatus.PENDING);
      expect(response.body.is_verified).toBe(false);
    });

    it("should prevent creating a duplicate email", async () => {
      await request(app).post("/api/v1/users").set("x-api-key", API_KEY).send({ email: "pedro@ipsistemas.com" });

      const duplicateResponse = await request(app).post("/api/v1/users").set("x-api-key", API_KEY).send({ email: "pedro@ipsistemas.com" });

      expect(duplicateResponse.status).toBe(409);
      expect(duplicateResponse.body.error).toBe("A user with this email already exists");
    });
  });

  describe("GET /api/v1/users/lookup", () => {
    it("should find a user by telegram_id", async () => {
      const userRepo = AppDataSource.getRepository(UserEntity);
      const user = userRepo.create({
        email: "ana@ipsistemas.com",
        is_verified: true,
        status: UserStatus.ACTIVE,
        telegram_id: "9988776655",
        verified_at: new Date(),
      });
      await userRepo.save(user);

      const response = await request(app).get("/api/v1/users/lookup?telegram_id=9988776655").set("x-api-key", API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe("ana@ipsistemas.com");
      expect(response.body.status).toBe(UserStatus.ACTIVE);
      expect(response.body.is_verified).toBe(true);
    });

    it("should find a user by email", async () => {
      const userRepo = AppDataSource.getRepository(UserEntity);
      const user = userRepo.create({
        email: "carlos@ipsistemas.com",
        status: UserStatus.PENDING,
      });
      await userRepo.save(user);

      const response = await request(app).get("/api/v1/users/lookup?email=carlos@ipsistemas.com").set("x-api-key", API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(user.id);
      expect(response.body.email).toBe("carlos@ipsistemas.com");
    });

    it("should return 404 when user is not found", async () => {
      const response = await request(app).get("/api/v1/users/lookup?email=nonexistent@ipsistemas.com").set("x-api-key", API_KEY);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });
  });

  describe("GET /api/v1/users", () => {
    it("should list users with pagination metadata", async () => {
      const userRepo = AppDataSource.getRepository(UserEntity);
      for (let i = 1; i <= 5; i++) {
        await userRepo.save(
          userRepo.create({
            email: `user${i}@ipsistemas.com`,
            status: UserStatus.ACTIVE,
          }),
        );
      }

      const response = await request(app).get("/api/v1/users?page=1&limit=2").set("x-api-key", API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(5);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.totalPages).toBe(3);
      expect(response.body.pagination.hasNextPage).toBe(true);
      expect(response.body.pagination.hasPrevPage).toBe(false);
    });
  });
});
