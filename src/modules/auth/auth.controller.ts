import type { NextFunction, Request, Response } from "express";
import type { RequestTokenInput, VerifyTokenInput } from "./auth.schema.js";
import { authService } from "./auth.service.js";

export class AuthController {
  async requestToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.requestToken(req.body as RequestTokenInput);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async verifyToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.verifyToken(req.body as VerifyTokenInput);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
