import { Router } from "express";
import { webhookController } from "./webhook.controller.js";

const router = Router();

/**
 * Outline webhook receiver
 * POST /api/v1/webhooks/outline
 */
router.post("/outline", (req, res, next) => {
  void webhookController.handleOutline(req, res, next);
});

export default router;
