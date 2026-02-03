import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveMPs } from "@/lib/data/mps";
import {
  createJob,
  ensureIndexes,
  findExistingSimulation,
  generateBillHash,
  ensureSimulationIndexes,
} from "@/lib/simulation";
import { SimulateRequestSchema } from "@/lib/utils/validation";
import type { ApiResponse, CreateSimulationJobResponse, StoredSimulation } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 10; // Fast return - processing happens via self-invocation

// Feature flag: Disable expensive 101-MP simulation
// Now using Haiku model (12x cheaper) - safe to enable
const SIMULATION_DISABLED = false;

/**
 * POST /api/v1/simulate
 * Creates a simulation job and starts async processing
 */
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();

  // Check if simulation is disabled
  if (SIMULATION_DISABLED) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FEATURE_DISABLED",
          message: "Parliament simulation is temporarily disabled to conserve API resources. Use individual MP predictions instead.",
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      { status: 503 }
    );
  }

  try {
    // Ensure indexes exist (idempotent)
    await ensureIndexes();

    // Parse and validate request body
    const body = await request.json();
    const validation = SimulateRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.flatten(),
          },
          meta: { requestId, timestamp: new Date().toISOString() },
        },
        { status: 400 }
      );
    }

    // Ensure history indexes exist (idempotent)
    await ensureSimulationIndexes();

    // Check for existing simulation (deduplication)
    const billHash = generateBillHash(
      validation.data.billTitle,
      validation.data.billDescription,
      validation.data.billFullText
    );

    // Get draftUuid from request if provided
    const draftUuid = validation.data.draftUuid;

    const existingSimulation = await findExistingSimulation(billHash, draftUuid);

    if (existingSimulation) {
      // Return cached result immediately
      return NextResponse.json(
        {
          success: true,
          data: {
            cached: true,
            simulationId: existingSimulation._id,
            result: existingSimulation.result,
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 200 }
      );
    }

    // Get all active MPs to determine total count
    const mps = await getActiveMPs();

    if (mps.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "No active MPs found. Generate MP profiles first.",
          },
          meta: { requestId, timestamp: new Date().toISOString() },
        },
        { status: 400 }
      );
    }

    // Create the job (no cached result found)
    const job = await createJob(
      {
        billTitle: validation.data.billTitle,
        billDescription: validation.data.billDescription,
        billFullText: validation.data.billFullText,
        draftUuid: validation.data.draftUuid,
      },
      mps.length
    );

    // Get base URL for self-invocation
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = headersList.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;

    // Trigger first batch via self-invocation (fire-and-forget)
    // This ensures the response returns immediately while processing starts in a new request
    const continueUrl = `${baseUrl}/api/v1/simulate/${job._id}/continue`;
    fetch(continueUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Continuation-Token": job.continuationToken,
      },
      body: JSON.stringify({ token: job.continuationToken }),
    }).catch((err) => {
      console.error(`Failed to trigger initial processing for job ${job._id}:`, err);
    });

    // Return job info immediately
    const responseData: CreateSimulationJobResponse = {
      jobId: job._id,
      status: job.status,
      progress: job.progress,
    };

    const response: ApiResponse<CreateSimulationJobResponse> = {
      success: true,
      data: responseData,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json(response, { status: 202 }); // 202 Accepted
  } catch (error) {
    console.error("Simulation job creation error:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to create simulation job",
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      { status: 500 }
    );
  }
}
