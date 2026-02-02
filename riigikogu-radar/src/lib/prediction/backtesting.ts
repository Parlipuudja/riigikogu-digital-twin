/**
 * Backtesting Engine for Digital MP Prediction Accuracy
 *
 * Uses historical voting data with strict temporal isolation - predictions
 * are made using only data available before each test vote.
 */

import { getCollection } from '../data/mongodb';
import { getAnthropicClient, extractTextContent, DEFAULT_MODEL } from '../ai/client';
import type {
  VoteDecision,
  Voting,
  VotingVoter,
  MPProfile,
  BacktestResultItem,
  BacktestAccuracy,
  BacktestConfusionMatrix,
  BacktestData,
  BacktestProgress,
} from '@/types';

// Minimum votes required before starting backtest
const MIN_TRAINING_VOTES = 20;
// Maximum test votes per MP
const MAX_TEST_VOTES = 200;
// Delay between API calls (ms)
const API_DELAY_MS = 2000;
// Max results to store in profile
const MAX_STORED_RESULTS = 100;

export interface BackdatedContext {
  mpName: string;
  party: string;
  votingPattern: {
    total: number;
    forPercent: number;
    againstPercent: number;
    abstainPercent: number;
  };
  recentVotes: Array<{
    title: string;
    decision: VoteDecision;
    date: string;
  }>;
}

export interface BacktestOptions {
  maxVotes?: number;
  minTrainingVotes?: number;
  delayMs?: number;
  onProgress?: (current: number, total: number, result: BacktestResultItem) => void;
}

/**
 * Build context from only historical votes before a given date
 */
export async function buildBackdatedContext(
  mpUuid: string,
  beforeDate: Date,
  mpProfile: MPProfile
): Promise<BackdatedContext | null> {
  const votingsCollection = await getCollection<Voting>('votings');

  // Get all votings where MP voted before the given date
  const votings = await votingsCollection.find({
    'voters.memberUuid': mpUuid,
    votingTime: { $lt: beforeDate.toISOString() }
  }).sort({ votingTime: 1 }).toArray();

  if (votings.length < MIN_TRAINING_VOTES) {
    return null;
  }

  // Extract MP's votes
  const mpVotes: Array<{ title: string; decision: VoteDecision; date: string }> = [];
  let forCount = 0;
  let againstCount = 0;
  let abstainCount = 0;

  for (const voting of votings) {
    const voter = voting.voters.find((v: VotingVoter) => v.memberUuid === mpUuid);
    if (voter && voter.decision !== 'ABSENT') {
      mpVotes.push({
        title: voting.title,
        decision: voter.decision,
        date: voting.votingTime,
      });

      if (voter.decision === 'FOR') forCount++;
      else if (voter.decision === 'AGAINST') againstCount++;
      else if (voter.decision === 'ABSTAIN') abstainCount++;
    }
  }

  const activeVotes = forCount + againstCount + abstainCount;
  if (activeVotes === 0) return null;

  return {
    mpName: mpProfile.info?.fullName || 'Unknown MP',
    party: mpProfile.info?.party?.name || 'Unknown Party',
    votingPattern: {
      total: activeVotes,
      forPercent: Math.round((forCount / activeVotes) * 100),
      againstPercent: Math.round((againstCount / activeVotes) * 100),
      abstainPercent: Math.round((abstainCount / activeVotes) * 100),
    },
    recentVotes: mpVotes.slice(-10), // Last 10 votes for context
  };
}

/**
 * Build a lightweight prediction prompt using historical context
 */
function buildBacktestPrompt(context: BackdatedContext, billTitle: string): string {
  const recentVotesText = context.recentVotes.length > 0
    ? context.recentVotes.map((v, i) =>
        `${i + 1}. "${v.title}" - ${v.decision} (${v.date.split('T')[0]})`
      ).join('\n')
    : 'No recent votes available.';

  return `You are predicting how ${context.mpName} (${context.party}) would vote on legislation.

Historical voting pattern (based on ${context.votingPattern.total} previous votes):
- Voted FOR: ${context.votingPattern.forPercent}%
- Voted AGAINST: ${context.votingPattern.againstPercent}%
- Voted ABSTAIN: ${context.votingPattern.abstainPercent}%

Recent votes (last 10):
${recentVotesText}

Given this bill title: "${billTitle}"

Based on the voting pattern and recent votes, predict how this MP would vote.

IMPORTANT: Only respond with a valid JSON object, no other text:
{
  "prediction": "FOR" | "AGAINST" | "ABSTAIN",
  "confidence": <number 0-100>
}`;
}

/**
 * Make a single backtest prediction using Claude
 */
