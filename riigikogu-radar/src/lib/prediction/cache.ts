/**
 * Individual Prediction Caching
 *
 * Caches predictions at the MP+bill level to avoid redundant API calls.
 * Much more granular than simulation-level caching.
 */

import { getCollection } from "@/lib/data/mongodb";
import crypto from "crypto";
import type { Prediction, VoteDecision } from "@/types";

// ============================================================================
// Types
// ============================================================================

interface CachedPrediction {
  _id: string;
  cacheKey: string;
  mpSlug: string;
  mpUuid: string;
  billHash: string;
  prediction: Prediction;
  createdAt: Date;
  expiresAt: Date;
}

// Cache TTL: 7 days
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================================================
// Hash Generation
// ============================================================================

/**
 * Generate a hash for a bill (same logic as simulation/history.ts)
 */
export function generateBillHash(
  title: string,
  description?: string,
  fullText?: string
): string {
  const content = [title, description || "", fullText || ""].join("|");
  return crypto.createHash("sha256").update(content).digest("hex").substring(0, 16);
}

/**
 * Generate cache key for a specific MP + bill combination
 */
export function generateCacheKey(mpSlug: string, billHash: string): string {
  return `${mpSlug}:${billHash}`;
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Get a cached prediction if it exists and hasn't expired
 */
export async function getCachedPrediction(
  mpSlug: string,
  billHash: string
): Promise<Prediction | null> {
  try {
    const collection = await getCollection<CachedPrediction>("prediction_cache");
    const cacheKey = generateCacheKey(mpSlug, billHash);

    const cached = await collection.findOne({
      cacheKey,
      expiresAt: { $gt: new Date() }
    });

    if (cached) {
      return cached.prediction;
    }

    return null;
  } catch (error) {
    console.error("Error getting cached prediction:", error);
    return null;
  }
}

/**
 * Save a prediction to the cache
 */
export async function cachePrediction(
  mpSlug: string,
  mpUuid: string,
  billHash: string,
  prediction: Prediction
): Promise<void> {
  try {
    const collection = await getCollection<CachedPrediction>("prediction_cache");
    const cacheKey = generateCacheKey(mpSlug, billHash);
    const now = new Date();

    await collection.updateOne(
      { cacheKey },
      {
        $set: {
          cacheKey,
          mpSlug,
          mpUuid,
          billHash,
          prediction,
          createdAt: now,
          expiresAt: new Date(now.getTime() + CACHE_TTL_MS)
        }
      },
      { upsert: true }
    );
  } catch (error) {
    console.error("Error caching prediction:", error);
  }
}

/**
 * Get multiple cached predictions at once (batch lookup)
 */
export async function getCachedPredictions(
  mpSlugs: string[],
  billHash: string
): Promise<Map<string, Prediction>> {
  const results = new Map<string, Prediction>();

  try {
    const collection = await getCollection<CachedPrediction>("prediction_cache");
    const cacheKeys = mpSlugs.map(slug => generateCacheKey(slug, billHash));

    const cached = await collection.find({
      cacheKey: { $in: cacheKeys },
      expiresAt: { $gt: new Date() }
    }).toArray();

    for (const item of cached) {
      results.set(item.mpSlug, item.prediction);
    }
  } catch (error) {
    console.error("Error getting cached predictions:", error);
  }

  return results;
}

/**
 * Ensure indexes exist for efficient cache lookups
 */
export async function ensurePredictionCacheIndexes(): Promise<void> {
  try {
    const collection = await getCollection<CachedPrediction>("prediction_cache");

    await collection.createIndex({ cacheKey: 1 }, { unique: true });
    await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await collection.createIndex({ mpSlug: 1, billHash: 1 });
  } catch (error) {
    console.error("Error creating prediction cache indexes:", error);
  }
}

// ============================================================================
// Statistical Bypass
// ============================================================================

/**
 * Check if an MP is highly predictable (can skip AI call)
 * Returns a prediction if MP votes with party >95% of time
 */
export function getStatisticalPrediction(
  mp: {
    slug: string;
    info?: {
      fullName?: string;
      party?: { code?: string; name?: string };
      votingStats?: { partyLoyaltyPercent?: number };
    };
  },
  partyPosition?: VoteDecision
): Prediction | null {
  const loyalty = mp.info?.votingStats?.partyLoyaltyPercent;

  // Skip statistical bypass if:
  // - No loyalty data
  // - Loyalty below 95%
  // - No party position provided
  if (!loyalty || loyalty < 95 || !partyPosition) {
    return null;
  }

  const mpName = mp.info?.fullName || mp.slug;
  const partyName = mp.info?.party?.name || "party";

  return {
    mpSlug: mp.slug,
    mpName,
    party: partyName,
    vote: partyPosition,
    confidence: Math.round(loyalty * 0.9), // Slightly lower confidence than loyalty
    reasoning: {
      et: `${mpName} hääletab ${loyalty.toFixed(0)}% ajast oma fraktsiooniga. Statistiline ennustus põhineb ajaloolisel lojaalsuse mustril.`,
      en: `${mpName} votes with their faction ${loyalty.toFixed(0)}% of the time. Statistical prediction based on historical loyalty pattern.`
    },
    similarVotes: [],
    predictedAt: new Date()
  };
}
