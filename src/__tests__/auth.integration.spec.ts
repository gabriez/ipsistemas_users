import "reflect-metadata";
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { is } from "zod/v4/locales";
import { createApp } from "../app.js";
import { config } from "../config/index.js";
import AppDataSource from "../database/appDataSource.js";
import { UserEntity, UserStatus } from "../database/entities/UserEntity.js";
import { outlineClient } from "../modules/outline/outline.client.js";

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
    const userRepo = AppDataSource.getRepository(UserEntity);
    await userRepo.clear();
    vi.restoreAllMocks();
  });

  describe("POST /api/v1/auth/invite", () => {
    it("should reject requests without x-api-key header", async () => {
      const response = await request(app).post("/api/v1/auth/invite").send({ email: "gabriel@ipsistemas.com", telegram_id: "123456789" });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Invalid or missing API key");
    });

    it("should invite user via Outline, save in PENDING state and link outline_id", async () => {
      const mockOutlineUser = {
        id: "914764ca-1abf-481b-9262-ea5ba3f3fc68",
        name: "Gabriel Torres",
        email: "gabriel@ipsistemas.com",
        role: "member" as const,
        createdAt: "2026-03-30T12:00:00Z",
        updatedAt: "2026-03-30T12:00:00Z",
        isSuspended: false,
      };

      vi.spyOn(outlineClient, "findUserByEmail").mockResolvedValue(null);
      vi.spyOn(outlineClient, "inviteUser").mockResolvedValue(mockOutlineUser);

      const response = await request(app).post("/api/v1/auth/invite").set("x-api-key", API_KEY).send({
        email: "gabriel@ipsistemas.com",
        telegram_id: "98765432101",
        name: "Gabriel Torres",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe("gabriel@ipsistemas.com");
      expect(response.body.data.telegram_id).toBe("98765432101");
      expect(response.body.data.status).toBe(UserStatus.PENDING);
      expect(response.body.data.is_verified).toBe(false);
      expect(response.body.data.outline_id).toBe("914764ca-1abf-481b-9262-ea5ba3f3fc68");

      const userRepo = AppDataSource.getRepository(UserEntity);
      const savedUser = await userRepo.findOne({ where: { email: "gabriel@ipsistemas.com" } });
      expect(savedUser).toBeDefined();
      expect(savedUser?.outline_id).toBe("914764ca-1abf-481b-9262-ea5ba3f3fc68");
      expect(savedUser?.status).toBe(UserStatus.PENDING);
    });

    it("should link outline_id directly if user is already found in Outline", async () => {
      const existingOutlineUser = {
        id: "77777777-1abf-481b-9262-ea5ba3f3fc68",
        name: "Existing User",
        email: "existing@ipsistemas.com",
        isSuspended: false,
        role: "member" as const,
        createdAt: "2026-03-30T12:00:00Z",
        updatedAt: "2026-03-30T12:00:00Z",
      };

      vi.spyOn(outlineClient, "findUserByEmail").mockResolvedValue(existingOutlineUser);
      const inviteSpy = vi.spyOn(outlineClient, "inviteUser");

      const response = await request(app).post("/api/v1/auth/invite").set("x-api-key", API_KEY).send({
        email: "existing@ipsistemas.com",
        telegram_id: "44445555",
      });

      expect(response.status).toBe(200);
      expect(response.body.data.outline_id).toBe("77777777-1abf-481b-9262-ea5ba3f3fc68");
      expect(inviteSpy).not.toHaveBeenCalled();
    });

    it("should reject invitation if telegram_id is already bound to another ACTIVE user", async () => {
      const userRepo = AppDataSource.getRepository(UserEntity);
      const activeUser = userRepo.create({
        email: "other@ipsistemas.com",
        telegram_id: "999999",
        status: UserStatus.ACTIVE,
        is_verified: true,
      });
      await userRepo.save(activeUser);

      const response = await request(app).post("/api/v1/auth/invite").set("x-api-key", API_KEY).send({
        email: "newperson@ipsistemas.com",
        telegram_id: "999999",
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Telegram ID is already linked to another active account");
    });
  });

  describe("Legacy OTP Endpoints Disabled (410 Gone)", () => {
    it("POST /api/v1/auth/request-token should return 410 Gone", async () => {
      const response = await request(app).post("/api/v1/auth/request-token").set("x-api-key", API_KEY).send({ email: "user@example.com" });

      expect(response.status).toBe(410);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("disabled");
    });

    it("POST /api/v1/auth/verify-token should return 410 Gone", async () => {
      const response = await request(app).post("/api/v1/auth/verify-token").set("x-api-key", API_KEY).send({ token: "123456", telegram_id: "123" });

      expect(response.status).toBe(410);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("disabled");
    });
  });
});
