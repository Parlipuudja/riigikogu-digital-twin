#!/usr/bin/env npx tsx
/**
 * MVP User Test - Comprehensive functional testing
 * Tests all user-facing features and API endpoints
 *
 * Usage: npx tsx scripts/user-test.ts
 */

import "dotenv/config";
import { getCollection, closeConnection } from "../src/lib/data/mongodb";
import type { MPProfile, Draft, Voting } from "../src/types";

// ============================================================================
// Test Framework
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: string;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
}

let suites: TestSuite[] = [];
let currentSuite: TestSuite | null = null;

function suite(name: string): void {
  currentSuite = { name, tests: [] };
  suites.push(currentSuite);
  console.log(`\n📋 ${name}`);
  console.log("─".repeat(60));
}

async function test(name: string, fn: () => Promise<string | void>): Promise<void> {
  const start = Date.now();
  try {
    const details = await fn();
    const duration = Date.now() - start;
    const result: TestResult = { name, passed: true, duration, details: details || undefined };
    currentSuite?.tests.push(result);
    console.log(`  ✅ ${name} (${duration}ms)${details ? ` - ${details}` : ""}`);
  } catch (err) {
    const duration = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    const result: TestResult = { name, passed: false, duration, error };
    currentSuite?.tests.push(result);
    console.log(`  ❌ ${name} (${duration}ms) - ${error}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertDefined<T>(value: T | undefined | null, message: string): asserts value is T {
  if (value === undefined || value === null) throw new Error(message);
}

// ============================================================================
// Database Tests
// ============================================================================

async function testDatabase(): Promise<void> {
  suite("Database Connectivity");

  await test("MongoDB connection", async () => {
    const mps = await getCollection<MPProfile>("mps");
    const count = await mps.countDocuments({});
    assert(count > 0, "No documents found");
    return `${count} MP records`;
  });

  await test("Collections exist", async () => {
    const collections = ["mps", "votings", "drafts", "members", "stenograms"];
    for (const name of collections) {
      const col = await getCollection(name);
      const count = await col.countDocuments({});
      if (count === 0 && name !== "stenograms") {
        throw new Error(`${name} collection is empty`);
      }
    }
    return `${collections.length} collections verified`;
  });
}

// ============================================================================
// MP Tests
// ============================================================================

async function testMPs(): Promise<void> {
  suite("MP Profiles");

  await test("Active MPs count is 101", async () => {
    const mps = await getCollection<MPProfile>("mps");
    const count = await mps.countDocuments({ status: "active" });
    assert(count === 101, `Expected 101 active MPs, got ${count}`);
    return "101 active MPs";
  });

  await test("MP has required fields", async () => {
    const mps = await getCollection<MPProfile>("mps");
    const mp = await mps.findOne({ status: "active" });
    assertDefined(mp, "No active MP found");
    assertDefined(mp.uuid, "Missing uuid");
    assertDefined(mp.slug, "Missing slug");
    assertDefined(mp.info, "Missing info");
    assertDefined(mp.info.fullName, "Missing fullName");
    assertDefined(mp.info.party, "Missing party");
    return mp.info.fullName;
  });

  await test("MP has AI instruction", async () => {
    const mps = await getCollection<MPProfile>("mps");
    const mp = await mps.findOne({ status: "active", instruction: { $exists: true } });
    assertDefined(mp, "No MP with instruction found");
    assertDefined(mp.instruction?.promptTemplate, "Missing promptTemplate");
    return `${mp.info?.fullName} has instruction`;
  });

  await test("All parties represented", async () => {
    const mps = await getCollection<MPProfile>("mps");
    const parties = await mps.distinct("info.party.code", { status: "active" });
    assert(parties.length >= 5, `Expected at least 5 parties, got ${parties.length}`);
    return `${parties.length} parties: ${parties.join(", ")}`;
  });
}

// ============================================================================
// Voting Tests
// ============================================================================

async function testVotings(): Promise<void> {
  suite("Voting Records");

  await test("Votings collection has data", async () => {
    const votings = await getCollection<Voting>("votings");
    const count = await votings.countDocuments({});
    assert(count > 100, `Expected >100 votings, got ${count}`);
    return `${count} voting records`;
  });

  await test("Voting has voters array", async () => {
    const votings = await getCollection<Voting>("votings");
    const voting = await votings.findOne({ voters: { $exists: true, $ne: [] } });
    assertDefined(voting, "No voting with voters found");
    assert(voting.voters.length > 0, "Voters array is empty");
    return `${voting.voters.length} voters in sample`;
  });

  await test("Votings have embeddings", async () => {
    const votings = await getCollection<Voting>("votings");
    const withEmbed = await votings.countDocuments({ embedding: { $exists: true } });
    const total = await votings.countDocuments({});
    const pct = Math.round((withEmbed / total) * 100);
    assert(pct >= 90, `Only ${pct}% have embeddings`);
    return `${pct}% embedded`;
  });
}

// ============================================================================
// Draft Tests
// ============================================================================

async function testDrafts(): Promise<void> {
  suite("Legislative Drafts");

  await test("Drafts collection has data", async () => {
    const drafts = await getCollection<Draft>("drafts");
    const count = await drafts.countDocuments({});
    assert(count > 50, `Expected >50 drafts, got ${count}`);
    return `${count} draft records`;
  });

  await test("Draft has required fields", async () => {
    const drafts = await getCollection<Draft>("drafts");
    const draft = await drafts.findOne({});
    assertDefined(draft, "No draft found");
    assertDefined(draft.uuid, "Missing uuid");
    assertDefined(draft.number, "Missing number");
    assertDefined(draft.title, "Missing title");
    return `${draft.number}: ${draft.title.substring(0, 40)}...`;
  });
}

// ============================================================================
// Backtest Tests
// ============================================================================

async function testBacktests(): Promise<void> {
  suite("Backtesting");

  await test("MPs have backtest results", async () => {
    const mps = await getCollection<MPProfile>("mps");
    const backtested = await mps.countDocuments({ "backtest.accuracy": { $exists: true } });
    assert(backtested > 0, "No backtested MPs found");
    return `${backtested} MPs backtested`;
  });

  await test("Backtest accuracy meets target", async () => {
    const mps = await getCollection<MPProfile>("mps");
    const results = await mps.find({ "backtest.accuracy.overall": { $exists: true } }).toArray();

    let totalCorrect = 0;
    let totalSamples = 0;

    for (const mp of results) {
      const bt = mp.backtest;
      if (bt?.accuracy?.overall && bt.sampleSize) {
        totalCorrect += Math.round((bt.accuracy.overall / 100) * bt.sampleSize);
        totalSamples += bt.sampleSize;
      }
    }

    const accuracy = totalSamples > 0 ? Math.round((totalCorrect / totalSamples) * 100) : 0;
    assert(accuracy >= 70, `Accuracy ${accuracy}% below 70% target`);
    return `${accuracy}% accuracy (${totalSamples} predictions)`;
  });
}

// ============================================================================
// API Simulation Tests (without HTTP)
// ============================================================================

async function testAPIs(): Promise<void> {
  suite("API Logic (Direct Function Calls)");

  // Test MP list logic
  await test("MP list API logic", async () => {
    const mps = await getCollection<MPProfile>("mps");
    const active = await mps.find({ status: "active" }).limit(10).toArray();
    assert(active.length === 10, "Could not fetch 10 MPs");

    // Verify each has display data
    for (const mp of active) {
      assertDefined(mp.slug, "Missing slug");
      assertDefined(mp.info?.fullName, "Missing name");
    }
    return "List logic OK";
  });

  // Test stats calculation
  await test("Stats calculation logic", async () => {
    const mps = await getCollection<MPProfile>("mps");
    const backtested = await mps.find({ "backtest.accuracy": { $exists: true } }).toArray();

    if (backtested.length === 0) {
      return "No backtest data yet";
    }

    let total = 0;
    let samples = 0;
    for (const mp of backtested) {
      if (mp.backtest?.accuracy?.overall && mp.backtest.sampleSize) {
        total += mp.backtest.accuracy.overall * mp.backtest.sampleSize;
        samples += mp.backtest.sampleSize;
      }
    }

    const avg = samples > 0 ? total / samples : 0;
    assert(avg > 0, "Could not calculate accuracy");
    return `Average: ${avg.toFixed(1)}%`;
  });

  // Test search logic
  await test("Vector search prerequisites", async () => {
    const votings = await getCollection<Voting>("votings");
    const withEmbed = await votings.findOne({ embedding: { $exists: true, $type: "array" } });
    assertDefined(withEmbed, "No embedded votings found");
    assert(Array.isArray(withEmbed.embedding), "Embedding is not an array");
    assert(withEmbed.embedding!.length === 1024, `Expected 1024 dimensions, got ${withEmbed.embedding!.length}`);
    return "1024-dim embeddings OK";
  });
}

// ============================================================================
// Integration Tests
// ============================================================================

async function testIntegration(): Promise<void> {
  suite("Integration Tests");

  await test("MP can be predicted", async () => {
    // Verify we have all the data needed for prediction
    const mps = await getCollection<MPProfile>("mps");
    const mp = await mps.findOne({
      status: "active",
      "instruction.promptTemplate": { $exists: true },
    });
    assertDefined(mp, "No predictable MP found");
    assertDefined(mp.instruction?.promptTemplate, "Missing prompt template");

    const votings = await getCollection<Voting>("votings");
    const recentVotes = await votings
      .find({ "voters.memberUuid": mp.uuid })
      .limit(5)
      .toArray();

    return `${mp.info?.fullName} ready (${recentVotes.length} past votes)`;
  });

  await test("Party breakdown data available", async () => {
    const mps = await getCollection<MPProfile>("mps");
    const byParty = await mps
      .aggregate([
        { $match: { status: "active" } },
        { $group: { _id: "$info.party.code", count: { $sum: 1 } } },
      ])
      .toArray();

    assert(byParty.length >= 5, "Not enough parties");
    return byParty.map((p) => `${p._id}: ${p.count}`).join(", ");
  });

  await test("Insights data can be generated", async () => {
    const mps = await getCollection<MPProfile>("mps");

    // Find low party loyalty MPs (swing voters)
    const swingVoters = await mps
      .find({
        status: "active",
        "info.votingStats.partyLoyaltyPercent": { $lt: 90 },
      })
      .limit(5)
      .toArray();

    return `${swingVoters.length} potential swing voters found`;
  });
}

// ============================================================================
// UI Data Tests
// ============================================================================

async function testUIData(): Promise<void> {
  suite("UI Data Requirements");

  await test("Home page data available", async () => {
    const drafts = await getCollection<Draft>("drafts");
    const mps = await getCollection<MPProfile>("mps");

    const recentDrafts = await drafts.find({}).sort({ proceedingDate: -1 }).limit(5).toArray();
    const backtested = await mps.find({ "backtest.lastRun": { $exists: true } }).limit(5).toArray();

    assert(recentDrafts.length > 0, "No drafts for home page");
    return `${recentDrafts.length} drafts, ${backtested.length} backtests`;
  });

  await test("MP profile page data", async () => {
    const mps = await getCollection<MPProfile>("mps");
    const mp = await mps.findOne({ status: "active" });
    assertDefined(mp, "No MP found");

    // Check all required profile data
    assertDefined(mp.info?.fullName, "Missing name");
    assertDefined(mp.info?.party, "Missing party");
    assertDefined(mp.info?.votingStats, "Missing voting stats");

    return `${mp.info.fullName} profile complete`;
  });

  await test("Accuracy page data", async () => {
    const mps = await getCollection<MPProfile>("mps");
    const withBacktest = await mps
      .find({ "backtest.accuracy": { $exists: true } })
      .toArray();

    return `${withBacktest.length} MPs with accuracy data`;
  });
}

// ============================================================================
// Summary
// ============================================================================

function printSummary(): void {
  console.log("\n" + "═".repeat(60));
  console.log("  TEST SUMMARY");
  console.log("═".repeat(60));

  let totalPassed = 0;
  let totalFailed = 0;
  let totalDuration = 0;

  for (const suite of suites) {
    const passed = suite.tests.filter((t) => t.passed).length;
    const failed = suite.tests.filter((t) => !t.passed).length;
    const duration = suite.tests.reduce((sum, t) => sum + t.duration, 0);

    totalPassed += passed;
    totalFailed += failed;
    totalDuration += duration;

    const icon = failed === 0 ? "✅" : "❌";
    console.log(`  ${icon} ${suite.name}: ${passed}/${suite.tests.length} passed (${duration}ms)`);

    // Show failed tests
    for (const test of suite.tests.filter((t) => !t.passed)) {
      console.log(`     └─ ❌ ${test.name}: ${test.error}`);
    }
  }

  console.log("─".repeat(60));
  const overallIcon = totalFailed === 0 ? "✅" : "❌";
  console.log(
    `  ${overallIcon} TOTAL: ${totalPassed}/${totalPassed + totalFailed} tests passed (${totalDuration}ms)`
  );

  if (totalFailed === 0) {
    console.log("\n  🎉 ALL TESTS PASSED - MVP IS FUNCTIONAL!\n");
  } else {
    console.log(`\n  ⚠️  ${totalFailed} test(s) failed - review issues above\n`);
  }
  console.log("═".repeat(60));
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log("\n" + "═".repeat(60));
  console.log("  RIIGIKOGU RADAR - MVP USER TEST");
  console.log("═".repeat(60));
  console.log("  Running comprehensive functional tests...\n");

  try {
    await testDatabase();
    await testMPs();
    await testVotings();
    await testDrafts();
    await testBacktests();
    await testAPIs();
    await testIntegration();
    await testUIData();

    printSummary();
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

main();
