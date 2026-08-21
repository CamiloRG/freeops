/**
 * Standard error envelope + shared error classes for `/api/v1/...` Route
 * Handlers — app_spec.md § "API Contracts & Integrations" → "API style
 * decision": every non-2xx response is
 *   { "error": { "code": "...", "message": "...", "details"?: {...} } }
 * with the fixed HTTP-status/code table documented there (400
 * VALIDATION_ERROR, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND, 409
 * CONFLICT, 413 PAYLOAD_TOO_LARGE, 415 UNSUPPORTED_MEDIA_TYPE, 422
 * UNPROCESSABLE_ENTITY, 429 RATE_LIMITED, 500 INTERNAL_ERROR, 502
 * UPSTREAM_ERROR).
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/db/rls";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "UNPROCESSABLE_ENTITY"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_ENTITY: 422,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  INTERNAL_ERROR: 500,
};

/** Application-level error carrying an explicit API error code + status. */
export class ApiError extends Error {
  code: ApiErrorCode;
  details?: Record<string, unknown>;

  constructor(code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

export function apiErrorResponse(code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, details } }, { status: STATUS_BY_CODE[code] });
}

/**
 * Central catch handler for Route Handlers — maps known error shapes
 * (Zod validation, our own `ApiError`, unauthenticated session) to the
 * correct envelope + status, falls back to a generic 500 for anything
 * else (never leaks internal error details to the client).
 */
export function toApiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return apiErrorResponse(error.code, error.message, error.details);
  }
  if (error instanceof UnauthorizedError) {
    return apiErrorResponse("UNAUTHORIZED", error.message);
  }
  if (error instanceof ZodError) {
    const details: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "_root";
      if (!details[key]) details[key] = issue.message;
    }
    return apiErrorResponse("VALIDATION_ERROR", "Request failed validation.", details);
  }
  console.error("Unhandled API error:", error);
  return apiErrorResponse("INTERNAL_ERROR", "Something went wrong. Please try again.");
}
