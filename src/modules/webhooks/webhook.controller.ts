import type { NextFunction, Request, Response } from "express";
import type { OutlineWebhookEventPayload } from "../../types/webhook.types.js";
import { UnauthorizedError } from "../../utils/errors.js";
import { webhookService } from "./webhook.service.js";

export class WebhookController {
  async handleOutline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signatureHeader = req.header("outline-signature");

      if (!signatureHeader) {
        throw new UnauthorizedError("Missing outline-signature header");
      }

      const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);

      webhookService.verifySignature(signatureHeader, rawBody);

      const result = await webhookService.handleOutlineEvent(req.body as OutlineWebhookEventPayload);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const webhookController = new WebhookController();