async function makeBacktestPrediction(
  context: BackdatedContext,
  billTitle: string
): Promise<{ prediction: VoteDecision; confidence: number }> {
  const prompt = buildBacktestPrompt(context, billTitle);

  const response = await getAnthropicClient().messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = extractTextContent(response);
  if (!textContent) {
    throw new Error('No text response from Claude');
  }

  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from response');
  }

  const result = JSON.parse(jsonMatch[0]);
  return {
    prediction: result.prediction as VoteDecision,
    confidence: Math.min(100, Math.max(0, result.confidence)),
  };
}

/**
 * Calculate accuracy metrics from backtest results
 */
export function calculateAccuracy(results: BacktestResultItem[]): BacktestAccuracy {
  const total = results.length;
  const correct = results.filter(r => r.correct).length;

  // Initialize decision metrics
  const byDecision = {
    FOR: { total: 0, correct: 0, precision: 0 },
    AGAINST: { total: 0, correct: 0, precision: 0 },
    ABSTAIN: { total: 0, correct: 0, precision: 0 },
  };

  // Count by predicted decision (for precision)
  for (const result of results) {
    const predicted = result.predicted;
    if (predicted === 'FOR' || predicted === 'AGAINST' || predicted === 'ABSTAIN') {
      byDecision[predicted].total++;
      if (result.correct) {
        byDecision[predicted].correct++;
      }
    }
  }

  // Calculate precision for each decision type
  for (const decision of ['FOR', 'AGAINST', 'ABSTAIN'] as const) {
    const metrics = byDecision[decision];
    metrics.precision = metrics.total > 0
      ? Math.round((metrics.correct / metrics.total) * 100)
      : 0;
  }

  return {
    overall: total > 0 ? Math.round((correct / total) * 100) : 0,
    byDecision,
  };
}

/**
 * Build confusion matrix from backtest results
 */
export function buildConfusionMatrix(results: BacktestResultItem[]): BacktestConfusionMatrix {
  const matrix: BacktestConfusionMatrix = {
    predictedFor: { actualFor: 0, actualAgainst: 0, actualAbstain: 0 },
    predictedAgainst: { actualFor: 0, actualAgainst: 0, actualAbstain: 0 },
    predictedAbstain: { actualFor: 0, actualAgainst: 0, actualAbstain: 0 },
  };

  for (const result of results) {
    const predicted = result.predicted;
    const actual = result.actual;

    if (predicted === 'FOR') {
      if (actual === 'FOR') matrix.predictedFor.actualFor++;
      else if (actual === 'AGAINST') matrix.predictedFor.actualAgainst++;
      else if (actual === 'ABSTAIN') matrix.predictedFor.actualAbstain++;
    } else if (predicted === 'AGAINST') {
      if (actual === 'FOR') matrix.predictedAgainst.actualFor++;
      else if (actual === 'AGAINST') matrix.predictedAgainst.actualAgainst++;
      else if (actual === 'ABSTAIN') matrix.predictedAgainst.actualAbstain++;
    } else if (predicted === 'ABSTAIN') {
      if (actual === 'FOR') matrix.predictedAbstain.actualFor++;
      else if (actual === 'AGAINST') matrix.predictedAbstain.actualAgainst++;
      else if (actual === 'ABSTAIN') matrix.predictedAbstain.actualAbstain++;
    }
  }

  return matrix;
}

/**
 * Save backtest results to MP profile
 */
export async function saveBacktestResults(
  mpUuid: string,
  results: BacktestResultItem[]
): Promise<BacktestData> {
  const mpsCollection = await getCollection<MPProfile>('mps');

  const accuracy = calculateAccuracy(results);
  const confusionMatrix = buildConfusionMatrix(results);

  const backtestData: BacktestData = {
    lastRun: new Date(),
    sampleSize: results.length,
    accuracy,
    confusionMatrix,
    // Store only the most recent results (capped)
    results: results.slice(-MAX_STORED_RESULTS),
  };

  await mpsCollection.updateOne(
    { uuid: mpUuid },
    {
      $set: {
        backtest: backtestData,
        updatedAt: new Date(),
      },
    }
  );

  return backtestData;
}

/**
 * Get or create backtest progress record for resumable runs
 */
async function getBacktestProgress(mpUuid: string): Promise<BacktestProgress | null> {
  const progressCollection = await getCollection<BacktestProgress>('backtest_progress');
  return progressCollection.findOne({ _id: mpUuid });
}

/**
 * Save backtest progress for resume capability
 */
async function saveBacktestProgress(progress: BacktestProgress): Promise<void> {
  const progressCollection = await getCollection<BacktestProgress>('backtest_progress');
  await progressCollection.updateOne(
    { _id: progress._id },
    { $set: progress },
    { upsert: true }
  );
}

/**
 * Clear backtest progress after completion
 */
async function clearBacktestProgress(mpUuid: string): Promise<void> {
  const progressCollection = await getCollection<BacktestProgress>('backtest_progress');
  await progressCollection.deleteOne({ _id: mpUuid });
}

/**
 * Helper to delay between API calls
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run backtest for a single MP
 */
