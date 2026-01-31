export type VoteDecision = 'FOR' | 'AGAINST' | 'ABSTAIN' | 'ABSENT';

export interface Bill {
  id: string;
  title: string;
  titleEn?: string;
  summary?: string;
  fullText?: string;
  billNumber?: string;
  date?: Date;
  category?: string;
  createdAt: Date;
}

export interface Vote {
  id: string;
  votingId: string;
  billId?: string;
  mpUuid: string;
  mpName: string;
  party?: string;
  decision: VoteDecision;
  date: Date;
  createdAt: Date;
}

export interface Speech {
  id: string;
  mpUuid: string;
  sessionDate: Date;
  sessionType?: 'PLENARY' | 'COMMITTEE';
  topic?: string;
  fullText: string;
  relatedBillIds?: string[];
  createdAt: Date;
}

export interface Embedding {
  id: string;
  sourceType: 'vote' | 'bill' | 'speech';
  sourceId: string;
  content: string;
  embedding: number[];
  createdAt: Date;
}

export interface PredictionRequest {
  billTitle: string;
  billDescription: string;
  billFullText?: string;
  category?: string;
}

export interface PredictionResponse {
  prediction: VoteDecision;
  confidence: number;
  reasoning: string;
  reasoningEt?: string;
  similarVotes: SimilarVote[];
  relevantSpeeches: RelevantSpeech[];
}

export interface SimilarVote {
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

export interface EvaluationResult {
  totalVotes: number;
  correctPredictions: number;
  accuracy: number;
  byDecision: {
    FOR: { total: number; correct: number; accuracy: number };
    AGAINST: { total: number; correct: number; accuracy: number };
    ABSTAIN: { total: number; correct: number; accuracy: number };
  };
  predictions: EvaluationPrediction[];
}

export interface EvaluationPrediction {
  voteId: string;
  billTitle: string;
  date: Date;
  actual: VoteDecision;
  predicted: VoteDecision;
  confidence: number;
  correct: boolean;
}

// Riigikogu API types
export interface RiigikoguVoting {
  uuid: string;
  title: string;
  date: string;
  result: string;
}

export interface RiigikoguVote {
  uuid: string;
  votingUuid: string;
  memberUuid: string;
  memberName: string;
  faction: string;
  decision: string;
}

export interface RiigikoguMember {
  uuid: string;
  firstName: string;
  lastName: string;
  faction: string;
}

export interface RiigikoguSpeech {
  uuid: string;
  memberUuid: string;
  sessionDate: string;
  content: string;
  topic: string;
}
