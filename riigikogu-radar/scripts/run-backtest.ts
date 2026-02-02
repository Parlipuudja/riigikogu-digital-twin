#!/usr/bin/env npx tsx
/**
 * CLI Script for running backtests on MP profiles
 *
 * HARD LIMITS to prevent runaway API costs:
 * - Max 10 MPs per run (unless --mp=specific)
 * - Max 200 votes per MP
 * - Max 4 hours runtime
 * - Max 2500 API calls total
 *
 * Usage:
 *   npx tsx scripts/run-backtest.ts                    # Run for all active MPs
 *   npx tsx scripts/run-backtest.ts --mp=tonis-lukas   # Run for specific MP
 *   npx tsx scripts/run-backtest.ts --max-votes=100    # Limit test votes
 *   npx tsx scripts/run-backtest.ts --resume           # Resume interrupted runs
 */

import { config } from 'dotenv';
config({ path: '.env' });

import { getCollection, closeConnection } from '../src/lib/data/mongodb';
import { runBacktest, getBacktestStatus } from '../src/lib/prediction/backtesting';
import type { MPProfile, BacktestResultItem } from '../src/types';

// ============================================================================
// HARD LIMITS - These prevent runaway API costs
// ============================================================================
const MAX_MPS_PER_RUN = 10;              // Max MPs to process in one run
const MAX_VOTES_PER_MP = 200;            // Max votes per MP (absolute cap)
const MAX_RUNTIME_MS = 4 * 60 * 60 * 1000; // 4 hours max runtime
const MAX_TOTAL_API_CALLS = 2500;        // Max Claude API calls per run

// Track global usage
let totalApiCalls = 0;
const scriptStartTime = Date.now();

function checkHardLimits(): void {
  const runtime = Date.now() - scriptStartTime;

  if (runtime > MAX_RUNTIME_MS) {
    throw new Error(`HARD LIMIT: Max runtime of ${MAX_RUNTIME_MS / (60 * 60 * 1000)} hours exceeded. Stopping to prevent runaway costs.`);
  }

  if (totalApiCalls >= MAX_TOTAL_API_CALLS) {
    throw new Error(`HARD LIMIT: Max API calls (${MAX_TOTAL_API_CALLS}) reached. Stopping to prevent runaway costs.`);
  }
}

function incrementApiCalls(): void {
  totalApiCalls++;
  checkHardLimits();
}

