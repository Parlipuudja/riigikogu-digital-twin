#!/usr/bin/env npx tsx
/**
 * Backtest CLI - Run backtest for a SINGLE MP
 *
 * Simple, focused tool. For batch operations, use run-backtest-all.ts
 *
 * Usage:
 *   npx tsx scripts/run-backtest.ts <slug>
 *   npx tsx scripts/run-backtest.ts kaja-kallas
 *   npx tsx scripts/run-backtest.ts kaja-kallas --full
 */

import { config } from "dotenv";
config({ path: ".env" });

import { getCollection, closeConnection } from "../src/lib/data/mongodb";
import { runBacktest } from "../src/lib/prediction/backtesting";
import type { MPProfile, BacktestResultItem } from "../src/types";

// Defaults
const DEFAULT_VOTES = 50;
const MAX_VOTES = 200;

interface Args {
  slug: string;
  maxVotes: number;
  full: boolean;
  noStratified: boolean;
  noEarlyStop: boolean;
  postCutoff: boolean;
}

function parseArgs(): Args | null {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    return null;
  }

  // First non-flag argument is the slug
  const slug = args.find((a) => !a.startsWith("-"));
  if (!slug) {
    console.error("Error: MP slug is required\n");
    printHelp();
    return null;
  }

  const full = args.includes("--full");
  const noStratified = args.includes("--no-stratified");
  const noEarlyStop = args.includes("--no-early-stop") || full;
  const postCutoff = args.includes("--post-cutoff");

  let maxVotes = full ? MAX_VOTES : DEFAULT_VOTES;
  const maxVotesArg = args.find((a) => a.startsWith("--max-votes="));
  if (maxVotesArg) {
    maxVotes = Math.min(parseInt(maxVotesArg.split("=")[1], 10), MAX_VOTES);
  }

  return { slug, maxVotes, full, noStratified, noEarlyStop, postCutoff };
}

function printHelp(): void {
  console.log(`
Backtest CLI - Run backtest for a single MP

Usage:
  npx tsx scripts/run-backtest.ts <slug> [options]

Arguments:
  <slug>             MP slug (required), e.g., "kaja-kallas"

Options:
  --max-votes=<n>    Sample size (default: ${DEFAULT_VOTES}, max: ${MAX_VOTES})
  --full             Full mode: ${MAX_VOTES} votes, no early stopping
  --post-cutoff      Only test on votes after model training cutoff (May 2025)
                     This gives true out-of-sample accuracy with no data leakage
  --no-stratified    Disable stratified sampling
  --no-early-stop    Disable early stopping
  --help, -h         Show this help

Examples:
  npx tsx scripts/run-backtest.ts kaja-kallas
  npx tsx scripts/run-backtest.ts kaja-kallas --full
  npx tsx scripts/run-backtest.ts kaja-kallas --post-cutoff
  npx tsx scripts/run-backtest.ts kaja-kallas --max-votes=100

For batch operations:
  npx tsx scripts/run-backtest-all.ts
`);
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (!args) {
    process.exit(0);
  }

  console.log(`Backtest: ${args.slug}`);
  console.log(`Settings: ${args.maxVotes} votes, stratified=${!args.noStratified}, early-stop=${!args.noEarlyStop}${args.postCutoff ? ', POST-CUTOFF (out-of-sample)' : ''}`);
  console.log("─".repeat(50));

  // Find MP
  const mpsCollection = await getCollection<MPProfile>("mps");
  const mp = await mpsCollection.findOne({ slug: args.slug });

  if (!mp) {
    console.error(`Error: MP not found with slug "${args.slug}"`);
    await closeConnection();
    process.exit(1);
  }

  if (mp.status !== "active") {
    console.error(`Error: MP "${args.slug}" is not active (status: ${mp.status})`);
    await closeConnection();
    process.exit(1);
  }

  console.log(`MP: ${mp.info?.fullName || args.slug}`);
  console.log(`UUID: ${mp.uuid}`);
  console.log("");

  const startTime = Date.now();
  let resultCount = 0;

  try {
    const results = await runBacktest(mp.uuid, {
      maxVotes: args.maxVotes,
      stratifiedSampling: !args.noStratified,
      earlyStop: !args.noEarlyStop,
      postCutoffOnly: args.postCutoff,
      onProgress: (current, total, result) => {
        resultCount = current;
        if (current % 10 === 0 || current === total) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const mark = result.correct ? "✓" : "✗";
          console.log(
            `[${current}/${total}] ${elapsed}s ${mark} ${result.predicted} vs ${result.actual}`
          );
        }
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("");
    console.log("─".repeat(50));
    console.log(`Completed in ${elapsed}s`);
    console.log(`Sample: ${results.sampleSize} votes`);
    console.log(`Accuracy: ${results.accuracy.overall}%`);
    console.log("");
    console.log("By decision:");
    console.log(`  FOR:     ${results.accuracy.byDecision.FOR.precision}% (${results.accuracy.byDecision.FOR.correct}/${results.accuracy.byDecision.FOR.total})`);
    console.log(`  AGAINST: ${results.accuracy.byDecision.AGAINST.precision}% (${results.accuracy.byDecision.AGAINST.correct}/${results.accuracy.byDecision.AGAINST.total})`);
    console.log(`  ABSTAIN: ${results.accuracy.byDecision.ABSTAIN.precision}% (${results.accuracy.byDecision.ABSTAIN.correct}/${results.accuracy.byDecision.ABSTAIN.total})`);

  } catch (error) {
    console.error("\nBacktest failed:", error instanceof Error ? error.message : error);
    console.log("Progress saved - rerun to resume");
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

main();
