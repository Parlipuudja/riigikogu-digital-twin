/**
 * Types for async simulation job queue
 */

import type { Prediction, VoteDecision } from "./domain";

export type SimulationJobStatus = "pending" | "processing" | "completed" | "failed";

export interface SimulationJobRequest {
  billTitle: string;
  billDescription?: string;
  billFullText?: string;
  draftUuid?: string;  // Link to draft if simulating a real draft
}

export interface SimulationJobProgress {
  totalMPs: number;
  completedMPs: number;
  currentBatch: number;
}

export interface SimulationJobError {
  mpSlug: string;
  error: string;
}

/**
 * Bill type determines voting threshold
 * - normal: 51 votes (simple majority)
 * - constitutional: 68 votes (2/3 majority for urgent procedure)
 * - organic: 51 votes (special laws but simple majority)
 */
export type BillType = "normal" | "constitutional" | "organic";

export interface SimulationJobResult {
  draftTitle: string;
  passageProbability: number;
  totalFor: number;
  totalAgainst: number;
  totalAbstain: number;
  totalUnknown: number;
  predictions: Prediction[];
  partyBreakdown: PartyBreakdownResult[];
  swingVotes: SwingVoteResult[];
  confidenceDistribution: ConfidenceDistributionResult;
  simulatedAt: Date;
  // Vote threshold info (added for constitutional amendments)
  billType: BillType;
  votesRequired: number;  // 51 for normal, 68 for constitutional
}

export interface PartyBreakdownResult {
  party: string;
  partyCode: string;
  totalMembers: number;
  predictedFor: number;
  predictedAgainst: number;
  predictedAbstain: number;
  stance: "SUPPORTS" | "OPPOSES" | "SPLIT" | "UNKNOWN";
}

export interface SwingVoteResult {
  mpSlug: string;
  mpName: string;
  party: string;
  confidence: number;
  predictedVote: VoteDecision;
  reason: string;
}

export interface ConfidenceDistributionResult {
  high: number;
  medium: number;
  low: number;
  unknown: number;
}

/**
 * Main simulation job document stored in MongoDB
 */
export interface SimulationJob {
  _id: string;  // Job ID (UUID)
  status: SimulationJobStatus;

  request: SimulationJobRequest;

  progress: SimulationJobProgress;

  // Accumulated predictions so far
  predictions: Prediction[];
  errors: SimulationJobError[];

  // Final computed result (set when status = completed)
  result?: SimulationJobResult;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  expiresAt: Date;  // TTL: 24 hours

  // Security for self-invocation
  continuationToken: string;
  continuationCount: number;  // Max 15 (safety limit)
}

/**
 * API response for job creation
 */
export interface CreateSimulationJobResponse {
  jobId: string;
  status: SimulationJobStatus;
  progress: SimulationJobProgress;
}

/**
 * API response for job status
 */
export interface SimulationJobStatusResponse {
  jobId: string;
  status: SimulationJobStatus;
  progress: SimulationJobProgress;
  result?: SimulationJobResult;
  errors?: SimulationJobError[];
  error?: string;  // Error message if status = failed
}

/**
 * Permanent storage for completed simulations
 * Unlike SimulationJob which has 24h TTL, this persists indefinitely
 */
export interface StoredSimulation {
  _id: string;  // UUID

  // Bill identification
  billHash: string;  // Hash of normalized bill content for deduplication
  billTitle: string;
  billDescription?: string;
  billFullText?: string;

  // Optional link to a real draft
  draftUuid?: string;

  // The simulation result
  result: SimulationJobResult;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
