import type { NextFunction, Request, Response } from "express";
import { config } from "../config/index.js";
import { UnauthorizedError } from "../utils/errors.js";

export function apiKeyAuth(req: Request, _res: Response, next: NextFunction): void {
  const configuredKey = config.security.internalApiKey;

  if (!configuredKey) {
    next(new UnauthorizedError("INTERNAL_API_KEY is not configured on server"));
    return;
  }

  const providedKey = req.header("x-api-key");

  if (!providedKey || providedKey !== configuredKey) {
    next(new UnauthorizedError("Invalid or missing API key"));
    return;
  }

  next();
}
