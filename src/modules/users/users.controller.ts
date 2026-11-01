import type { NextFunction, Request, Response } from "express";
import type { CreateUserInput, ListUsersInput, LookupUserInput } from "../../types/user.types.js";
import { usersService } from "./users.service.js";

export class UsersController {
  async lookup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await usersService.lookup(req.query as unknown as LookupUserInput);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await usersService.create(req.body as CreateUserInput);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await usersService.list(req.query as unknown as ListUsersInput);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const usersController = new UsersController();
