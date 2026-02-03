#!/usr/bin/env npx tsx
/**
 * Backtest Diagnostic Tool
 *
 * Tests the hypothesis that AI models may "know" voting results from training data.
 * Compares identifiable vs anonymized prompts and pre vs post-cutoff accuracy.
 */

import { getCollection, closeConnection } from "../src/lib/data/mongodb";
import { getAIProvider } from "../src/lib/ai/providers";
import type { Voting, VotingVoter, MPProfile, VoteDecision } from "../src/types";

// Model training cutoffs (approximate)
const MODEL_CUTOFFS: Record<string, Date> = {
  anthropic: new Date("2025-01-15"), // Claude Sonnet 4 approximate
  openai: new Date("2024-10-01"),    // GPT-4o approximate
  gemini: new Date("2024-11-01"),    // Gemini 1.5 approximate
};

interface DiagnosticConfig {
  mode: "anonymization" | "temporal" | "baseline" | "full";
  sampleSize: number;
  mpSlug?: string;
}

interface DiagnosticResult {
  mode: string;
  identifiableCorrect: number;
  identifiableTotal: number;
  identifiableAccuracy: number;
  anonymizedCorrect?: number;
  anonymizedTotal?: number;
  anonymizedAccuracy?: number;
  preCutoffAccuracy?: number;
  postCutoffAccuracy?: number;
  partyLineAccuracy?: number;
  leakageIndicator?: number;
  valueAdd?: number;
}

// Generate a deterministic hash for anonymization
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `B${Math.abs(hash).toString(36).toUpperCase().slice(0, 6)}`;
}

// Build identifiable prompt (current approach)
function buildIdentifiablePrompt(
  mpName: string,
  party: string,
  pattern: { forPercent: number; againstPercent: number; total: number },
  billTitle: string,
  recentVotes: Array<{ title: string; decision: string; date: string }>
): string {
  const recentText = recentVotes.map((v, i) =>
    `${i + 1}. "${v.title}" - ${v.decision} (${v.date.split("T")[0]})`
  ).join("\n");

  return `You are predicting how ${mpName} (${party}) would vote.

Historical pattern (${pattern.total} votes):
- FOR: ${pattern.forPercent}%
- AGAINST: ${pattern.againstPercent}%

Recent votes:
${recentText}

Bill: "${billTitle}"

Respond with JSON only: {"prediction": "FOR"|"AGAINST"|"ABSTAIN", "confidence": 0-100}`;
}

// Build anonymized prompt (removes identifiable info)
function buildAnonymizedPrompt(
  coalitionRole: string, // "coalition" or "opposition"
  pattern: { forPercent: number; againstPercent: number; total: number },
  billHash: string,
  recentPatterns: string // e.g., "7 FOR, 2 AGAINST, 1 ABSTAIN"
): string {
  return `You are predicting how a ${coalitionRole} MP would vote.

Historical pattern (${pattern.total} votes):
- FOR: ${pattern.forPercent}%
- AGAINST: ${pattern.againstPercent}%

Recent voting tendency: ${recentPatterns}

Bill reference: ${billHash}

Based ONLY on the voting pattern, predict: FOR, AGAINST, or ABSTAIN.

Respond with JSON only: {"prediction": "FOR"|"AGAINST"|"ABSTAIN", "confidence": 0-100}`;
}

// Calculate party-line baseline (what would voting with party predict?)
async function calculatePartyLineBaseline(
  votes: Array<{ actual: VoteDecision; partyMajority: VoteDecision }>
): Promise<number> {
  const correct = votes.filter(v => v.actual === v.partyMajority).length;
  return votes.length > 0 ? (correct / votes.length) * 100 : 0;
}

// Make a prediction with the AI provider
async function makePrediction(prompt: string): Promise<VoteDecision | null> {
  try {
    const provider = getAIProvider();
    const result = await provider.complete(prompt, { maxTokens: 100 });
    const match = result.text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return parsed.prediction as VoteDecision;
    }
  } catch (e) {
    console.error("Prediction error:", e);
  }
  return null;
}

