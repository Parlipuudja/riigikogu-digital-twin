import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { continueProcessingJob } from "@/lib/simulation";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Keep within Vercel's default limit

/**
 * POST /api/v1/simulate/[jobId]/continue
 * Continues processing a simulation job from where it left off
 * Called by self-invocation chain
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const requestId = crypto.randomUUID();
  const { jobId } = await params;

  try {
    // Get continuation token from header or body
    const headersList = await headers();
    let continuationToken = headersList.get("X-Continuation-Token");

    if (!continuationToken) {
      // Try body
      const body = await request.json().catch(() => ({}));
      continuationToken = body.token;
    }

    if (!continuationToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing continuation token",
          },
          meta: { requestId, timestamp: new Date().toISOString() },
        },
        { status: 400 }
      );
    }

    // Get base URL for next continuation
    const host = headersList.get("host") || "localhost:3000";
    const protocol = headersList.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;

    // Continue processing (this will self-invoke again if needed)
    continueProcessingJob(jobId, continuationToken, baseUrl).catch((error) => {
      console.error(`Continuation failed for job ${jobId}:`, error);
    });

    // Return immediately - processing continues in background
    return NextResponse.json(
      {
        success: true,
        data: { message: "Continuation started" },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Continuation request error:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Continuation failed",
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      { status: 500 }
    );
  }
}
