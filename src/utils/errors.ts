export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Bad Request", details?: unknown) {
    super(400, message, details);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized", details?: unknown) {
    super(401, message, details);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden", details?: unknown) {
    super(403, message, details);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not Found", details?: unknown) {
    super(404, message, details);
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Conflict", details?: unknown) {
    super(409, message, details);
  }
}

export class GoneError extends HttpError {
  constructor(message = "Gone", details?: unknown) {
    super(410, message, details);
  }
}