// Get coalition status for a party
function getCoalitionRole(partyCode: string): string {
  // Current Estonian coalition (as of early 2026)
  const coalition = ["RE", "SDE", "E200"]; // Reform, SocDems, Estonia 200
  return coalition.includes(partyCode) ? "coalition" : "opposition";
}

// Main diagnostic function
async function runDiagnostic(config: DiagnosticConfig): Promise<DiagnosticResult> {
  console.log(`\nRunning diagnostic: ${config.mode}`);
  console.log(`Sample size: ${config.sampleSize}`);
  console.log("─".repeat(50));

  const mpsCollection = await getCollection<MPProfile>("mps");
  const votingsCollection = await getCollection<Voting>("votings");

  // Get test MP(s)
  const mpQuery = config.mpSlug
    ? { slug: config.mpSlug, status: "active" }
    : { status: "active" };
  const mps = await mpsCollection.find(mpQuery).limit(config.mpSlug ? 1 : 5).toArray();

  if (mps.length === 0) {
    throw new Error("No active MPs found");
  }

  console.log(`Testing ${mps.length} MP(s)`);

  let identifiableCorrect = 0;
  let identifiableTotal = 0;
  let anonymizedCorrect = 0;
  let anonymizedTotal = 0;
  let preCutoffCorrect = 0;
  let preCutoffTotal = 0;
  let postCutoffCorrect = 0;
  let postCutoffTotal = 0;
  let partyLineCorrect = 0;
  let partyLineTotal = 0;

  const cutoffDate = MODEL_CUTOFFS.anthropic;

  for (const mp of mps) {
    console.log(`\nMP: ${mp.info?.fullName || mp.slug}`);

    // Get MP's votes
    const votings = await votingsCollection.find({
      "voters.memberUuid": mp.uuid,
    }).sort({ votingTime: -1 }).limit(config.sampleSize * 2).toArray();

    // Calculate voting pattern
    let forCount = 0, againstCount = 0, abstainCount = 0;
    const votes: Array<{
      voting: Voting;
      decision: VoteDecision;
      date: Date;
    }> = [];

    for (const voting of votings) {
      const voter = voting.voters.find((v: VotingVoter) => v.memberUuid === mp.uuid);
      if (voter && voter.decision !== "ABSENT") {
        votes.push({
          voting,
          decision: voter.decision as VoteDecision,
          date: new Date(voting.votingTime),
        });
        if (voter.decision === "FOR") forCount++;
        else if (voter.decision === "AGAINST") againstCount++;
        else if (voter.decision === "ABSTAIN") abstainCount++;
      }
    }

    const total = forCount + againstCount + abstainCount;
    if (total < 20) {
      console.log("  Insufficient votes, skipping");
      continue;
    }

    const pattern = {
      forPercent: Math.round((forCount / total) * 100),
      againstPercent: Math.round((againstCount / total) * 100),
      total,
    };

    const partyCode = mp.info?.party?.code || "";
    const coalitionRole = getCoalitionRole(partyCode);

    // Sample votes for testing
    const testVotes = votes.slice(0, Math.min(config.sampleSize, votes.length));

    for (const vote of testVotes) {
      const isPostCutoff = vote.date > cutoffDate;

      // Build context from votes before this one
      const priorVotes = votes
        .filter(v => v.date < vote.date)
        .slice(-10)
        .map(v => ({
          title: v.voting.title,
          decision: v.decision,
          date: v.voting.votingTime,
        }));

      if (priorVotes.length < 5) continue;

      // Count recent patterns
      const recentFor = priorVotes.filter(v => v.decision === "FOR").length;
      const recentAgainst = priorVotes.filter(v => v.decision === "AGAINST").length;
      const recentAbstain = priorVotes.length - recentFor - recentAgainst;
      const recentPatterns = `${recentFor} FOR, ${recentAgainst} AGAINST, ${recentAbstain} ABSTAIN`;

      // 1. Identifiable prompt test
      if (config.mode === "anonymization" || config.mode === "full") {
        const identPrompt = buildIdentifiablePrompt(
          mp.info?.fullName || "Unknown",
          mp.info?.party?.name || "Unknown",
          pattern,
          vote.voting.title,
          priorVotes
        );

        const identPred = await makePrediction(identPrompt);
        if (identPred) {
          identifiableTotal++;
          if (identPred === vote.decision) identifiableCorrect++;
          process.stdout.write(identPred === vote.decision ? "✓" : "✗");
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 1000));
      }

      // 2. Anonymized prompt test
      if (config.mode === "anonymization" || config.mode === "full") {
        const anonPrompt = buildAnonymizedPrompt(
          coalitionRole,
          pattern,
          hashString(vote.voting.title),
          recentPatterns
        );

        const anonPred = await makePrediction(anonPrompt);
        if (anonPred) {
          anonymizedTotal++;
          if (anonPred === vote.decision) anonymizedCorrect++;
        }

        await new Promise(r => setTimeout(r, 1000));
      }

      // 3. Track pre/post cutoff
      if (config.mode === "temporal" || config.mode === "full") {
        if (isPostCutoff) {
          postCutoffTotal++;
          // Use identifiable prediction for this
          const prompt = buildIdentifiablePrompt(
            mp.info?.fullName || "Unknown",
            mp.info?.party?.name || "Unknown",
            pattern,
            vote.voting.title,
            priorVotes
          );
          const pred = await makePrediction(prompt);
          if (pred && pred === vote.decision) postCutoffCorrect++;
          await new Promise(r => setTimeout(r, 1000));
        } else {
          preCutoffTotal++;
          const prompt = buildIdentifiablePrompt(
            mp.info?.fullName || "Unknown",
            mp.info?.party?.name || "Unknown",
            pattern,
            vote.voting.title,
            priorVotes
          );
          const pred = await makePrediction(prompt);
          if (pred && pred === vote.decision) preCutoffCorrect++;
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      // 4. Party-line baseline
      if (config.mode === "baseline" || config.mode === "full") {
        // Simple baseline: predict based on overall pattern
        const majorityVote = pattern.forPercent > 50 ? "FOR" :
                           pattern.againstPercent > 50 ? "AGAINST" : "FOR";
        partyLineTotal++;
        if (majorityVote === vote.decision) partyLineCorrect++;
      }
    }

    console.log(); // newline after progress dots
  }

  // Calculate results
  const identifiableAccuracy = identifiableTotal > 0
    ? (identifiableCorrect / identifiableTotal) * 100 : 0;
  const anonymizedAccuracy = anonymizedTotal > 0
    ? (anonymizedCorrect / anonymizedTotal) * 100 : 0;
  const preCutoffAccuracy = preCutoffTotal > 0
    ? (preCutoffCorrect / preCutoffTotal) * 100 : 0;
  const postCutoffAccuracy = postCutoffTotal > 0
    ? (postCutoffCorrect / postCutoffTotal) * 100 : 0;
  const partyLineAccuracy = partyLineTotal > 0
    ? (partyLineCorrect / partyLineTotal) * 100 : 0;

  // Calculate leakage indicator
  const leakageIndicator = identifiableAccuracy > 0 && anonymizedAccuracy > 0
    ? (identifiableAccuracy - anonymizedAccuracy) / identifiableAccuracy : undefined;

  // Calculate value-add over baseline
  const valueAdd = identifiableAccuracy - partyLineAccuracy;

  return {
    mode: config.mode,
    identifiableCorrect,
    identifiableTotal,
    identifiableAccuracy,
    anonymizedCorrect,
    anonymizedTotal,
    anonymizedAccuracy,
    preCutoffAccuracy: preCutoffTotal > 0 ? preCutoffAccuracy : undefined,
    postCutoffAccuracy: postCutoffTotal > 0 ? postCutoffAccuracy : undefined,
    partyLineAccuracy: partyLineTotal > 0 ? partyLineAccuracy : undefined,
    leakageIndicator,
    valueAdd,
  };
}

// Print results
function printResults(result: DiagnosticResult): void {
  console.log("\n" + "═".repeat(60));
  console.log("  DIAGNOSTIC RESULTS");
  console.log("═".repeat(60));

  console.log(`\n  Mode: ${result.mode}`);

  console.log("\n  ACCURACY COMPARISON:");
  console.log(`  Identifiable prompts:  ${result.identifiableAccuracy.toFixed(1)}% (${result.identifiableCorrect}/${result.identifiableTotal})`);

  if (result.anonymizedAccuracy !== undefined) {
    console.log(`  Anonymized prompts:    ${result.anonymizedAccuracy.toFixed(1)}% (${result.anonymizedCorrect}/${result.anonymizedTotal})`);
  }

  if (result.preCutoffAccuracy !== undefined) {
    console.log(`  Pre-cutoff votes:      ${result.preCutoffAccuracy.toFixed(1)}%`);
  }

  if (result.postCutoffAccuracy !== undefined) {
    console.log(`  Post-cutoff votes:     ${result.postCutoffAccuracy.toFixed(1)}%`);
  }

  if (result.partyLineAccuracy !== undefined) {
    console.log(`  Party-line baseline:   ${result.partyLineAccuracy.toFixed(1)}%`);
  }

  console.log("\n  ANALYSIS:");

  if (result.leakageIndicator !== undefined) {
    const leakagePercent = (result.leakageIndicator * 100).toFixed(1);
    const leakageLevel = result.leakageIndicator > 0.15 ? "HIGH" :
                        result.leakageIndicator > 0.05 ? "MODERATE" : "LOW";
    console.log(`  Leakage indicator:     ${leakagePercent}% (${leakageLevel})`);

    if (result.leakageIndicator > 0.10) {
      console.log("  ⚠️  SIGNIFICANT DATA LEAKAGE DETECTED");
      console.log("     Model performs better with identifiable info.");
      console.log("     May be recalling known outcomes, not predicting.");
    }
  }

  if (result.valueAdd !== undefined) {
    console.log(`  Value over baseline:   ${result.valueAdd > 0 ? "+" : ""}${result.valueAdd.toFixed(1)}pp`);

    if (result.valueAdd < 5) {
      console.log("  ⚠️  MINIMAL VALUE-ADD");
      console.log("     Model barely beats simple party-line heuristic.");
    }
  }

  console.log("\n" + "═".repeat(60));
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const modeArg = args.find(a => a.startsWith("--mode="))?.split("=")[1] || "anonymization";
  const sampleArg = parseInt(args.find(a => a.startsWith("--sample="))?.split("=")[1] || "10");
  const mpArg = args.find(a => a.startsWith("--mp="))?.split("=")[1];

  if (args.includes("--help")) {
    console.log(`
Backtest Diagnostic Tool

Usage:
  npx tsx scripts/backtest-diagnostic.ts [options]

Options:
  --mode=MODE      Test mode: anonymization, temporal, baseline, full
  --sample=N       Number of votes to test per MP (default: 10)
  --mp=SLUG        Test specific MP only

Examples:
  npx tsx scripts/backtest-diagnostic.ts --mode=anonymization --sample=20
  npx tsx scripts/backtest-diagnostic.ts --mode=temporal --mp=kaja-kallas
  npx tsx scripts/backtest-diagnostic.ts --mode=full --sample=30
`);
    process.exit(0);
  }

  const config: DiagnosticConfig = {
    mode: modeArg as DiagnosticConfig["mode"],
    sampleSize: sampleArg,
    mpSlug: mpArg,
  };

  console.log("Backtest Diagnostic Tool");
  console.log("Testing data leakage hypothesis...\n");

  try {
    const result = await runDiagnostic(config);
    printResults(result);

    // Save results
    const outputPath = `reports/diagnostic-${Date.now()}.json`;
    const fs = await import("fs");
    const path = await import("path");

    const reportsDir = path.join(__dirname, "..", "reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(__dirname, "..", outputPath),
      JSON.stringify(result, null, 2)
    );
    console.log(`\nResults saved to: ${outputPath}`);

  } catch (error) {
    console.error("Diagnostic failed:", error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

main();
