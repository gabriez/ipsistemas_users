import { z } from "zod";

/**
 * Metadata for paginated list responses
 */
export const paginationMetaSchema = z.object({
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
  limit: z.number().int().positive(),
  page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/**
 * Standard successful single-resource or action response envelope
 *
 * @example
 * {
 *   "success": true,
 *   "data": { "id": "uuid", "email": "user@example.com" },
 *   "message": "User retrieved successfully" // optional
 * }
 */
export function createSuccessResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    message: z.string().optional(),
    success: z.literal(true),
  });
}

/**
 * Standard successful paginated collection response envelope
 *
 * @example
 * {
 *   "success": true,
 *   "data": [{ "id": "uuid", "email": "user@example.com" }],
 *   "pagination": {
 *     "total": 100,
 *     "page": 1,
 *     "limit": 20,
 *     "totalPages": 5,
 *     "hasNextPage": true,
 *     "hasPrevPage": false
 *   }
 * }
 */
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: paginationMetaSchema,
    success: z.literal(true),
  });
}

/**
 * Item in the validation error details array
 */
export const validationIssueSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;

/**
 * Standard error response envelope
 *
 * @example
 * {
 *   "success": false,
 *   "statusCode": 400,
 *   "error": "Validation failed",
 *   "details": [
 *     { "field": "email", "message": "Invalid email address" }
 *   ]
 * }
 */
export const errorResponseSchema = z.object({
  details: z.union([z.array(validationIssueSchema), z.unknown()]).optional(),
  error: z.string(),
  statusCode: z.number().int().min(400).max(599),
  success: z.literal(false),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * Generic standard API response union (Success or Error)
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.discriminatedUnion("success", [createSuccessResponseSchema(dataSchema), errorResponseSchema]);
}
