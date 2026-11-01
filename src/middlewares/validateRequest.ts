import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";
import { BadRequestError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export interface ValidationErrorItem {
  field: string;
  message: string;
}

function formatZodIssues(error: ZodError): ValidationErrorItem[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "root",
    message: issue.message,
  }));
}

export function validateBody<T>(schema: ZodType<T>) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = formatZodIssues(error);
        (req.log ?? logger).warn({ issues }, "Request body validation failed");
        next(new BadRequestError("Validation failed", issues));
        return;
      }
      next(error);
    }
  };
}

export function validateQuery<T>(schema: ZodType<T>) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.query);
      Object.defineProperty(req, "query", {
        configurable: true,
        enumerable: true,
        value: parsed,
        writable: true,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = formatZodIssues(error);
        (req.log ?? logger).warn({ issues }, "Request query validation failed");
        next(new BadRequestError("Query validation failed", issues));
        return;
      }
      next(error);
    }
  };
}
