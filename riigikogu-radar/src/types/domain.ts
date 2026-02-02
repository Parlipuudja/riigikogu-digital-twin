import { ObjectId } from "mongodb";

// ============================================================================
// Party and Search Types
// ============================================================================

export interface MPParty {
  code: string;
  name: string;
  nameEn: string;
}

export interface MPSearchResult {
  uuid: string;
  firstName: string;
  lastName: string;
  fullName: string;
  party: MPParty;
  photoUrl: string | null;
  isCurrentMember: boolean;
}

// ============================================================================
// Core Domain Entities
// ============================================================================

/**
 * Member of Parliament profile
 */
export interface MP {
  _id: ObjectId;
  slug: string;
  memberUuid: string;

  // Basic info
  name: string;
  firstName: string;
  lastName: string;
  party: string;
  partyCode: PartyCode;
  photoUrl?: string;

  // Status
  status: MPStatus;
  isCurrentMember: boolean;
  memberSince?: Date;

  // AI-generated profile
  instruction?: MPInstruction;

  // Computed stats
  stats?: MPStats;

  // Backtest results
  backtest?: BacktestResult;

  createdAt: Date;
  updatedAt: Date;
}

export type MPStatus = "pending" | "generating" | "active" | "error" | "inactive";

export type PartyCode =
  | "reform"
  | "ekre"
  | "centre"
  | "isamaa"
  | "sde"
  | "eesti200"
  | "other";

export interface MPInstruction {
  promptTemplate: string;
  politicalProfile: PoliticalProfile;
  keyIssues: string[];
  decisionFactors: string[];
  partyLoyalty: number;
  generatedAt: Date;
}

export interface PoliticalProfile {
  economicAxis: number;  // -1 (left) to 1 (right)
  socialAxis: number;    // -1 (liberal) to 1 (conservative)
  euAxis: number;        // -1 (skeptic) to 1 (federalist)
  defenseAxis: number;   // -1 (dovish) to 1 (hawkish)
}

export interface MPStats {
  totalVotes: number;
  attendance: number;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  partyAlignmentRate: number;
  lastUpdated: Date;
}

export interface BacktestResult {
  accuracy: number;
  precision: {
    for: number;
    against: number;
    abstain: number;
  };
  sampleSize: number;
  lastRun: Date;
}

// ============================================================================
// Voting Records
// ============================================================================

export interface Voting {
  _id?: ObjectId;
  uuid: string;
  title: string;
  titleEn?: string;
  description?: string;

  // Temporal (stored as strings from API)
  votingTime: string;
  sessionDate?: string;

  // Type and result (can be strings or objects from API)
  type?: string | { code: string; value: string };
  result?: string | { code: string; value: string };

  // Results counts (sync script naming)
  inFavor?: number;
  against?: number;
  abstained?: number;
  absent?: number;

  // Alternative naming (used by some code)
  votesFor?: number;
  votesAgainst?: number;
  votesAbstain?: number;
  votesAbsent?: number;

  // Individual votes
  voters: VotingVoter[];

  // Relationships
  relatedDraftUuid?: string;
  relatedDraftTitle?: string;

  // Vector search
  embedding?: number[];

  // Metadata
  syncedAt?: Date;
  createdAt?: Date;
}

export type VotingResult = "PASSED" | "REJECTED" | "UNKNOWN";

export interface Voter {
  memberUuid: string;
  memberName: string;
  party: string;
  vote: VoteDecision;
}

export type VoteDecision = "FOR" | "AGAINST" | "ABSTAIN" | "ABSENT";

// ============================================================================
// Legislative Drafts
// ============================================================================

export interface Draft {
  _id?: ObjectId;
  uuid: string;
  number: string;
  title: string;
  titleEn?: string;

  // Type and status (from API)
  type?: DraftStatus;
  status?: DraftStatus;
  phase?: string;

  // Content
  summary?: string;
  fullText?: string;

  // Initiators
  initiators?: string[];

  // Relationships
  relatedVotingUuids?: string[];

  // Temporal
  submitDate?: string;
  submittedDate?: Date;
  proceedingDate?: string;
  lastActionDate?: Date;
  syncedAt?: Date;

