import "reflect-metadata";
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { config } from "../config/index.js";
import AppDataSource from "../database/appDataSource.js";
import { UserEntity, UserStatus } from "../database/entities/UserEntity.js";
import { VerificationTokenEntity } from "../database/entities/VerificationTokenEntity.js";

describe("Auth Integration Tests", () => {
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
    const tokenRepo = AppDataSource.getRepository(VerificationTokenEntity);
    const userRepo = AppDataSource.getRepository(UserEntity);
    await tokenRepo.clear();
    await userRepo.clear();
  });

  describe("POST /api/v1/auth/request-token", () => {
    it("should reject requests without x-api-key header", async () => {
      const response = await request(app).post("/api/v1/auth/request-token").send({ email: "user@example.com" });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Invalid or missing API key");
    });

    it("should generate a 6-digit OTP token and create a user in PENDING state", async () => {
      const response = await request(app).post("/api/v1/auth/request-token").set("x-api-key", API_KEY).send({
        email: "gabriel@ipsistemas.com",
        telegram_id: "98765432101",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.email).toBe("gabriel@ipsistemas.com");
      expect(response.body.token).toMatch(/^\d{6}$/);
      expect(response.body.expires_at).toBeDefined();

      const userRepo = AppDataSource.getRepository(UserEntity);
      const user = await userRepo.findOne({
        where: { email: "gabriel@ipsistemas.com" },
      });
      expect(user).toBeDefined();
      expect(user?.status).toBe(UserStatus.PENDING);
      expect(user?.is_verified).toBe(false);
      expect(user?.telegram_id).toBe("98765432101");
    });

    it("should reject invalid email formats", async () => {
      const response = await request(app).post("/api/v1/auth/request-token").set("x-api-key", API_KEY).send({
        email: "not-an-email",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Validation failed");
    });
  });

  describe("POST /api/v1/auth/verify-token", () => {
    it("should verify token, bind telegram_id, and activate user", async () => {
      // 1. Request token first
      const reqRes = await request(app).post("/api/v1/auth/request-token").set("x-api-key", API_KEY).send({
        email: "gabriel@ipsistemas.com",
      });

      const token = reqRes.body.token as string;
      expect(token).toBeDefined();

      // 2. Verify token
      const verifyRes = await request(app).post("/api/v1/auth/verify-token").set("x-api-key", API_KEY).send({
        telegram_id: "55512345678",
        token,
      });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.user.email).toBe("gabriel@ipsistemas.com");
      expect(verifyRes.body.user.telegram_id).toBe("55512345678");
      expect(verifyRes.body.user.status).toBe(UserStatus.ACTIVE);
      expect(verifyRes.body.user.is_verified).toBe(true);
      expect(verifyRes.body.user.verified_at).toBeDefined();
    });

    it("should reject already used tokens", async () => {
      const reqRes = await request(app).post("/api/v1/auth/request-token").set("x-api-key", API_KEY).send({ email: "gabriel@ipsistemas.com" });

      const token = reqRes.body.token as string;

      // First verification succeeds
      await request(app).post("/api/v1/auth/verify-token").set("x-api-key", API_KEY).send({ telegram_id: "12345", token });

      // Second verification fails
      const secondRes = await request(app).post("/api/v1/auth/verify-token").set("x-api-key", API_KEY).send({ telegram_id: "12345", token });

      expect(secondRes.status).toBe(400);
      expect(secondRes.body.error).toBe("Invalid or already used token");
    });

    it("should reject expired tokens", async () => {
      const reqRes = await request(app).post("/api/v1/auth/request-token").set("x-api-key", API_KEY).send({ email: "expired@ipsistemas.com" });

      const token = reqRes.body.token as string;

      // Manually backdate expiration in the database
      const tokenRepo = AppDataSource.getRepository(VerificationTokenEntity);
      const tokenEntity = await tokenRepo.findOne({
        where: {},
      });
      if (tokenEntity) {
        tokenEntity.expires_at = new Date(Date.now() - 60000); // 1 minute ago
        await tokenRepo.save(tokenEntity);
      }

      const verifyRes = await request(app).post("/api/v1/auth/verify-token").set("x-api-key", API_KEY).send({ telegram_id: "12345", token });

      expect(verifyRes.status).toBe(410);
      expect(verifyRes.body.error).toBe("Verification token has expired");
    });

    it("should reject verification if telegram_id is already linked to another active user", async () => {
      const userRepo = AppDataSource.getRepository(UserEntity);
      // Create user 1 who is already ACTIVE with telegram_id 999999
      const existingUser = userRepo.create({
        email: "existing@ipsistemas.com",
        is_verified: true,
        status: UserStatus.ACTIVE,
        telegram_id: "999999",
      });
      await userRepo.save(existingUser);

      // Request token for user 2
      const reqRes = await request(app).post("/api/v1/auth/request-token").set("x-api-key", API_KEY).send({ email: "newuser@ipsistemas.com" });

      const token = reqRes.body.token as string;

      // Attempt to verify user 2 using the same telegram_id 999999
      const verifyRes = await request(app).post("/api/v1/auth/verify-token").set("x-api-key", API_KEY).send({ telegram_id: "999999", token });

      expect(verifyRes.status).toBe(409);
      expect(verifyRes.body.error).toBe("Telegram ID is already linked to another active account");
    });

    it("should reject unknown token", async () => {
      const verifyRes = await request(app)
        .post("/api/v1/auth/verify-token")
        .set("x-api-key", API_KEY)
        .send({ telegram_id: "12345", token: "999999" });

      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.error).toBe("Invalid or already used token");
    });
  });
});
