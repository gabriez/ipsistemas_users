import crypto from "node:crypto";
import { config } from "../../config/index.js";
import type { IUserRepository } from "../../types/repository.types.js";
import { UserStatus } from "../../types/user.types.js";
import type { OutlineWebhookEventPayload, WebhookHandleResult } from "../../types/webhook.types.js";
import { UnauthorizedError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

/**
 * Computes an Outline-compliant webhook signature header value:
 * Format: "t=<timestamp>,s=<hmac_sha256>"
 */
export function computeOutlineSignature(secret: string, rawBody: string, timestamp: number | string = Date.now()): string {
  const ts = String(timestamp);
  const signature = crypto.createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");

  return `t=${ts},s=${signature}`;
}

export interface IWebhookService {
  verifySignature(signatureHeader?: string, rawBody?: string): void;
  handleOutlineEvent(payload: OutlineWebhookEventPayload): Promise<WebhookHandleResult>;
}

export class WebhookService implements IWebhookService {
  constructor(private readonly userRepository: IUserRepository) {}

  /**
   * Verify Outline webhook signature (Fail-Closed).
   * Expects header 'outline-signature' with format: "t=<timestamp>,s=<signature>"
   * Throws UnauthorizedError if secret is missing, header is missing/malformed, or HMAC check fails.
   */
  verifySignature(signatureHeader?: string, rawBody?: string): void {
    const secret = config.outline.webhookSecret;
    if (!secret) {
      logger.error("OUTLINE_WEBHOOK_SECRET is not configured. Webhook rejected fail-closed.");
      throw new UnauthorizedError("Webhook verification unavailable: secret not configured");
    }

    if (!signatureHeader || !rawBody) {
      throw new UnauthorizedError("Missing outline-signature header or payload");
    }

    const parts = signatureHeader.split(",");
    const timestampPart = parts.find((p) => p.startsWith("t="));
    const sigPart = parts.find((p) => p.startsWith("s="));

    if (!timestampPart || !sigPart) {
      throw new UnauthorizedError("Malformed outline-signature header format");
    }

    const timestamp = timestampPart.slice(2);
    const expectedSignature = sigPart.slice(2);

    const computedSignature = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

    const computedBuffer = Buffer.from(computedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (computedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(computedBuffer, expectedBuffer)) {
      throw new UnauthorizedError("Invalid outline-signature HMAC");
    }
  }

  /**
   * Process incoming Outline webhook event:
   * - users.create: Outline user confirmed registration/invitation -> status ACTIVE
   * - users.activate: Re-activated user -> status ACTIVE
   * - users.suspend: Suspended user -> status BLOCKED
   */
  async handleOutlineEvent(payload: OutlineWebhookEventPayload): Promise<WebhookHandleResult> {
    const eventName = payload.name;
    const model = payload.data?.model ?? payload.model;

    logger.info({ event: eventName, model }, "Received Outline webhook event");

    if (!model) {
      logger.warn({ eventName }, "Outline webhook event payload has no user model data");
      return { handled: false };
    }

    const outlineId = model.id;
    const email = model.email?.trim().toLowerCase();

    if (!email && !outlineId) {
      logger.warn({ model }, "Outline webhook event lacks both email and outlineId");
      return { handled: false };
    }

    // Try finding the user by outline_id first, fallback to email
    let user = outlineId ? await this.userRepository.findByOutlineId(outlineId) : null;
    if (!user && email) {
      user = await this.userRepository.findByEmail(email);
    }

    if (!user) {
      logger.info({ email, event: eventName, outlineId }, "User not present in local database; skipping webhook transition");
      return { handled: false };
    }

    switch (eventName) {
      case "users.create":
      case "users.activate": {
        const updated = await this.userRepository.update(user.id, {
          is_verified: true,
          outline_id: outlineId ?? user.outline_id,
          status: UserStatus.ACTIVE,
          verified_at: new Date(),
        });
        logger.info({ email: updated.email, outline_id: updated.outline_id, status: updated.status }, "User activated via Outline webhook");
        return { action: "ACTIVATED", handled: true, userEmail: updated.email };
      }

      case "users.suspend": {
        const updated = await this.userRepository.update(user.id, {
          status: UserStatus.BLOCKED,
        });
        logger.info({ email: updated.email, outline_id: updated.outline_id, status: updated.status }, "User suspended via Outline webhook");
        return { action: "SUSPENDED", handled: true, userEmail: updated.email };
      }

      default: {
        // For other events (e.g. users.update), update outline_id if missing
        if (outlineId && !user.outline_id) {
          await this.userRepository.update(user.id, {
            outline_id: outlineId,
          });
        }
        logger.info({ email: user.email, event: eventName }, "Outline event recorded without status change");
        return { action: "RECORDED", handled: true, userEmail: user.email };
      }
    }
  }
}

import { typeOrmUserRepository } from "../../database/repositories/typeOrmUserRepository.js";
export const webhookService = new WebhookService(typeOrmUserRepository);
