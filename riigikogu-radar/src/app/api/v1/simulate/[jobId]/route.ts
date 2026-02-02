import { NextResponse } from "next/server";
import { getJob } from "@/lib/simulation";
import type { ApiResponse, SimulationJobStatusResponse } from "@/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/simulate/[jobId]
 * Returns the current status and progress of a simulation job
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const requestId = crypto.randomUUID();
  const { jobId } = await params;

  try {
    const job = await getJob(jobId);

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Simulation job not found: ${jobId}`,
          },
          meta: { requestId, timestamp: new Date().toISOString() },
        },
        { status: 404 }
      );
    }

    const responseData: SimulationJobStatusResponse = {
      jobId: job._id,
      status: job.status,
      progress: job.progress,
    };

    // Include result if completed
    if (job.status === "completed" && job.result) {
      responseData.result = job.result;
    }

    // Include errors if any (except system errors which go to error field)
    const mpErrors = job.errors.filter(e => e.mpSlug !== "_system");
    if (mpErrors.length > 0) {
      responseData.errors = mpErrors;
    }

    // Include error message if failed
    if (job.status === "failed") {
      const systemError = job.errors.find(e => e.mpSlug === "_system");
      responseData.error = systemError?.error || "Job failed";
    }

    const response: ApiResponse<SimulationJobStatusResponse> = {
      success: true,
      data: responseData,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Job status fetch error:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to fetch job status",
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      { status: 500 }
    );
  }
}
