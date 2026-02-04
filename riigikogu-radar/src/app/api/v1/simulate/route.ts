import { NextResponse } from "next/server";
import { getActiveMPs } from "@/lib/data/mps";
import {
  createJob,
  ensureIndexes,
  findExistingSimulation,
  generateBillHash,
  ensureSimulationIndexes,
  startProcessing,
  updateProgress,
  completeJob,
  failJob,
  saveSimulation,
} from "@/lib/simulation";
import { processBatch, calculateResult } from "@/lib/simulation/processor";
import { SimulateRequestSchema } from "@/lib/utils/validation";
import type { ApiResponse, CreateSimulationJobResponse, StoredSimulation, Prediction, SimulationJobError } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Process all MPs synchronously within timeout

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

    // Mark job as processing
    await startProcessing(job._id);

    // Process all MPs synchronously in parallel batches
    // 25 MPs parallel × 4 batches = 100 MPs in ~80-120 seconds
    const BATCH_SIZE = 25;
    const allPredictions: Prediction[] = [];
    const allErrors: SimulationJobError[] = [];

    try {
      for (let i = 0; i < mps.length; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const { predictions, errors } = await processBatch(mps, job, i);

        allPredictions.push(...predictions);
        allErrors.push(...errors);

        // Update progress in DB
        await updateProgress(job._id, predictions, errors, batchNum);
      }

      // Calculate final result
      const finalJob = { ...job, predictions: allPredictions, errors: allErrors };
      const result = calculateResult(finalJob, allPredictions);
      await completeJob(job._id, result);

      // Save to permanent history
      await saveSimulation(job.request, result, validation.data.draftUuid).catch((err) => {
        console.error("Failed to save simulation to history:", err);
      });

      // Return complete result
      return NextResponse.json(
        {
          success: true,
          data: {
            jobId: job._id,
            status: "completed",
            result,
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 200 }
      );
    } catch (processingError) {
      await failJob(job._id, processingError instanceof Error ? processingError.message : "Processing failed");
      throw processingError;
    }
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
