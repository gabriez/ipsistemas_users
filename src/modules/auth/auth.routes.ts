import { Router } from "express";
import { apiKeyAuth } from "../../middlewares/apiKeyAuth.js";
import { validateBody } from "../../middlewares/validateRequest.js";
import { authController } from "./auth.controller.js";
import { requestTokenSchema, verifyTokenSchema } from "./auth.schema.js";

const router = Router();

router.use(apiKeyAuth);

router.post("/request-token", validateBody(requestTokenSchema), (req, res, next) => {
  void authController.requestToken(req, res, next);
});

router.post("/verify-token", validateBody(verifyTokenSchema), (req, res, next) => {
  void authController.verifyToken(req, res, next);
});

export default router;