export async function runBacktest(
  mpUuid: string,
  options: BacktestOptions = {}
): Promise<BacktestData> {
  const {
    maxVotes = MAX_TEST_VOTES,
    minTrainingVotes = MIN_TRAINING_VOTES,
    delayMs = API_DELAY_MS,
    onProgress,
  } = options;

  // Get MP profile
  const mpsCollection = await getCollection<MPProfile>('mps');
  const mpProfile = await mpsCollection.findOne({ uuid: mpUuid });

  if (!mpProfile) {
    throw new Error(`MP profile not found: ${mpUuid}`);
  }

  if (mpProfile.status !== 'active') {
    throw new Error(`MP profile is not active: ${mpProfile.status}`);
  }

  // Get all votings where MP voted (excluding ABSENT)
  const votingsCollection = await getCollection<Voting>('votings');

  const votings = await votingsCollection.find({
    'voters': {
      $elemMatch: {
        memberUuid: mpUuid,
        decision: { $in: ['FOR', 'AGAINST', 'ABSTAIN'] }
      }
    }
  }).sort({ votingTime: 1 }).toArray();

  if (votings.length < minTrainingVotes + 1) {
    throw new Error(`Not enough votes for backtesting. Need at least ${minTrainingVotes + 1}, found ${votings.length}`);
  }

  // Check for existing progress (resume capability)
  let progress = await getBacktestProgress(mpUuid);
  let startIndex = minTrainingVotes;
  let results: BacktestResultItem[] = [];

  if (progress && progress.status === 'paused') {
    startIndex = progress.currentIndex;
    results = progress.results;
    console.log(`Resuming backtest from index ${startIndex}`);
  } else {
    // Initialize new progress
    progress = {
      _id: mpUuid,
      status: 'running',
      currentIndex: startIndex,
      totalVotings: Math.min(votings.length, minTrainingVotes + maxVotes),
      results: [],
      startedAt: new Date(),
      updatedAt: new Date(),
    };
  }

  progress.status = 'running';
  await saveBacktestProgress(progress);

  const endIndex = Math.min(votings.length, minTrainingVotes + maxVotes);

  try {
    for (let i = startIndex; i < endIndex; i++) {
      const voting = votings[i];
      const votingDate = new Date(voting.votingTime);

      // Build context using only historical data
      const context = await buildBackdatedContext(mpUuid, votingDate, mpProfile);

      if (!context) {
        continue; // Skip if not enough historical data
      }

      // Get actual vote
      const voter = voting.voters.find((v: VotingVoter) => v.memberUuid === mpUuid);
      if (!voter || voter.decision === 'ABSENT') {
        continue;
      }

      const actual = voter.decision as VoteDecision;

      // Make prediction
      const { prediction, confidence } = await makeBacktestPrediction(context, voting.title);

      const result: BacktestResultItem = {
        votingUuid: voting.uuid,
        votingTitle: voting.title,
        votingDate: voting.votingTime,
        predicted: prediction,
        actual,
        confidence,
        correct: prediction === actual,
      };

      results.push(result);

      // Update progress
      progress.currentIndex = i + 1;
      progress.results = results;
      progress.updatedAt = new Date();
      await saveBacktestProgress(progress);

      // Callback for progress updates
      if (onProgress) {
        onProgress(i - minTrainingVotes + 1, endIndex - minTrainingVotes, result);
      }

      // Rate limiting
      if (i < endIndex - 1) {
        await delay(delayMs);
      }
    }

    // Save final results to MP profile
    const backtestData = await saveBacktestResults(mpUuid, results);

    // Clear progress on successful completion
    await clearBacktestProgress(mpUuid);

    return backtestData;
  } catch (error) {
    // Save progress for resume on error
    progress.status = 'paused';
    progress.error = error instanceof Error ? error.message : 'Unknown error';
    progress.updatedAt = new Date();
    await saveBacktestProgress(progress);
    throw error;
  }
}

/**
 * Get backtest status for an MP (for checking if backtest is running)
 */
export async function getBacktestStatus(mpUuid: string): Promise<{
  isRunning: boolean;
  progress?: BacktestProgress;
  existingResults?: BacktestData;
}> {
  const progress = await getBacktestProgress(mpUuid);

  const mpsCollection = await getCollection<MPProfile>('mps');
  const mp = await mpsCollection.findOne({ uuid: mpUuid });

  return {
    isRunning: progress?.status === 'running',
    progress: progress || undefined,
    existingResults: mp?.backtest,
  };
}

/**
 * Pause a running backtest
 */
export async function pauseBacktest(mpUuid: string): Promise<void> {
  const progress = await getBacktestProgress(mpUuid);
  if (progress && progress.status === 'running') {
    progress.status = 'paused';
    progress.updatedAt = new Date();
    await saveBacktestProgress(progress);
  }
}
