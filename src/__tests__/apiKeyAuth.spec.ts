import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../config/index.js";
import { apiKeyAuth } from "../middlewares/apiKeyAuth.js";
import { UnauthorizedError } from "../utils/errors.js";

describe("apiKeyAuth Middleware", () => {
  const expectedKey = config.security.internalApiKey;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call next with UnauthorizedError if x-api-key header is missing", () => {
    const req = { header: vi.fn().mockReturnValue(undefined) } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("should call next with UnauthorizedError if x-api-key header does not match", () => {
    const req = { header: vi.fn().mockReturnValue("wrong-key") } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("should call next() without errors if x-api-key header matches configured key", () => {
    const req = { header: vi.fn().mockReturnValue(expectedKey) } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
