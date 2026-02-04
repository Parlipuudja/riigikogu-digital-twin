/**
 * Simulation Batch Processor
 * Handles processing MPs in batches with self-continuation
 */

import { getActiveMPs } from "@/lib/data/mps";
import { predictMPVote, type PredictResult } from "@/lib/prediction";
import { getPartyCode } from "@/components/data/party-badge";
import {
  getJob,
  updateProgress,
  completeJob,
  failJob,
  incrementContinuation,
  startProcessing,
} from "./job-manager";
import { saveSimulation } from "./history";
import type {
  SimulationJob,
  SimulationJobResult,
  SimulationJobError,
  Prediction,
  MPProfile,
  PartyCode,
  PartyBreakdown,
  SwingVote,
  ConfidenceDistribution,
} from "@/types";

// Process 15 MPs per batch in parallel (~20-30 seconds with Haiku)
const BATCH_SIZE = 15;
const BATCH_DELAY_MS = 100; // Reduced delay since we're not doing fire-and-forget

/**
 * Process a single batch of MPs
 */
export async function processBatch(
  mps: MPProfile[],
  job: SimulationJob,
  startIndex: number
): Promise<{ predictions: Prediction[]; errors: SimulationJobError[] }> {
  const batch = mps.slice(startIndex, startIndex + BATCH_SIZE);
  const predictions: Prediction[] = [];
  const errors: SimulationJobError[] = [];

  // Process MPs in parallel within the batch
  const results = await Promise.allSettled(
    batch.map((mp) =>
      predictMPVote(mp, {
        billTitle: job.request.billTitle,
        billDescription: job.request.billDescription,
        billFullText: job.request.billFullText,
      })
    )
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const mp = batch[i];

    if (result.status === "fulfilled") {
      predictions.push(result.value.prediction);
    } else {
      errors.push({
        mpSlug: mp.slug,
        error: result.reason instanceof Error ? result.reason.message : "Unknown error",
      });
      console.error(`Prediction failed for ${mp.slug}:`, result.reason);
    }
  }

  return { predictions, errors };
}

/**
 * Check if there are more MPs to process
 */
export function shouldContinue(job: SimulationJob, totalMPs: number): boolean {
  return job.progress.completedMPs < totalMPs;
}

/**
 * Invoke continuation endpoint via fire-and-forget fetch
 */
export async function selfInvokeContinuation(
  jobId: string,
  continuationToken: string,
  baseUrl: string
): Promise<void> {
  const url = `${baseUrl}/api/v1/simulate/${jobId}/continue`;

  // Fire-and-forget - don't await the response
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Continuation-Token": continuationToken,
    },
    body: JSON.stringify({ token: continuationToken }),
  }).catch((err) => {
    console.error(`Failed to invoke continuation for job ${jobId}:`, err);
  });
}

/**
 * Calculate final simulation result from accumulated predictions
 */
export function calculateResult(
  job: SimulationJob,
  allPredictions: Prediction[]
): SimulationJobResult {
  const predictions = allPredictions;
  const totalUnknown = job.errors.filter(e => e.mpSlug !== "_system").length;

  // Calculate totals
  const totalFor = predictions.filter((p) => p.vote === "FOR").length;
  const totalAgainst = predictions.filter((p) => p.vote === "AGAINST").length;
  const totalAbstain = predictions.filter((p) => p.vote === "ABSTAIN").length;

  // Calculate passage probability (simple majority = 51 votes)
  const passageProbability = Math.round((totalFor / 101) * 100);

  // Group by party
  const partyMap = new Map<string, { for: number; against: number; abstain: number; total: number }>();

  for (const p of predictions) {
    const existing = partyMap.get(p.party) || { for: 0, against: 0, abstain: 0, total: 0 };
    existing.total++;
    if (p.vote === "FOR") existing.for++;
    if (p.vote === "AGAINST") existing.against++;
    if (p.vote === "ABSTAIN") existing.abstain++;
    partyMap.set(p.party, existing);
  }

  const partyBreakdown: PartyBreakdown[] = Array.from(partyMap.entries()).map(
    ([party, stats]) => {
      let stance: PartyBreakdown["stance"] = "UNKNOWN";
      if (stats.for > stats.against * 2) stance = "SUPPORTS";
      else if (stats.against > stats.for * 2) stance = "OPPOSES";
      else if (stats.for > 0 || stats.against > 0) stance = "SPLIT";

      return {
        party,
        partyCode: getPartyCode(party) as PartyCode,
        totalMembers: stats.total,
        predictedFor: stats.for,
        predictedAgainst: stats.against,
        predictedAbstain: stats.abstain,
        stance,
      };
    }
  );

  // Identify swing votes (low confidence, could change outcome)
  const swingVotes: SwingVote[] = predictions
    .filter((p) => p.confidence < 60)
    .sort((a, b) => a.confidence - b.confidence)
    .slice(0, 5)
    .map((p) => ({
      mpSlug: p.mpSlug,
      mpName: p.mpName,
      party: p.party,
      confidence: p.confidence,
      predictedVote: p.vote,
      reason: `Low confidence (${p.confidence}%)`,
    }));

  // Confidence distribution
  const confidenceDistribution: ConfidenceDistribution = {
    high: predictions.filter((p) => p.confidence >= 80).length,
    medium: predictions.filter((p) => p.confidence >= 50 && p.confidence < 80).length,
    low: predictions.filter((p) => p.confidence < 50).length,
    unknown: totalUnknown,
  };

  return {
    draftTitle: job.request.billTitle,
    passageProbability,
    totalFor,
    totalAgainst,
    totalAbstain,
    totalUnknown,
    predictions,
    partyBreakdown,
    swingVotes,
    confidenceDistribution,
    simulatedAt: new Date(),
  };
}

