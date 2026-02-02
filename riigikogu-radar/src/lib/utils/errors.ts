import type { ApiError, ErrorCode } from "@/types";

/**
 * Create a standardized API error
 */
export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): ApiError {
  return { code, message, details };
}

/**
 * Validation error helper
 */
export function validationError(message: string, details?: Record<string, unknown>): ApiError {
  return createError("VALIDATION_ERROR", message, details);
}

/**
 * Not found error helper
 */
export function notFoundError(resource: string): ApiError {
  return createError("NOT_FOUND", `${resource} not found`);
}

/**
 * Internal error helper
 */
export function internalError(message: string = "An internal error occurred"): ApiError {
  return createError("INTERNAL_ERROR", message);
}

/**
 * Prediction failed error helper
 */
export function predictionError(message: string): ApiError {
  return createError("PREDICTION_FAILED", message);
}
