/**
 * Simulation History Manager
 * Permanent storage for completed simulations with deduplication
 */

import { createHash } from "crypto";
import { getCollection } from "@/lib/data/mongodb";
import type {
  StoredSimulation,
  SimulationJobResult,
  SimulationJobRequest,
} from "@/types";

const COLLECTION_NAME = "simulations";

/**
 * Normalize bill text for consistent hashing
 * - Lowercase
 * - Remove extra whitespace
 * - Remove punctuation except essentials
 */
function normalizeBillText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

/**
 * Generate a hash from bill content for deduplication
 */
export function generateBillHash(
  billTitle: string,
  billDescription?: string,
  billFullText?: string
): string {
  const normalized = [
    normalizeBillText(billTitle),
    billDescription ? normalizeBillText(billDescription) : "",
    // For full text, just use first 2000 chars to avoid huge hash inputs
    billFullText ? normalizeBillText(billFullText.substring(0, 2000)) : "",
  ].join("|");

  return createHash("sha256").update(normalized).digest("hex").substring(0, 32);
}

/**
 * Find an existing simulation by bill hash or draft UUID
 */
export async function findExistingSimulation(
  billHash: string,
  draftUuid?: string
): Promise<StoredSimulation | null> {
  const collection = await getCollection<StoredSimulation>(COLLECTION_NAME);

  // First try to find by draft UUID (most specific match)
  if (draftUuid) {
    const byDraft = await collection.findOne({ draftUuid });
    if (byDraft) return byDraft;
  }

  // Fall back to bill hash match
  return collection.findOne({ billHash });
}

/**
 * Find simulation directly by draft UUID
 */
export async function findSimulationByDraft(
  draftUuid: string
): Promise<StoredSimulation | null> {
  const collection = await getCollection<StoredSimulation>(COLLECTION_NAME);
  return collection.findOne({ draftUuid });
}

/**
 * Save a completed simulation to permanent storage
 */
export async function saveSimulation(
  request: SimulationJobRequest,
  result: SimulationJobResult,
  draftUuid?: string
): Promise<StoredSimulation> {
  const collection = await getCollection<StoredSimulation>(COLLECTION_NAME);
  const now = new Date();

  const billHash = generateBillHash(
    request.billTitle,
    request.billDescription,
    request.billFullText
  );

  const simulation: StoredSimulation = {
    _id: crypto.randomUUID(),
    billHash,
    billTitle: request.billTitle,
    billDescription: request.billDescription,
    billFullText: request.billFullText,
    draftUuid,
    result,
    createdAt: now,
    updatedAt: now,
  };

  // Upsert: if a simulation with this hash already exists, update it
  await collection.updateOne(
    { billHash },
    { $set: simulation },
    { upsert: true }
  );

  return simulation;
}

/**
 * Link an existing simulation to a draft
 * Useful when user simulates a draft after it was already simulated ad-hoc
 */
export async function linkSimulationToDraft(
  simulationId: string,
  draftUuid: string
): Promise<void> {
  const collection = await getCollection<StoredSimulation>(COLLECTION_NAME);
  await collection.updateOne(
    { _id: simulationId },
    {
      $set: {
        draftUuid,
        updatedAt: new Date(),
      },
    }
  );
}

/**
 * Get recent simulations (for listing/admin purposes)
 */
export async function getRecentSimulations(
  limit: number = 10
): Promise<StoredSimulation[]> {
  const collection = await getCollection<StoredSimulation>(COLLECTION_NAME);
  return collection
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

/**
 * Ensure indexes exist for the simulations collection
 */
export async function ensureSimulationIndexes(): Promise<void> {
  const collection = await getCollection<StoredSimulation>(COLLECTION_NAME);

  // Unique index on bill hash for deduplication
  await collection.createIndex(
    { billHash: 1 },
    { unique: true, background: true }
  ).catch(() => {
    // Index may already exist
  });

  // Index for draft lookup
  await collection.createIndex(
    { draftUuid: 1 },
    { sparse: true, background: true }
  ).catch(() => {
    // Index may already exist
  });

  // Index for recent simulations
  await collection.createIndex(
    { createdAt: -1 },
    { background: true }
  ).catch(() => {
    // Index may already exist
  });
}