  // Vector search
  embedding?: number[];

  createdAt?: Date;
  updatedAt?: Date;
}

export interface DraftStatus {
  code: string;
  value: string;
}

// ============================================================================
// Member Types (for sync)
// ============================================================================

export interface Member {
  uuid: string;
  firstName: string;
  lastName: string;
  fullName: string;
  active: boolean;
  faction: {
    code: string;
    value: string;
  };
  photoUrl: string | null;
  committees: Array<{
    name: string;
    role: string;
    active: boolean;
  }>;
  convocations: number[];
  syncedAt: Date;
}

// ============================================================================
// Sync Progress Types
// ============================================================================

export type SyncStatus = "idle" | "running" | "paused" | "completed" | "error";

export interface SyncCheckpoint {
  year: number;
  completed: boolean;
  recordCount: number;
  lastOffset?: number;
  lastDate?: string;
  updatedAt?: Date;
}

export interface SyncProgress {
  _id: string;
  earliestDate: string;
  latestDate: string;
  totalRecords: number;
  status: SyncStatus;
  lastRunAt: Date;
  checkpoints: SyncCheckpoint[];
  error?: string;
}

// ============================================================================
// Stenogram Types
// ============================================================================

export interface StenogramSpeaker {
  memberUuid: string | null;
  fullName: string;
  text: string;
  topic: string | null;
}

export interface Stenogram {
  uuid: string;
  sessionDate: string;
  sessionNumber?: number;
  sessionType: string;
  speakers: StenogramSpeaker[];
  syncedAt: Date;
}

// ============================================================================
// Predictions
// ============================================================================

export interface Prediction {
  mpSlug: string;
  mpName: string;
  party: string;
  vote: VoteDecision;
  confidence: number;
  reasoning: {
    et: string;
    en: string;
  };
  similarVotes?: SimilarVote[];
  predictedAt: Date;
}

export interface SimilarVote {
  votingUuid: string;
  title: string;
  vote: VoteDecision;
  similarity: number;
  date: Date;
}

// RAG context types (used internally)
export interface RagSimilarVote {
  billTitle: string;
  decision: VoteDecision;
  date: Date;
  similarity: number;
}

export interface RelevantSpeech {
  topic: string;
  excerpt: string;
  date: Date;
  similarity: number;
}

// ============================================================================
// Instruction Generator Types (for MP profile generation)
// ============================================================================

export interface MPVotingStats {
  total: number;
  distribution: {
    FOR: number;
    AGAINST: number;
    ABSTAIN: number;
    ABSENT: number;
  };
  partyLoyaltyPercent: number;
  attendancePercent: number;
}

export interface MPPolicyArea {
  area: string;
  areaEn: string;
  count: number;
}

export interface MPNotableVote {
  title: string;
  titleEn?: string;
  decision: VoteDecision;
  date: string;
  reason: string;
  reasonEn?: string;
}

export interface MPKeyIssue {
  issue: string;
  issueEn?: string;
  stance: string;
  stanceEn?: string;
  confidence: number;
}

export interface PartyLoyalty {
  score: number;
  description: string;
  descriptionEn?: string;
}

export interface MPBehavioralPatterns {
  partyLoyalty: PartyLoyalty;
  independenceIndicators: string[];
  independenceIndicatorsEn?: string[];
}

export interface MPDecisionFactors {
  primaryFactors: string[];
  primaryFactorsEn?: string[];
  redFlags: string[];
  redFlagsEn?: string[];
  greenFlags: string[];
  greenFlagsEn?: string[];
}

export interface MPCommittee {
  name: string;
  nameEn?: string;
  role: string;
  roleEn?: string;
}

export interface MPInfo {
  firstName: string;
  lastName: string;
  fullName: string;
  party: MPParty;
  photoUrl: string | null;
  committees: MPCommittee[];
  previousTerms: number[];
  votingStats: MPVotingStats;
  policyAreas: MPPolicyArea[];
  notableVotes: MPNotableVote[];
}