// Parse command line arguments
function parseArgs(): {
  mpSlug?: string;
  maxVotes: number;
  resume: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);
  const result = {
    mpSlug: undefined as string | undefined,
    maxVotes: MAX_VOTES_PER_MP, // Use hard limit as default
    resume: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--resume') {
      result.resume = true;
    } else if (arg.startsWith('--mp=')) {
      result.mpSlug = arg.slice(5);
    } else if (arg.startsWith('--max-votes=')) {
      const requested = parseInt(arg.slice(12), 10);
      // Enforce hard limit
      result.maxVotes = Math.min(requested, MAX_VOTES_PER_MP);
      if (requested > MAX_VOTES_PER_MP) {
        console.warn(`Warning: --max-votes=${requested} exceeds hard limit. Using ${MAX_VOTES_PER_MP}`);
      }
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Backtest CLI - Run accuracy backtests for digital MP profiles

HARD LIMITS (to prevent runaway costs):
  - Max ${MAX_MPS_PER_RUN} MPs per run (unless --mp=specific)
  - Max ${MAX_VOTES_PER_MP} votes per MP
  - Max ${MAX_RUNTIME_MS / (60 * 60 * 1000)} hours runtime
  - Max ${MAX_TOTAL_API_CALLS} API calls total

Usage:
  npx tsx scripts/run-backtest.ts [options]

Options:
  --mp=<slug>        Run backtest for specific MP (by slug)
  --max-votes=<n>    Maximum test votes per MP (hard limit: ${MAX_VOTES_PER_MP})
  --resume           Resume interrupted backtests only
  --help, -h         Show this help message

Examples:
  npx tsx scripts/run-backtest.ts                    # Up to ${MAX_MPS_PER_RUN} active MPs
  npx tsx scripts/run-backtest.ts --mp=tonis-lukas   # Single MP (no MP limit)
  npx tsx scripts/run-backtest.ts --max-votes=50     # Quick test
  npx tsx scripts/run-backtest.ts --resume           # Resume paused
`);
}

async function runBacktestForMP(
  mp: MPProfile,
  maxVotes: number
): Promise<void> {
  const name = mp.info?.fullName || mp.slug;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Starting backtest for: ${name}`);
  console.log(`UUID: ${mp.uuid}`);
  console.log(`${'='.repeat(60)}`);

  const startTime = Date.now();
  let lastProgressLog = 0;

  try {
    const results = await runBacktest(mp.uuid, {
      maxVotes,
      onProgress: (current, total, result) => {
        incrementApiCalls(); // Track each API call

        // Log progress every 10 votes or when complete
        if (current % 10 === 0 || current === total || Date.now() - lastProgressLog > 30000) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const accuracy = calculateRunningAccuracy(current, result);
          const runtime = Math.round((Date.now() - scriptStartTime) / 60000);
          console.log(
            `  [${current}/${total}] ${elapsed}s - Latest: ${result.predicted} vs ${result.actual} ` +
            `(${result.correct ? 'CORRECT' : 'WRONG'}) - Running accuracy: ${accuracy}% | Total API: ${totalApiCalls}, Runtime: ${runtime}m`
          );
          lastProgressLog = Date.now();
        }
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nBacktest completed in ${elapsed}s`);
    console.log(`Sample size: ${results.sampleSize}`);
    console.log(`Overall accuracy: ${results.accuracy.overall}%`);
    console.log(`By decision:`);
    console.log(`  FOR:     ${results.accuracy.byDecision.FOR.precision}% precision (${results.accuracy.byDecision.FOR.correct}/${results.accuracy.byDecision.FOR.total})`);
    console.log(`  AGAINST: ${results.accuracy.byDecision.AGAINST.precision}% precision (${results.accuracy.byDecision.AGAINST.correct}/${results.accuracy.byDecision.AGAINST.total})`);
    console.log(`  ABSTAIN: ${results.accuracy.byDecision.ABSTAIN.precision}% precision (${results.accuracy.byDecision.ABSTAIN.correct}/${results.accuracy.byDecision.ABSTAIN.total})`);

  } catch (error) {
    console.error(`\nBacktest failed for ${name}:`);
    console.error(error instanceof Error ? error.message : error);
    console.log('Progress saved - use --resume to continue');
  }
}

// Helper to track running accuracy
let runningResults: BacktestResultItem[] = [];
function calculateRunningAccuracy(current: number, result: BacktestResultItem): number {
  if (current === 1) runningResults = [];
  runningResults.push(result);
  const correct = runningResults.filter(r => r.correct).length;
  return Math.round((correct / runningResults.length) * 100);
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log('Riigikogu Digital Twin - Backtest Runner');
  console.log('========================================\n');

  const mpsCollection = await getCollection<MPProfile>('mps');

  // Build query
  const query: Record<string, unknown> = { status: 'active' };
  if (args.mpSlug) {
    query.slug = args.mpSlug;
  }

  const mps = await mpsCollection.find(query).sort({ 'info.fullName': 1 }).toArray();

  if (mps.length === 0) {
    console.log('No active MP profiles found');
    if (args.mpSlug) {
      console.log(`Slug '${args.mpSlug}' not found or not active`);
    }
    await closeConnection();
    process.exit(1);
  }

  console.log(`Found ${mps.length} active MP profile(s)`);
  console.log(`Max votes per MP: ${args.maxVotes}`);

  if (args.resume) {
    console.log('Resume mode: Only resuming paused backtests');
  }

  // Filter MPs based on resume mode
  const mpsToProcess: MPProfile[] = [];

  for (const mp of mps) {
    const status = await getBacktestStatus(mp.uuid);

    if (args.resume) {
      // Only process if there's a paused backtest
      if (status.progress?.status === 'paused') {
        console.log(`  - ${mp.info?.fullName}: PAUSED at ${status.progress.currentIndex}/${status.progress.totalVotings}`);
        mpsToProcess.push(mp);
      }
    } else {
      // Check if already running
      if (status.isRunning) {
        console.log(`  - ${mp.info?.fullName}: SKIPPING (already running)`);
      } else if (status.existingResults && !args.mpSlug) {
        // Skip if already has results (unless specifically requested)
        const lastRun = new Date(status.existingResults.lastRun);
        const daysSince = Math.floor((Date.now() - lastRun.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`  - ${mp.info?.fullName}: Has results from ${daysSince} days ago (${status.existingResults.accuracy.overall}% accuracy)`);
        // Only re-run if older than 30 days
        if (daysSince > 30) {
          mpsToProcess.push(mp);
        }
      } else {
        mpsToProcess.push(mp);
      }
    }
  }

  if (mpsToProcess.length === 0) {
    console.log('\nNo MPs to process');
    await closeConnection();
    process.exit(0);
  }

  // Enforce hard limit on number of MPs (unless specific MP requested)
  let mpsToRun = mpsToProcess;
  if (!args.mpSlug && mpsToProcess.length > MAX_MPS_PER_RUN) {
    console.log(`\nHARD LIMIT: Limiting to ${MAX_MPS_PER_RUN} MPs (requested ${mpsToProcess.length})`);
    console.log('Run multiple times or use --mp=<slug> for specific MPs');
    mpsToRun = mpsToProcess.slice(0, MAX_MPS_PER_RUN);
  }

  console.log(`\nProcessing ${mpsToRun.length} MP(s)...`);
  console.log(`Hard limits: ${MAX_VOTES_PER_MP} votes/MP, ${MAX_TOTAL_API_CALLS} total API calls, ${MAX_RUNTIME_MS / (60 * 60 * 1000)}h runtime`);

  // Process each MP
  for (const mp of mpsToRun) {
    try {
      checkHardLimits(); // Check before starting each MP
      runningResults = []; // Reset for each MP
      await runBacktestForMP(mp, args.maxVotes);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('HARD LIMIT')) {
        console.error(`\n${error.message}`);
        break; // Stop processing more MPs
      }
      throw error;
    }
  }

  console.log('\n========================================');
  console.log('All backtests completed');
  await closeConnection();
}

main().catch(error => {
  console.error('Fatal error:', error);
  closeConnection().finally(() => process.exit(1));
});
