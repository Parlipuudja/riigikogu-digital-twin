#!/usr/bin/env npx tsx
/**
 * Batch Backtest - Run backtests for multiple MPs
 *
 * Lists MPs and runs backtest for each one sequentially.
 * For single MP, use: npx tsx scripts/run-backtest.ts <slug>
 *
 * Usage:
 *   npx tsx scripts/run-backtest-all.ts              # All MPs needing backtest
 *   npx tsx scripts/run-backtest-all.ts --limit=10   # First 10 MPs
 *   npx tsx scripts/run-backtest-all.ts --list       # Just list, don't run
 */

import { config } from "dotenv";
config({ path: ".env" });

import { getCollection, closeConnection } from "../src/lib/data/mongodb";
import { runBacktest, getBacktestStatus } from "../src/lib/prediction/backtesting";
import type { MPProfile } from "../src/types";

// Hard limits
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_VOTES = 50;
const MAX_VOTES = 200;
const MAX_RUNTIME_MS = 4 * 60 * 60 * 1000; // 4 hours

interface Args {
  limit: number;
  maxVotes: number;
  listOnly: boolean;
  force: boolean;
  full: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const listOnly = args.includes("--list");
  const force = args.includes("--force");
  const full = args.includes("--full");

  let limit = DEFAULT_LIMIT;
  const limitArg = args.find((a) => a.startsWith("--limit="));
  if (limitArg) {
    limit = Math.min(parseInt(limitArg.split("=")[1], 10), MAX_LIMIT);
  }

  let maxVotes = full ? MAX_VOTES : DEFAULT_VOTES;
  const maxVotesArg = args.find((a) => a.startsWith("--max-votes="));
  if (maxVotesArg) {
    maxVotes = Math.min(parseInt(maxVotesArg.split("=")[1], 10), MAX_VOTES);
  }

  return { limit, maxVotes, listOnly, force, full };
}

function printHelp(): void {
  console.log(`
Batch Backtest - Run backtests for multiple MPs

Usage:
  npx tsx scripts/run-backtest-all.ts [options]

Options:
  --limit=<n>        Max MPs to process (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT})
  --max-votes=<n>    Votes per MP (default: ${DEFAULT_VOTES}, max: ${MAX_VOTES})
  --full             Full mode: ${MAX_VOTES} votes per MP
  --list             List MPs without running backtests
  --force            Re-run even if backtest exists (< 30 days)
  --help, -h         Show this help

Examples:
  npx tsx scripts/run-backtest-all.ts              # Default: 10 MPs, 50 votes each
  npx tsx scripts/run-backtest-all.ts --limit=5    # First 5 MPs
  npx tsx scripts/run-backtest-all.ts --list       # Preview which MPs need backtest
  npx tsx scripts/run-backtest-all.ts --full       # Full 200 votes per MP

Cost estimate (at current rates):
  10 MPs × 50 votes  = ~$2.40
  10 MPs × 200 votes = ~$9.60
  101 MPs × 50 votes = ~$24
`);
}

interface MPToProcess {
  mp: MPProfile;
  reason: string;
}

async function getMPsToProcess(args: Args): Promise<MPToProcess[]> {
  const mpsCollection = await getCollection<MPProfile>("mps");
  const mps = await mpsCollection
    .find({ status: "active" as const })
    .sort({ "info.fullName": 1 })
    .toArray();

  const results: MPToProcess[] = [];

  for (const mp of mps) {
    const status = await getBacktestStatus(mp.uuid);

    if (status.isRunning) {
      continue; // Skip running
    }

    if (status.existingResults && !args.force) {
      const lastRun = new Date(status.existingResults.lastRun);
      const daysSince = Math.floor((Date.now() - lastRun.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSince <= 30) {
        continue; // Skip recent
      }

      results.push({ mp, reason: `stale (${daysSince} days)` });
    } else if (status.progress?.status === "paused") {
      results.push({ mp, reason: "paused (will resume)" });
    } else {
      results.push({ mp, reason: "no backtest" });
    }

    if (results.length >= args.limit) break;
  }

  return results;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const startTime = Date.now();

  console.log("Batch Backtest");
  console.log("═".repeat(50));
  console.log(`Settings: limit=${args.limit}, votes=${args.maxVotes}, force=${args.force}`);
  console.log("");

  const toProcess = await getMPsToProcess(args);

  if (toProcess.length === 0) {
    console.log("No MPs need backtesting.");
    console.log("Use --force to re-run existing backtests.");
    await closeConnection();
    return;
  }

  console.log(`Found ${toProcess.length} MP(s) to process:\n`);
  for (const { mp, reason } of toProcess) {
    console.log(`  • ${mp.info?.fullName || mp.slug} - ${reason}`);
  }
  console.log("");

  if (args.listOnly) {
    console.log("(--list mode: not running backtests)");
    await closeConnection();
    return;
  }

  // Run backtests
  let completed = 0;
  let failed = 0;

  for (const { mp } of toProcess) {
    // Check runtime limit
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log(`\nRuntime limit reached (${MAX_RUNTIME_MS / 3600000}h). Stopping.`);
      break;
    }

    const name = mp.info?.fullName || mp.slug;
    console.log(`\n${"─".repeat(50)}`);
    console.log(`[${completed + failed + 1}/${toProcess.length}] ${name}`);
    console.log(`${"─".repeat(50)}`);

    try {
      const mpStart = Date.now();

      const results = await runBacktest(mp.uuid, {
        maxVotes: args.maxVotes,
        stratifiedSampling: true,
        earlyStop: !args.full,
        onProgress: (current, total, result) => {
          if (current % 10 === 0 || current === total) {
            const mark = result.correct ? "✓" : "✗";
            process.stdout.write(`  [${current}/${total}] ${mark}\r`);
          }
        },
      });

      const elapsed = ((Date.now() - mpStart) / 1000).toFixed(1);
      console.log(`  ✓ ${results.accuracy.overall}% accuracy (${results.sampleSize} samples) in ${elapsed}s`);
      completed++;

    } catch (error) {
      console.log(`  ✗ Failed: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  // Summary
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n${"═".repeat(50)}`);
  console.log("SUMMARY");
  console.log(`${"═".repeat(50)}`);
  console.log(`Completed: ${completed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total time: ${totalTime} minutes`);

  await closeConnection();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  closeConnection().finally(() => process.exit(1));
});
