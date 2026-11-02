import "reflect-metadata";
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { config } from "../config/index.js";
import AppDataSource from "../database/appDataSource.js";
import { UserEntity } from "../database/entities/UserEntity.js";
import { computeOutlineSignature } from "../modules/webhooks/webhook.service.js";
import { UserStatus } from "../types/user.types.js";

describe("Webhook Integration Tests (Outline - Strict Fail-Closed HMAC)", () => {
  let app: Express;
  const SECRET = config.outline.webhookSecret ?? "test-outline-webhook-secret";

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

  /**
   * Helper that sends a signed Outline webhook request
   */
  async function postSignedWebhook(payload: Record<string, unknown>, overrideSignature?: string) {
    const rawBody = JSON.stringify(payload);
    const signature = overrideSignature ?? computeOutlineSignature(SECRET, rawBody);

    const req = request(app).post("/api/v1/webhooks/outline").set("Content-Type", "application/json");

    if (overrideSignature !== null && signature) {
      req.set("outline-signature", signature);
    }

    return req.send(rawBody);
  }

  describe("HMAC Cryptographic Security Gatekeeping", () => {
    const samplePayload = {
      event: "users.create",
      model: {
        email: "test@ipsistemas.com",
        id: "914764ca-1abf-481b-9262-ea5ba3f3fc68",
      },
    };

    it("should reject request when outline-signature header is missing", async () => {
      const rawBody = JSON.stringify(samplePayload);
      const response = await request(app).post("/api/v1/webhooks/outline").set("Content-Type", "application/json").send(rawBody);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Missing outline-signature header");
    });

    it("should reject request when outline-signature header format is malformed", async () => {
      const response = await postSignedWebhook(samplePayload, "malformed-header-without-t-and-s");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Malformed outline-signature header format");
    });

    it("should reject request when HMAC signature is invalid", async () => {
      const invalidSignature = "t=1700000000000,s=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const response = await postSignedWebhook(samplePayload, invalidSignature);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid outline-signature HMAC");
    });

    it("should reject request when payload was tampered after signature generation", async () => {
      const originalPayload = JSON.stringify(samplePayload);
      const signature = computeOutlineSignature(SECRET, originalPayload);

      const tamperedPayload = JSON.stringify({
        ...samplePayload,
        model: { ...samplePayload.model, email: "hacked@ipsistemas.com" },
      });

      const response = await request(app)
        .post("/api/v1/webhooks/outline")
        .set("outline-signature", signature)
        .set("Content-Type", "application/json")
        .send(tamperedPayload);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("Invalid outline-signature HMAC");
    });
  });

  describe("Domain State Transitions with Valid Signature", () => {
    it("should process users.create event and transition user from PENDING to ACTIVE", async () => {
      const userRepo = AppDataSource.getRepository(UserEntity);
      const pendingUser = userRepo.create({
        email: "gabriel@ipsistemas.com",
        is_verified: false,
        status: UserStatus.PENDING,
        telegram_id: "99887766",
      });
      await userRepo.save(pendingUser);

      const webhookPayload = {
        createdAt: new Date().toISOString(),
        id: "evt_12345",
        model: {
          email: "gabriel@ipsistemas.com",
          id: "914764ca-1abf-481b-9262-ea5ba3f3fc68",
          name: "Gabriel Torres",
          role: "member",
        },
        event: "users.create",
      };

      const response = await postSignedWebhook(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.handled).toBe(true);
      expect(response.body.data.action).toBe("ACTIVATED");

      const updatedUser = await userRepo.findOne({ where: { email: "gabriel@ipsistemas.com" } });
      expect(updatedUser?.status).toBe(UserStatus.ACTIVE);
      expect(updatedUser?.is_verified).toBe(true);
      expect(updatedUser?.outline_id).toBe("914764ca-1abf-481b-9262-ea5ba3f3fc68");
      expect(updatedUser?.verified_at).toBeDefined();
    });

    it("should process users.activate event and transition user to ACTIVE", async () => {
      const userRepo = AppDataSource.getRepository(UserEntity);
      const blockedUser = userRepo.create({
        email: "reactivated@ipsistemas.com",
        is_verified: false,
        outline_id: "55555555-1abf-481b-9262-ea5ba3f3fc68",
        status: UserStatus.BLOCKED,
        telegram_id: "55443322",
      });
      await userRepo.save(blockedUser);

      const webhookPayload = {
        model: {
          email: "reactivated@ipsistemas.com",
          id: "55555555-1abf-481b-9262-ea5ba3f3fc68",
        },
        event: "users.activate",
      };

      const response = await postSignedWebhook(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.data.action).toBe("ACTIVATED");

      const updatedUser = await userRepo.findOne({ where: { email: "reactivated@ipsistemas.com" } });
      expect(updatedUser?.status).toBe(UserStatus.ACTIVE);
      expect(updatedUser?.is_verified).toBe(true);
    });

    it("should process users.suspend event and transition user to BLOCKED", async () => {
      const userRepo = AppDataSource.getRepository(UserEntity);
      const activeUser = userRepo.create({
        email: "suspended@ipsistemas.com",
        is_verified: true,
        outline_id: "88888888-1abf-481b-9262-ea5ba3f3fc68",
        status: UserStatus.ACTIVE,
        telegram_id: "112233",
      });
      await userRepo.save(activeUser);

      const webhookPayload = {
        model: {
          email: "suspended@ipsistemas.com",
          id: "88888888-1abf-481b-9262-ea5ba3f3fc68",
        },
        event: "users.suspend",
      };

      const response = await postSignedWebhook(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.data.action).toBe("SUSPENDED");

      const updatedUser = await userRepo.findOne({ where: { email: "suspended@ipsistemas.com" } });
      expect(updatedUser?.status).toBe(UserStatus.BLOCKED);
    });

    it("should process users.update and link outline_id without mutating status", async () => {
      const userRepo = AppDataSource.getRepository(UserEntity);
      const pendingUser = userRepo.create({
        email: "pending@ipsistemas.com",
        is_verified: false,
        status: UserStatus.PENDING,
        telegram_id: "778899",
      });
      await userRepo.save(pendingUser);

      const webhookPayload = {
        model: {
          email: "pending@ipsistemas.com",
          id: "33333333-1abf-481b-9262-ea5ba3f3fc68",
        },
        event: "users.update",
      };

      const response = await postSignedWebhook(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.data.action).toBe("RECORDED");

      const updatedUser = await userRepo.findOne({ where: { email: "pending@ipsistemas.com" } });
      expect(updatedUser?.status).toBe(UserStatus.PENDING);
      expect(updatedUser?.outline_id).toBe("33333333-1abf-481b-9262-ea5ba3f3fc68");
    });

    it("should ignore event gracefully when user does not exist in local database", async () => {
      const webhookPayload = {
        model: {
          email: "unknown@ipsistemas.com",
          id: "00000000-0000-0000-0000-000000000000",
        },
        event: "users.create",
      };

      const response = await postSignedWebhook(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.data.handled).toBe(false);
    });
  });
});
