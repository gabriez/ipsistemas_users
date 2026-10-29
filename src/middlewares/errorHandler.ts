import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/errors.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
      statusCode: err.statusCode,
      success: false,
    });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("Unhandled error:", err);

  res.status(500).json({
    error: message,
    statusCode: 500,
    success: false,
  });
}
