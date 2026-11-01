import { Router } from "express";
import { apiKeyAuth } from "../../middlewares/apiKeyAuth.js";
import { validateBody, validateQuery } from "../../middlewares/validateRequest.js";
import { usersController } from "./users.controller.js";
import { createUserSchema, listUsersSchema, lookupUserSchema } from "./users.schema.js";

const router = Router();

router.use(apiKeyAuth);

router.get("/lookup", validateQuery(lookupUserSchema), (req, res, next) => {
  void usersController.lookup(req, res, next);
});

router.post("/", validateBody(createUserSchema), (req, res, next) => {
  void usersController.create(req, res, next);
});

router.get("/", validateQuery(listUsersSchema), (req, res, next) => {
  void usersController.list(req, res, next);
});

export default router;