export interface SimulationResult {
  draftTitle: string;
  passageProbability: number;
  totalFor: number;
  totalAgainst: number;
  totalAbstain: number;
  totalUnknown: number;
  predictions: Prediction[];
  partyBreakdown: PartyBreakdown[];
  swingVotes: SwingVote[];
  confidenceDistribution: ConfidenceDistribution;
  simulatedAt: Date;
}

export interface PartyBreakdown {
  party: string;
  partyCode: PartyCode;
  totalMembers: number;
  predictedFor: number;
  predictedAgainst: number;
  predictedAbstain: number;
  stance: "SUPPORTS" | "OPPOSES" | "SPLIT" | "UNKNOWN";
}

export interface SwingVote {
  mpSlug: string;
  mpName: string;
  party: string;
  confidence: number;
  predictedVote: VoteDecision;
  reason: string;
}

export interface ConfidenceDistribution {
  high: number;   // >= 80%
  medium: number; // 50-79%
  low: number;    // < 50%
  unknown: number;
}

// ============================================================================
// Analysis
// ============================================================================

export interface AccuracyStats {
  overall: number;
  byDecision: {
    for: number;
    against: number;
    abstain: number;
  };
  sampleSize: number;
  period: {
    start: Date;
    end: Date;
  };
  lastUpdated: Date;
}

export interface Faction {
  id: string;
  name: string;
  members: string[];  // MP slugs
  cohesion: number;   // How consistently they vote together
  keyIssues: string[];
}

// ============================================================================
// Backtesting Types
// ============================================================================

/**
 * Voter record as stored in votings collection (from Riigikogu API)
 * Different from Voter interface - uses 'decision' and 'faction' field names
 */
export interface VotingVoter {
  memberUuid: string;
  fullName: string;
  faction: string;
  decision: VoteDecision;
}

/**
 * Individual backtest prediction result
 */
export interface BacktestResultItem {
  votingUuid: string;
  votingTitle: string;
  votingDate: string;
  predicted: VoteDecision;
  actual: VoteDecision;
  confidence: number;
  correct: boolean;
}

/**
 * Accuracy metrics for backtesting
 */
export interface BacktestAccuracy {
  overall: number;
  byDecision: {
    FOR: { total: number; correct: number; precision: number };
    AGAINST: { total: number; correct: number; precision: number };
    ABSTAIN: { total: number; correct: number; precision: number };
  };
}

/**
 * Confusion matrix for backtest analysis
 */
export interface BacktestConfusionMatrix {
  predictedFor: { actualFor: number; actualAgainst: number; actualAbstain: number };
  predictedAgainst: { actualFor: number; actualAgainst: number; actualAbstain: number };
  predictedAbstain: { actualFor: number; actualAgainst: number; actualAbstain: number };
}

/**
 * Full backtest data stored on MP profile
 */
export interface BacktestData {
  lastRun: Date;
  sampleSize: number;
  accuracy: BacktestAccuracy;
  confusionMatrix: BacktestConfusionMatrix;
  results: BacktestResultItem[];
}

/**
 * Progress tracking for resumable backtest runs
 */
export interface BacktestProgress {
  _id: string;  // MP UUID
  status: "running" | "paused" | "completed";
  currentIndex: number;
  totalVotings: number;
  results: BacktestResultItem[];
  startedAt: Date;
  updatedAt: Date;
  error?: string;
}

/**
 * Full MP profile as stored in database (used by backtesting)
 */
export interface MPProfile {
  _id?: ObjectId;
  uuid: string;
  slug: string;
  status: MPStatus;

  // Basic info
  info?: MPInfo;

  // AI-generated instruction
  instruction?: MPInstructionFull;

  // Backtest results
  backtest?: BacktestData;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Full instruction with all AI-generated analysis
 */
export interface MPInstructionFull {
  version: number;
  generatedAt: Date;
  promptTemplate: string;
  politicalProfile: MPPoliticalProfile;
  behavioralPatterns: MPBehavioralPatterns;
  decisionFactors: MPDecisionFactors;
}

/**
 * Political profile with scale positions and key issues
 */
export interface MPPoliticalProfile {
  economicScale: number;  // -100 (left) to 100 (right)
  socialScale: number;    // -100 (liberal) to 100 (conservative)
  keyIssues: MPKeyIssue[];
}
