/**
 * Main prediction orchestration module
 * Combines RAG context retrieval with Claude prediction
 */

import { predictVote, type PredictionInput } from "@/lib/ai/claude";
import { getRAGContext } from "./rag";
import type { Prediction, MPProfile, VoteDecision } from "@/types";

// ============================================================================
// Types
// ============================================================================

export interface PredictOptions {
  billTitle: string;
  billDescription?: string;
  billFullText?: string;
}

export interface PredictResult {
  prediction: Prediction;
  ragContext: {
    similarVotesCount: number;
    speechesCount: number;
    ragError?: string;
  };
}

// ============================================================================
// Main Prediction Function
// ============================================================================

/**
 * Predict how an MP would vote on a bill
 *
 * @param mp - The MP profile (must have instruction template)
 * @param options - Bill information
 * @returns Prediction result with metadata
 */
export async function predictMPVote(
  mp: MPProfile,
  options: PredictOptions
): Promise<PredictResult> {
  const mpName = mp.info?.fullName || mp.slug;
  const mpParty = mp.info?.party?.name || "";

  // Validate MP has instruction template
  if (!mp.instruction?.promptTemplate) {
    throw new Error(
      `MP ${mpName} does not have an instruction template. Generate profile first.`
    );
  }

  // Build query text for RAG
  const queryText = [
    options.billTitle,
    options.billDescription,
    options.billFullText?.substring(0, 1000),
  ]
    .filter(Boolean)
    .join("\n\n");

  // Get RAG context (use uuid as MP identifier)
  const ragContext = await getRAGContext(queryText, mp.uuid);

  // Build prediction input
  const predictionInput: PredictionInput = {
    billTitle: options.billTitle,
    billDescription: options.billDescription || options.billTitle,
    billFullText: options.billFullText,
    similarVotes: ragContext.similarVotes.map((v) => ({
      title: v.billTitle,
      decision: v.decision,
      date: v.date.toISOString().split("T")[0],
      similarity: v.similarity,
    })),
    relevantSpeeches: ragContext.relevantSpeeches.map((s) => ({
      topic: s.topic,
      excerpt: s.excerpt,
      date: s.date.toISOString().split("T")[0],
      similarity: s.similarity,
    })),
  };

  // Get prediction from Claude
  const result = await predictVote(
    predictionInput,
    mp.instruction.promptTemplate,
    mpName
  );

  // Build response
  const prediction: Prediction = {
    mpSlug: mp.slug,
    mpName: mpName,
    party: mpParty,
    vote: result.prediction as VoteDecision,
    confidence: result.confidence,
    reasoning: {
      et: result.reasoningEt,
      en: result.reasoning,
    },
    similarVotes: ragContext.similarVotes.map((v) => ({
      votingUuid: "", // Not available from RAG
      title: v.billTitle,
      vote: v.decision,
      similarity: v.similarity,
      date: v.date,
    })),
    predictedAt: new Date(),
  };

  return {
    prediction,
    ragContext: {
      similarVotesCount: ragContext.similarVotes.length,
      speechesCount: ragContext.relevantSpeeches.length,
      ragError: ragContext.error,
    },
  };
}

/**
 * Predict votes for multiple MPs (for simulation)
 *
 * @param mps - Array of MP profiles
 * @param options - Bill information
 * @param onProgress - Optional callback for progress updates
 * @returns Array of prediction results (includes failures)
 */
export async function predictMultipleMPs(
  mps: MPProfile[],
  options: PredictOptions,
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<Array<PredictResult | { error: string; mpSlug: string }>> {
  const results: Array<PredictResult | { error: string; mpSlug: string }> = [];

  // Process in batches to avoid rate limits
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 1000;

  for (let i = 0; i < mps.length; i += BATCH_SIZE) {
    const batch = mps.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map((mp) => predictMPVote(mp, options))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      const mp = batch[j];
      const mpName = mp.info?.fullName || mp.slug;

      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        // Don't silently drop failures (fixed from v0.1)
        results.push({
          error: result.reason instanceof Error ? result.reason.message : "Unknown error",
          mpSlug: mp.slug,
        });
        console.error(`Prediction failed for ${mpName}:`, result.reason);
      }

      onProgress?.(results.length, mps.length, mpName);
    }

    // Delay between batches
    if (i + BATCH_SIZE < mps.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return results;
}
