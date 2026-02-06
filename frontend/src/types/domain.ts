export type VoteDecision = "FOR" | "AGAINST" | "ABSTAIN" | "ABSENT";

export interface MP {
  slug: string;
  firstName: string;
  lastName: string;
  partyCode: string;
  photoUrl?: string;
  committees: string[];
  isActive: boolean;
  stats?: MPStats;
  politicalProfile?: string;
  politicalProfileEn?: string;
  keyIssues?: string[];
  notableQuotes?: string[];
  behavioralPatterns?: string[];
}

export interface MPStats {
  totalVotes: number;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  absentVotes: number;
  attendanceRate: number;
  partyAlignmentRate: number;
  recentAlignmentRate: number;
}

export interface Voting {
  uuid: string;
  title: string;
  titleEn?: string;
  votingTime: string;
  result: string;
  forCount: number;
  againstCount: number;
  abstainCount: number;
  absentCount: number;
  voters?: Voter[];
}

export interface Voter {
  firstName: string;
  lastName: string;
  faction: string;
  decision: VoteDecision;
}

export interface Draft {
  uuid: string;
  title: string;
  titleEn?: string;
  number: string;
  status: string;
  initiators: string[];
  billType?: string;
}

export interface PredictionResponse {
  mp: string;
  prediction: VoteDecision;
  confidence: number;
  features: FeatureValue[];
  explanation?: string;
  explanationEn?: string;
  modelVersion: string;
}

export interface FeatureValue {
  name: string;
  value: number;
  description: string;
}

export interface BillInput {
  title: string;
  description?: string;
  billType?: string;
  initiators?: string[];
}

export interface SimulationResult {
  id: string;
  status: "pending" | "running" | "complete" | "error";
  bill: BillInput;
  predictions?: PredictionResponse[];
  summary?: {
    for: number;
    against: number;
    abstain: number;
    absent: number;
    predictedOutcome: string;
  };
}

export interface AccuracyData {
  overall: number;
  baseline: number;
  improvement: number;
  honestPeriod: string;
  sampleSize: number;
  byParty: Record<string, { accuracy: number; count: number }>;
  byVoteType: Record<string, { accuracy: number; count: number }>;
  trend: { date: string; accuracy: number }[];
}

export interface Stats {
  totalVotings: number;
  totalMPs: number;
  activeMPs: number;
  totalDrafts: number;
  lastVotingDate: string;
  lastSyncDate: string;
}

export interface HealthStatus {
  status: string;
  db: string;
  uptime_seconds: number;
  model_version: string;
  accuracy: number;
  last_sync: string;
}

export type PartyCode =
  | "RE"
  | "EKRE"
  | "KE"
  | "I"
  | "SDE"
  | "E200"
  | "EP"
  | "FR";

export const PARTY_COLORS: Record<string, string> = {
  RE: "#FFE200",
  EKRE: "#00355F",
  KE: "#00853E",
  I: "#009FE3",
  SDE: "#E30613",
  E200: "#009FE3",
  EP: "#8B4513",
  FR: "#999999",
};

export const PARTY_NAMES: Record<string, { et: string; en: string }> = {
  RE: { et: "Reformierakond", en: "Reform Party" },
  EKRE: { et: "EKRE", en: "EKRE" },
  KE: { et: "Keskerakond", en: "Centre Party" },
  I: { et: "Isamaa", en: "Isamaa" },
  SDE: { et: "Sotsiaaldemokraadid", en: "Social Democrats" },
  E200: { et: "Eesti 200", en: "Eesti 200" },
  EP: { et: "Erakond Parempoolsed", en: "Right Party" },
  FR: { et: "Fraktsioonitu", en: "Non-affiliated" },
};
