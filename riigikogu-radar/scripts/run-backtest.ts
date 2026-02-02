#!/usr/bin/env npx tsx
/**
 * CLI Script for running backtests on MP profiles
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
    maxVotes: 200,
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
      result.maxVotes = parseInt(arg.slice(12), 10);
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Backtest CLI - Run accuracy backtests for digital MP profiles

Usage:
  npx tsx scripts/run-backtest.ts [options]

Options:
  --mp=<slug>        Run backtest for specific MP (by slug)
  --max-votes=<n>    Maximum test votes per MP (default: 200)
  --resume           Resume interrupted backtests only
  --help, -h         Show this help message

Examples:
  npx tsx scripts/run-backtest.ts                    # All active MPs
  npx tsx scripts/run-backtest.ts --mp=tonis-lukas   # Single MP
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
        // Log progress every 10 votes or when complete
        if (current % 10 === 0 || current === total || Date.now() - lastProgressLog > 30000) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const accuracy = calculateRunningAccuracy(current, result);
          console.log(
            `  [${current}/${total}] ${elapsed}s - Latest: ${result.predicted} vs ${result.actual} ` +
            `(${result.correct ? 'CORRECT' : 'WRONG'}) - Running accuracy: ${accuracy}%`
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

  console.log(`\nProcessing ${mpsToProcess.length} MP(s)...`);

  // Process each MP
  for (const mp of mpsToProcess) {
    runningResults = []; // Reset for each MP
    await runBacktestForMP(mp, args.maxVotes);
  }

  console.log('\n========================================');
  console.log('All backtests completed');
  await closeConnection();
}

main().catch(error => {
  console.error('Fatal error:', error);
  closeConnection().finally(() => process.exit(1));
});
