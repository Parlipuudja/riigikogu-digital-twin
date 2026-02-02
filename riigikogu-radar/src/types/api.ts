import {
  VoteDecision,
  Prediction,
  SimulationResult,
  AccuracyStats,
  MPProfile,
  Voting,
  Draft,
} from "./domain";

// ============================================================================
// API Response Wrapper
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta: ApiMeta;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "RATE_LIMIT_EXCEEDED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "PREDICTION_FAILED";

export interface ApiMeta {
  requestId: string;
  timestamp: string;
  cached?: boolean;
  rateLimit?: RateLimitInfo;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: string;
}

// ============================================================================
// Prediction Endpoints
// ============================================================================

export interface PredictRequest {
  billTitle: string;
  billDescription?: string;
  billFullText?: string;
}

export interface PredictResponse {
  prediction: Prediction;
}

export interface SimulateRequest {
  billTitle: string;
  billDescription?: string;
  billFullText?: string;
}

export interface SimulateResponse {
  simulation: SimulationResult;
}

// ============================================================================
// MP Endpoints
// ============================================================================

export interface MPListResponse {
  mps: MPSummary[];
  total: number;
}

export interface MPSummary {
  slug: string;
  name: string;
  party: string;
  partyCode: string;
  photoUrl?: string;
  isCurrentMember: boolean;
  stats?: {
    totalVotes: number;
    attendance: number;
    partyAlignmentRate: number;
  };
}

export interface MPDetailResponse {
  mp: MPProfile;
  recentVotes?: VotingWithMPDecision[];
}

export interface VotingWithMPDecision {
  uuid: string;
  title: string;
  votingTime: string;
  mpVote: VoteDecision;
  partyMajorityVote: VoteDecision;
  result: string;
}

export interface MPPredictRequest extends PredictRequest {
  // Inherits from PredictRequest
}

export interface MPPredictResponse {
  prediction: Prediction;
}

// ============================================================================
// Draft Endpoints
// ============================================================================

export interface DraftListResponse {
  drafts: DraftSummary[];
  total: number;
}

export interface DraftSummary {
  uuid: string;
  number: string;
  title: string;
  status: string;
  phase: string;
  submittedDate?: string;
  hasVotings: boolean;
}

export interface DraftDetailResponse {
  draft: Draft;
  votings?: Voting[];
}

// ============================================================================
// Analysis Endpoints
// ============================================================================

export interface AccuracyResponse {
  accuracy: AccuracyStats;
}

export interface QueryRequest {
  query: string;
  locale?: "et" | "en";
}

export interface QueryResponse {
  answer: string;
  sources: QuerySource[];
}

export interface QuerySource {
  type: "voting" | "draft" | "mp";
  id: string;
  title: string;
  relevance: number;
}