/**
 * Main processing function - process initial batch and trigger continuation
 * Returns quickly with job started, continuation handles the rest
 */
export async function startProcessingJob(
  job: SimulationJob,
  baseUrl: string
): Promise<void> {
  try {
    // Mark job as processing
    await startProcessing(job._id);

    // Get all active MPs
    const mps = await getActiveMPs();

    if (mps.length === 0) {
      await failJob(job._id, "No active MPs found");
      return;
    }

    // Process first batch
    const { predictions, errors } = await processBatch(mps, job, 0);

    // Update job with first batch results
    const updatedJob = await updateProgress(job._id, predictions, errors, 1);

    if (!updatedJob) {
      await failJob(job._id, "Failed to update job progress");
      return;
    }

    // Check if we need to continue
    if (shouldContinue(updatedJob, mps.length)) {
      // Get new continuation token
      const newToken = await incrementContinuation(job._id, job.continuationToken);

      if (newToken) {
        // Trigger next batch (fire-and-forget)
        await selfInvokeContinuation(job._id, newToken, baseUrl);
      } else {
        await failJob(job._id, "Failed to generate continuation token");
      }
    } else {
      // All done - calculate final result
      const result = calculateResult(updatedJob, updatedJob.predictions);
      await completeJob(job._id, result);

      // Save to permanent history (with optional draft link)
      await saveSimulation(job.request, result, job.request.draftUuid).catch((err) => {
        console.error(`Failed to save simulation to history:`, err);
      });
    }
  } catch (error) {
    console.error(`Processing failed for job ${job._id}:`, error);
    await failJob(job._id, error instanceof Error ? error.message : "Processing failed");
  }
}

/**
 * Continue processing from where we left off
 */
export async function continueProcessingJob(
  jobId: string,
  continuationToken: string,
  baseUrl: string
): Promise<void> {
  try {
    // Get current job state
    const job = await getJob(jobId);

    if (!job) {
      console.error(`Job not found: ${jobId}`);
      return;
    }

    // Verify token
    if (job.continuationToken !== continuationToken) {
      console.error(`Invalid continuation token for job ${jobId}`);
      return;
    }

    // Check if already completed or failed
    if (job.status === "completed" || job.status === "failed") {
      console.log(`Job ${jobId} already ${job.status}, skipping continuation`);
      return;
    }

    // Get all active MPs
    const mps = await getActiveMPs();

    // Calculate start index
    const startIndex = job.progress.completedMPs;
    const batchNumber = job.progress.currentBatch + 1;

    // Process next batch
    const { predictions, errors } = await processBatch(mps, job, startIndex);

    // Add delay between batches to avoid rate limits
    if (predictions.length > 0) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }

    // Update job with batch results
    const updatedJob = await updateProgress(jobId, predictions, errors, batchNumber);

    if (!updatedJob) {
      await failJob(jobId, "Failed to update job progress");
      return;
    }

    // Check if we need to continue
    if (shouldContinue(updatedJob, mps.length)) {
      // Get new continuation token
      const newToken = await incrementContinuation(jobId, continuationToken);

      if (newToken) {
        // Trigger next batch (fire-and-forget)
        await selfInvokeContinuation(jobId, newToken, baseUrl);
      } else {
        // Max continuations reached - fail gracefully
        await failJob(jobId, "Maximum continuation limit reached");
      }
    } else {
      // All done - calculate final result
      const result = calculateResult(updatedJob, updatedJob.predictions);
      await completeJob(jobId, result);

      // Save to permanent history (with optional draft link)
      await saveSimulation(updatedJob.request, result, updatedJob.request.draftUuid).catch((err) => {
        console.error(`Failed to save simulation to history:`, err);
      });
    }
  } catch (error) {
    console.error(`Continuation failed for job ${jobId}:`, error);
    await failJob(jobId, error instanceof Error ? error.message : "Continuation failed");
  }
}
