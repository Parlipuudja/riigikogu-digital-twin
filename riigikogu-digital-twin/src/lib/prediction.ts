import { predictVote, PredictionInput } from './claude';
import type { PredictionRequest, PredictionResponse, SimilarVote, RelevantSpeech } from '@/types';


/**
 * Main prediction function using Claude (embeddings disabled)
 */
export async function makePrediction(request: PredictionRequest): Promise<PredictionResponse> {
  // Skip embeddings - use Claude directly
  const similarVotes: SimilarVote[] = [];
  const relevantSpeeches: RelevantSpeech[] = [];

  // Build input for Claude prediction
  const predictionInput: PredictionInput = {
    billTitle: request.billTitle,
    billDescription: request.billDescription,
    billFullText: request.billFullText,
    category: request.category,
    similarVotes: [],
    relevantSpeeches: [],
  };

  // Get prediction from Claude
  const prediction = await predictVote(predictionInput);

  return {
    prediction: prediction.prediction,
    confidence: prediction.confidence,
    reasoning: prediction.reasoning,
    reasoningEt: prediction.reasoningEt,
    similarVotes,
    relevantSpeeches,
  };
}

/**
 * Evaluate model accuracy through backtesting
 * NOTE: Disabled while embeddings are off - requires database
 */
export async function evaluateModel(): Promise<{
  totalVotes: number;
  correctPredictions: number;
  accuracy: number;
  results: Array<{
    voteId: string;
    billTitle: string;
    actual: string;
    predicted: string;
    confidence: number;
    correct: boolean;
  }>;
}> {
  // Return empty results when embeddings disabled
  return {
    totalVotes: 0,
    correctPredictions: 0,
    accuracy: 0,
    results: [],
  };
}
