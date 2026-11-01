import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const incomingReqId = req.header("x-request-id");
  const reqId = (Array.isArray(incomingReqId) ? incomingReqId[0] : incomingReqId) || crypto.randomUUID();

  req.id = reqId;
  res.setHeader("x-request-id", reqId);

  const childLogger = logger.child({
    path: req.path,
    reqId,
  });
  req.log = childLogger;

  const startTime = performance.now();

  res.on("finish", () => {
    // Avoid spamming health check logs
    if (req.path === "/health") {
      return;
    }

    const durationMs = Number((performance.now() - startTime).toFixed(2));
    const statusCode = res.statusCode;

    const logData = {
      durationMs,
      ip: req.ip,
      method: req.method,
      statusCode,
      url: req.originalUrl || req.url,
      userAgent: req.get("user-agent"),
    };

    const message = `HTTP ${req.method} ${req.originalUrl || req.url} ${statusCode} (${durationMs}ms)`;

    if (statusCode >= 500) {
      childLogger.error(logData, message);
    } else if (statusCode >= 400) {
      childLogger.warn(logData, message);
    } else {
      childLogger.info(logData, message);
    }
  });

  next();
}
