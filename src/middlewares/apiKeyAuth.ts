import type { NextFunction, Request, Response } from "express";
import { config } from "../config/index.js";
import { UnauthorizedError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function apiKeyAuth(req: Request, _res: Response, next: NextFunction): void {
  const configuredKey = config.security.internalApiKey;
  const reqLogger = req.log ?? logger;

  if (!configuredKey) {
    reqLogger.error("INTERNAL_API_KEY is not configured on server");
    next(new UnauthorizedError("INTERNAL_API_KEY is not configured on server"));
    return;
  }

  const providedKey = req.header("x-api-key");

  if (!providedKey || providedKey !== configuredKey) {
    reqLogger.warn({ hasKey: Boolean(providedKey), ip: req.ip }, "Unauthorized access attempt: invalid or missing API key");
    next(new UnauthorizedError("Invalid or missing API key"));
    return;
  }

  next();
}
