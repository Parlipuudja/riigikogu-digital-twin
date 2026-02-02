/**
 * API Response utilities
 * Provides consistent response formatting and error handling
 */

import { NextResponse } from "next/server";
import type { ApiResponse, ErrorCode } from "@/types";

/** Options for API success response */
interface ApiSuccessOptions {
  status?: number;
  /** Cache-Control max-age in seconds */
  cacheMaxAge?: number;
  /** Cache-Control stale-while-revalidate in seconds */
  cacheStaleWhileRevalidate?: number;
}

/**
 * Create a successful API response
 */
export function apiSuccess<T>(
  data: T,
  options: ApiSuccessOptions | number = 200
): NextResponse<ApiResponse<T>> {
  const { status = 200, cacheMaxAge, cacheStaleWhileRevalidate } =
    typeof options === "number" ? { status: options } : options;

  const headers: HeadersInit = {};

  if (cacheMaxAge !== undefined) {
    const parts = [`public`, `max-age=${cacheMaxAge}`];
    if (cacheStaleWhileRevalidate !== undefined) {
      parts.push(`stale-while-revalidate=${cacheStaleWhileRevalidate}`);
    }
    headers["Cache-Control"] = parts.join(", ");
  }

  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    },
    { status, headers }
  );
}

/**
 * Create an error API response
 */
export function apiError(
  code: ErrorCode,
  message: string,
  status = 500,
  details?: Record<string, unknown>
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

/**
 * Handle unknown errors consistently
 */
export function handleApiError(error: unknown, context: string): NextResponse<ApiResponse<never>> {
  console.error(`[API Error] ${context}:`, error);

  const message =
    error instanceof Error
      ? error.message
      : "An unexpected error occurred";

  return apiError("INTERNAL_ERROR", message, 500);
}

/**
 * Voting stats can have different field names depending on generation method
 * This type represents both formats
 */
export interface VotingStatsLegacy {
  total?: number;
  totalVotes?: number;
  attendance?: number;
  attendancePercent?: number;
  partyAlignment?: number;
  partyLoyaltyPercent?: number;
  distribution?: {
    FOR: number;
    AGAINST: number;
    ABSTAIN: number;
    ABSENT: number;
  };
}

/**
 * Normalized voting stats format for API responses
 */
export interface NormalizedVotingStats {
  totalVotes: number;
  attendance: number;
  partyAlignmentRate: number;
}

/**
 * Normalize voting stats from various formats to consistent API format
 */
export function normalizeVotingStats(stats: VotingStatsLegacy | undefined | null): NormalizedVotingStats | undefined {
  if (!stats) return undefined;

  return {
    totalVotes: stats.totalVotes ?? stats.total ?? 0,
    attendance: stats.attendance ?? stats.attendancePercent ?? 0,
    partyAlignmentRate: stats.partyAlignment ?? stats.partyLoyaltyPercent ?? 0,
  };
}
