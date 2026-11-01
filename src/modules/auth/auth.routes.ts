import { Router } from "express";
import { apiKeyAuth } from "../../middlewares/apiKeyAuth.js";
import { validateBody } from "../../middlewares/validateRequest.js";
import { authController } from "./auth.controller.js";
import { inviteUserSchema } from "./auth.schema.js";

const router = Router();

router.use(apiKeyAuth);

/**
 * Self-serve Outline invite endpoint
 * POST /api/v1/auth/invite
 */
router.post("/invite", validateBody(inviteUserSchema), (req, res, next) => {
  void authController.invite(req, res, next);
});

/**
 * Legacy OTP endpoints - return 410 Gone
 */
router.post("/request-token", (req, res, next) => {
  authController.requestToken(req, res, next);
});

router.post("/verify-token", (req, res, next) => {
  authController.verifyToken(req, res, next);
});

export default router;
