/**
 * Simulation Job Manager
 * CRUD operations for simulation jobs in MongoDB
 */

import { getCollection } from "@/lib/data/mongodb";
import type {
  SimulationJob,
  SimulationJobStatus,
  SimulationJobRequest,
  SimulationJobResult,
  SimulationJobError,
  Prediction,
} from "@/types";

const COLLECTION_NAME = "simulation_jobs";
const JOB_TTL_HOURS = 24;
const MAX_CONTINUATION_COUNT = 15;

/**
 * Create a new simulation job
 */
export async function createJob(request: SimulationJobRequest, totalMPs: number): Promise<SimulationJob> {
  const collection = await getCollection<SimulationJob>(COLLECTION_NAME);

  const jobId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + JOB_TTL_HOURS * 60 * 60 * 1000);

  const job: SimulationJob = {
    _id: jobId,
    status: "pending",
    request,
    progress: {
      totalMPs,
      completedMPs: 0,
      currentBatch: 0,
    },
    predictions: [],
    errors: [],
    createdAt: now,
    updatedAt: now,
    expiresAt,
    continuationToken: crypto.randomUUID(),
    continuationCount: 0,
  };

  await collection.insertOne(job);
  return job;
}

/**
 * Get a job by ID
 */
export async function getJob(jobId: string): Promise<SimulationJob | null> {
  const collection = await getCollection<SimulationJob>(COLLECTION_NAME);
  return collection.findOne({ _id: jobId });
}

/**
 * Update job status to processing
 */
export async function startProcessing(jobId: string): Promise<void> {
  const collection = await getCollection<SimulationJob>(COLLECTION_NAME);
  await collection.updateOne(
    { _id: jobId },
    {
      $set: {
        status: "processing" as SimulationJobStatus,
        updatedAt: new Date(),
      },
    }
  );
}

/**
 * Update job progress with new batch of predictions
 */
export async function updateProgress(
  jobId: string,
  predictions: Prediction[],
  errors: SimulationJobError[],
  batchNumber: number
): Promise<SimulationJob | null> {
  const collection = await getCollection<SimulationJob>(COLLECTION_NAME);

  const result = await collection.findOneAndUpdate(
    { _id: jobId },
    {
      $push: {
        predictions: { $each: predictions },
        errors: { $each: errors },
      },
      $inc: {
        "progress.completedMPs": predictions.length + errors.length,
      },
      $set: {
        "progress.currentBatch": batchNumber,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return result;
}

/**
 * Increment continuation count and regenerate token
 * Returns new token or null if max continuations exceeded
 */
export async function incrementContinuation(jobId: string, currentToken: string): Promise<string | null> {
  const collection = await getCollection<SimulationJob>(COLLECTION_NAME);

  // Verify current token and check continuation limit
  const job = await collection.findOne({ _id: jobId, continuationToken: currentToken });
  if (!job) {
    return null; // Invalid token
  }

  if (job.continuationCount >= MAX_CONTINUATION_COUNT) {
    return null; // Max continuations exceeded
  }

  const newToken = crypto.randomUUID();

  await collection.updateOne(
    { _id: jobId },
    {
      $inc: { continuationCount: 1 },
      $set: {
        continuationToken: newToken,
        updatedAt: new Date(),
      },
    }
  );

  return newToken;
}

/**
 * Mark job as completed with final result
 */
export async function completeJob(jobId: string, result: SimulationJobResult): Promise<void> {
  const collection = await getCollection<SimulationJob>(COLLECTION_NAME);
  const now = new Date();

  await collection.updateOne(
    { _id: jobId },
    {
      $set: {
        status: "completed" as SimulationJobStatus,
        result,
        completedAt: now,
        updatedAt: now,
      },
    }
  );
}

/**
 * Mark job as failed with error message
 */
export async function failJob(jobId: string, error: string): Promise<void> {
  const collection = await getCollection<SimulationJob>(COLLECTION_NAME);
  const now = new Date();

  await collection.updateOne(
    { _id: jobId },
    {
      $set: {
        status: "failed" as SimulationJobStatus,
        completedAt: now,
        updatedAt: now,
      },
      $push: {
        errors: { mpSlug: "_system", error } as SimulationJobError,
      },
    }
  );
}

/**
 * Create TTL index on expiresAt field (run once on startup)
 */
export async function ensureIndexes(): Promise<void> {
  const collection = await getCollection<SimulationJob>(COLLECTION_NAME);

  // TTL index for automatic cleanup
  await collection.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, background: true }
  ).catch(() => {
    // Index may already exist
  });

  // Index for efficient job lookups
  await collection.createIndex(
    { status: 1, createdAt: -1 },
    { background: true }
  ).catch(() => {
    // Index may already exist
  });
}
