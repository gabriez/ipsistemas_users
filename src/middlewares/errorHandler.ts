import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const reqLogger = req.log ?? logger;

  if (err instanceof HttpError) {
    if (err.statusCode >= 500) {
      reqLogger.error({ err, statusCode: err.statusCode }, err.message);
    } else {
      reqLogger.warn({ details: err.details, statusCode: err.statusCode }, err.message);
    }

    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
      statusCode: err.statusCode,
      success: false,
    });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  reqLogger.error({ err }, `Unhandled error: ${message}`);

  res.status(500).json({
    error: message,
    statusCode: 500,
    success: false,
  });
}
