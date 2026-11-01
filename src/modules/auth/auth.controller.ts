import type { NextFunction, Request, Response } from "express";
import type { InviteUserInput } from "../../types/auth.types.js";
import { GoneError } from "../../utils/errors.js";
import { authService } from "./auth.service.js";

export class AuthController {
  async invite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.invite(req.body as InviteUserInput);
      res.status(200).json({
        success: true,
        data: result,
        message: "Invitation sent successfully via Outline",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Legacy OTP endpoints: Disabled in favor of the self-serve Outline flow
   */
  requestToken(_req: Request, _res: Response, next: NextFunction): void {
    next(new GoneError("OTP token requests are disabled. Use /api/v1/auth/invite instead."));
  }

  verifyToken(_req: Request, _res: Response, next: NextFunction): void {
    next(new GoneError("OTP token verification is disabled. Verification is handled via Outline webhook."));
  }
}

export const authController = new AuthController();
