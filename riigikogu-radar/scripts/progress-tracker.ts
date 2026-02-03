#!/usr/bin/env npx tsx
/**
 * Progress Tracker - MVP Alignment Report
 * Compares current system state against CLAUDE.md goals and MVP criteria
 *
 * Usage: npx tsx scripts/progress-tracker.ts
 *        npx tsx scripts/progress-tracker.ts --json  (machine-readable output)
 */

import "dotenv/config";
import { getCollection, getDbStats, closeConnection } from "../src/lib/data/mongodb";
import type { MPProfile, Voting, Draft, Stenogram } from "../src/types";

// ============================================================================
// MVP CRITERIA (from CLAUDE.md)
// ============================================================================

const MVP_CRITERIA = {
  accuracyTarget: 70,           // >70% prediction accuracy
  mpProfilesTarget: 101,        // All 101 active MPs have profiles
  dataFreshnessHours: 24,       // Data freshness <24h
  journalistsTarget: 3,         // 3-5 journalists using actively (manual)
  deadline: new Date("2026-03-01"),
};

const DB_SIZE_LIMIT_MB = 512;
const DB_WARNING_MB = 480;

// ============================================================================
// Types
// ============================================================================

interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warn" | "info";
  value: string | number;
  target?: string | number;
  details?: string;
}

interface CategoryResult {
  category: string;
  checks: CheckResult[];
  score: number; // 0-100
}

interface ProgressReport {
  generatedAt: string;
  daysUntilDeadline: number;
  overallScore: number;
  categories: CategoryResult[];
  summary: string[];
  recommendations: string[];
}

// ============================================================================
// Helpers
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function progressBar(current: number, max: number, width = 30): string {
  const pct = Math.min(Math.max(current / max, 0), 1);
  const filled = Math.round(pct * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function statusIcon(status: CheckResult["status"]): string {
  switch (status) {
    case "pass": return "✅";
    case "fail": return "❌";
    case "warn": return "⚠️";
    case "info": return "ℹ️";
  }
}

function calculateCategoryScore(checks: CheckResult[]): number {
  const weights = { pass: 100, warn: 50, info: 50, fail: 0 };
  const total = checks.reduce((sum, c) => sum + weights[c.status], 0);
  return Math.round(total / checks.length);
}

// ============================================================================
// Check Functions
// ============================================================================

async function checkMVPCriteria(): Promise<CategoryResult> {
  const checks: CheckResult[] = [];
  const mpsCollection = await getCollection<MPProfile>("mps");

  // 1. Check MP profiles
  const activeMPs = await mpsCollection.countDocuments({ status: "active" });
  const pendingMPs = await mpsCollection.countDocuments({ status: "pending" });
  checks.push({
    name: "Active MP Profiles",
    status: activeMPs >= MVP_CRITERIA.mpProfilesTarget ? "pass" : "fail",
    value: activeMPs,
    target: MVP_CRITERIA.mpProfilesTarget,
    details: pendingMPs > 0 ? `${pendingMPs} pending` : undefined,
  });

  // 2. Check prediction accuracy (from backtest data)
  const backtested = await mpsCollection
    .find({ "backtest.accuracy.overall": { $exists: true } })
    .toArray();

  if (backtested.length > 0) {
    let totalCorrect = 0;
    let totalSamples = 0;

    for (const mp of backtested) {
      const bt = mp.backtest;
      if (bt?.accuracy?.overall && bt.sampleSize) {
        totalCorrect += Math.round((bt.accuracy.overall / 100) * bt.sampleSize);
        totalSamples += bt.sampleSize;
      }
    }

    const overallAccuracy = totalSamples > 0
      ? Math.round((totalCorrect / totalSamples) * 1000) / 10
      : 0;

    checks.push({
      name: "Prediction Accuracy",
      status: overallAccuracy >= MVP_CRITERIA.accuracyTarget ? "pass" :
              overallAccuracy >= 60 ? "warn" : "fail",
      value: `${overallAccuracy}%`,
      target: `>${MVP_CRITERIA.accuracyTarget}%`,
      details: `${backtested.length} MPs tested, ${totalSamples} predictions`,
    });
  } else {
    checks.push({
      name: "Prediction Accuracy",
      status: "fail",
      value: "N/A",
      target: `>${MVP_CRITERIA.accuracyTarget}%`,
      details: "No backtests completed",
    });
  }

  // 3. Check data freshness
  const votingsCollection = await getCollection<Voting>("votings");
  const latestVoting = await votingsCollection
    .find({})
    .sort({ syncedAt: -1 })
    .limit(1)
    .toArray();

  if (latestVoting.length > 0 && latestVoting[0].syncedAt) {
    const syncedAt = new Date(latestVoting[0].syncedAt);
    const hoursAgo = (Date.now() - syncedAt.getTime()) / (1000 * 60 * 60);

    checks.push({
      name: "Data Freshness",
      status: hoursAgo <= MVP_CRITERIA.dataFreshnessHours ? "pass" :
              hoursAgo <= 48 ? "warn" : "fail",
      value: formatDuration(Date.now() - syncedAt.getTime()),
      target: `<${MVP_CRITERIA.dataFreshnessHours}h`,
      details: `Last sync: ${syncedAt.toISOString().split("T")[0]}`,
    });
  } else {
    checks.push({
      name: "Data Freshness",
      status: "fail",
      value: "Unknown",
      target: `<${MVP_CRITERIA.dataFreshnessHours}h`,
    });
  }

  // 4. Days until deadline
  const daysLeft = Math.ceil(
    (MVP_CRITERIA.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  checks.push({
    name: "Days Until MVP Deadline",
    status: daysLeft > 14 ? "pass" : daysLeft > 7 ? "warn" : "fail",
    value: daysLeft,
    target: "March 1, 2026",
  });

  return {
    category: "MVP Criteria",
    checks,
    score: calculateCategoryScore(checks),
  };
}

async function checkDataCoverage(): Promise<CategoryResult> {
  const checks: CheckResult[] = [];

  const stats = await getDbStats();
  const collections = new Map(stats.collections.map(c => [c.name, c]));

  // Database size
  const totalMB = stats.totalSize / (1024 * 1024);
  checks.push({
    name: "Database Size",
    status: totalMB < DB_WARNING_MB ? "pass" : totalMB < DB_SIZE_LIMIT_MB ? "warn" : "fail",
    value: `${totalMB.toFixed(1)} MB`,
    target: `<${DB_SIZE_LIMIT_MB} MB`,
  });

  // Collection counts
  const mpsCount = collections.get("mps")?.count || 0;
  const votingsCount = collections.get("votings")?.count || 0;
  const draftsCount = collections.get("drafts")?.count || 0;
  const stenogramsCount = collections.get("stenograms")?.count || 0;
  const membersCount = collections.get("members")?.count || 0;

  checks.push({
    name: "Votings Records",
    status: votingsCount > 5000 ? "pass" : votingsCount > 1000 ? "warn" : "fail",
    value: votingsCount.toLocaleString(),
    details: votingsCount > 0 ? formatBytes(collections.get("votings")?.size || 0) : undefined,
  });

  checks.push({
    name: "Legislative Drafts",
    status: draftsCount > 500 ? "pass" : draftsCount > 100 ? "warn" : "fail",
    value: draftsCount.toLocaleString(),
  });

  checks.push({
    name: "Stenograms (Speeches)",
    status: stenogramsCount > 100 ? "pass" : stenogramsCount > 0 ? "warn" : "fail",
    value: stenogramsCount.toLocaleString(),
  });

  checks.push({
    name: "Member Records",
    status: membersCount >= 101 ? "pass" : "fail",
    value: membersCount.toLocaleString(),
    target: "≥101",
  });

  return {
    category: "Data Coverage",
    checks,
    score: calculateCategoryScore(checks),
  };
}

async function checkEmbeddings(): Promise<CategoryResult> {
  const checks: CheckResult[] = [];

  const votingsCollection = await getCollection<Voting>("votings");
  const stenogramsCollection = await getCollection<Stenogram>("stenograms");

  // Voting embeddings
  const totalVotings = await votingsCollection.countDocuments({});
  const votingsWithEmbeddings = await votingsCollection.countDocuments({
    embedding: { $exists: true, $ne: [] },
  } as Record<string, unknown>);
  const votingsPct = totalVotings > 0
    ? Math.round((votingsWithEmbeddings / totalVotings) * 100)
    : 0;

  checks.push({
    name: "Voting Embeddings",
    status: votingsPct >= 90 ? "pass" : votingsPct >= 50 ? "warn" : "fail",
    value: `${votingsPct}%`,
    target: "100%",
    details: `${votingsWithEmbeddings.toLocaleString()} / ${totalVotings.toLocaleString()}`,
  });

  // Stenogram embeddings
  const totalStenograms = await stenogramsCollection.countDocuments({});
  const stenogramsWithEmbeddings = await stenogramsCollection.countDocuments({
    embedding: { $exists: true, $ne: [] },
  } as Record<string, unknown>);
  const stenogramsPct = totalStenograms > 0
    ? Math.round((stenogramsWithEmbeddings / totalStenograms) * 100)
    : 0;

  checks.push({
    name: "Stenogram Embeddings",
    status: stenogramsPct >= 90 ? "pass" : stenogramsPct >= 50 ? "warn" : "fail",
    value: `${stenogramsPct}%`,
    target: "100%",
    details: `${stenogramsWithEmbeddings.toLocaleString()} / ${totalStenograms.toLocaleString()}`,
  });

  return {
    category: "Vector Embeddings (RAG)",
    checks,
    score: calculateCategoryScore(checks),
  };
}

async function checkBacktesting(): Promise<CategoryResult> {
  const checks: CheckResult[] = [];

  const mpsCollection = await getCollection<MPProfile>("mps");
  const activeMPs = await mpsCollection.countDocuments({ status: "active" });
  const backtested = await mpsCollection
    .find({ "backtest.lastRun": { $exists: true } })
    .toArray();

  // Coverage
  const coverage = activeMPs > 0 ? Math.round((backtested.length / activeMPs) * 100) : 0;
  checks.push({
    name: "Backtest Coverage",
    status: coverage >= 90 ? "pass" : coverage >= 50 ? "warn" : "fail",
    value: `${coverage}%`,
    target: "100%",
    details: `${backtested.length} / ${activeMPs} MPs`,
  });

  // Accuracy distribution
  if (backtested.length > 0) {
    const accuracies = backtested
      .map(mp => mp.backtest?.accuracy?.overall || 0)
      .filter(a => a > 0);

    if (accuracies.length > 0) {
      const avgAccuracy = Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length);
      const highAccuracy = accuracies.filter(a => a >= 80).length;
      const medAccuracy = accuracies.filter(a => a >= 70 && a < 80).length;
      const lowAccuracy = accuracies.filter(a => a < 70).length;

      checks.push({
        name: "Average Accuracy",
        status: avgAccuracy >= 70 ? "pass" : avgAccuracy >= 60 ? "warn" : "fail",
        value: `${avgAccuracy}%`,
        target: "≥70%",
      });

      checks.push({
        name: "Accuracy Distribution",
        status: "info",
        value: `High: ${highAccuracy}, Med: ${medAccuracy}, Low: ${lowAccuracy}`,
        details: `≥80%: ${highAccuracy}, 70-79%: ${medAccuracy}, <70%: ${lowAccuracy}`,
      });

      // Most recent backtest
      const mostRecent = backtested
        .filter(mp => mp.backtest?.lastRun)
        .sort((a, b) =>
          new Date(b.backtest!.lastRun).getTime() - new Date(a.backtest!.lastRun).getTime()
        )[0];

      if (mostRecent?.backtest?.lastRun) {
        const lastRun = new Date(mostRecent.backtest.lastRun);
        const hoursAgo = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60);

        checks.push({
          name: "Last Backtest Run",
          status: hoursAgo < 24 ? "pass" : hoursAgo < 168 ? "warn" : "fail",
          value: formatDuration(Date.now() - lastRun.getTime()) + " ago",
          details: mostRecent.info?.fullName || mostRecent.slug,
        });
      }
    }
  }

  return {
    category: "Backtesting",
    checks,
    score: calculateCategoryScore(checks),
  };
}

async function checkFeatures(): Promise<CategoryResult> {
  const checks: CheckResult[] = [];

  // Check API endpoints by making requests
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const endpoints = [
    { path: "/api/v1/health", name: "Health API" },
    { path: "/api/v1/mps", name: "MPs API" },
    { path: "/api/v1/drafts", name: "Drafts API" },
    { path: "/api/v1/stats", name: "Stats API" },
    { path: "/api/v1/insights", name: "Insights API" },
    { path: "/api/v1/search?q=test", name: "Search API" },
  ];

  // Note: We can't actually test HTTP endpoints from a script without the server running
  // Instead, we'll check if the route files exist
  const fs = await import("fs");
  const path = await import("path");
  const routesDir = path.join(process.cwd(), "src/app/api/v1");

  for (const ep of endpoints) {
    const routePath = ep.path.replace("/api/v1/", "").split("?")[0];
    const routeFile = path.join(routesDir, routePath, "route.ts");
    const exists = fs.existsSync(routeFile);

    checks.push({
      name: ep.name,
      status: exists ? "pass" : "fail",
      value: exists ? "Implemented" : "Missing",
    });
  }

  // Check pages
  const pagesDir = path.join(process.cwd(), "src/app/[locale]");
  const pages = [
    { path: "mps", name: "MPs Page" },
    { path: "drafts", name: "Drafts Page" },
    { path: "simulate", name: "Simulate Page" },
    { path: "insights", name: "Insights Page" },
    { path: "accuracy", name: "Accuracy Page" },
    { path: "about", name: "About Page" },
  ];

  for (const pg of pages) {
    const pageFile = path.join(pagesDir, pg.path, "page.tsx");
    const exists = fs.existsSync(pageFile);

    checks.push({
      name: pg.name,
      status: exists ? "pass" : "fail",
      value: exists ? "Implemented" : "Missing",
    });
  }

  return {
    category: "Features & Pages",
    checks,
    score: calculateCategoryScore(checks),
  };
}

async function checkRoadmap(): Promise<CategoryResult> {
  const checks: CheckResult[] = [];
  const mpsCollection = await getCollection<MPProfile>("mps");

  // Priority 1: Foundation
  const activeMPs = await mpsCollection.countDocuments({ status: "active" });
  checks.push({
    name: "[P1] All 101 MPs have profiles",
    status: activeMPs >= 101 ? "pass" : "fail",
    value: activeMPs >= 101 ? "Complete" : `${activeMPs}/101`,
  });

  const votingsCollection = await getCollection<Voting>("votings");
  const votingsWithEmbed = await votingsCollection.countDocuments({ embedding: { $exists: true } });
  const totalVotings = await votingsCollection.countDocuments({});
  checks.push({
    name: "[P1] Embeddings generated for RAG",
    status: votingsWithEmbed > 0 ? (votingsWithEmbed === totalVotings ? "pass" : "warn") : "fail",
    value: votingsWithEmbed > 0 ? `${Math.round((votingsWithEmbed/totalVotings)*100)}%` : "Not started",
  });

  const backtestedCount = await mpsCollection.countDocuments({ "backtest.accuracy": { $exists: true } });
  checks.push({
    name: "[P1] Backtests establish accuracy baseline",
    status: backtestedCount >= 10 ? "pass" : backtestedCount > 0 ? "warn" : "fail",
    value: backtestedCount > 0 ? `${backtestedCount} MPs tested` : "Not started",
  });

  // Priority 2: Intelligence
  const fs = await import("fs");
  const path = await import("path");

  const insightsExists = fs.existsSync(path.join(process.cwd(), "src/app/api/v1/insights/route.ts"));
  checks.push({
    name: "[P2] Swing vote / anomaly detection",
    status: insightsExists ? "pass" : "fail",
    value: insightsExists ? "Implemented" : "Not started",
  });

  // Check cron jobs (look for crontab or GitHub Actions)
  const cronConfigured = fs.existsSync(path.join(process.cwd(), ".github/workflows")) ||
                         process.env.AWS_REGION !== undefined; // Assume cron if on AWS
  checks.push({
    name: "[P2] Daily data sync automation",
    status: cronConfigured ? "pass" : "warn",
    value: cronConfigured ? "Configured" : "Manual only",
  });

  // Priority 3: Journalist Interface
  const searchExists = fs.existsSync(path.join(process.cwd(), "src/app/api/v1/search/route.ts"));
  checks.push({
    name: "[P3] Natural language query",
    status: searchExists ? "pass" : "fail",
    value: searchExists ? "Implemented" : "Not started",
  });

  const exportExists = fs.existsSync(path.join(process.cwd(), "src/app/api/v1/export"));
  checks.push({
    name: "[P3] Export functionality",
    status: exportExists ? "pass" : "fail",
    value: exportExists ? "Implemented" : "Not started",
  });

  const insightsPageExists = fs.existsSync(path.join(process.cwd(), "src/app/[locale]/insights/page.tsx"));
  checks.push({
    name: "[P3] Story leads detection",
    status: insightsPageExists ? "pass" : "fail",
    value: insightsPageExists ? "Implemented" : "Not started",
  });

  return {
    category: "MVP Roadmap (Week of Feb 2-8)",
    checks,
    score: calculateCategoryScore(checks),
  };
}

// ============================================================================
// Report Generation
// ============================================================================

function generateRecommendations(categories: CategoryResult[]): string[] {
  const recommendations: string[] = [];

  for (const cat of categories) {
    for (const check of cat.checks) {
      if (check.status === "fail") {
        switch (check.name) {
          case "Prediction Accuracy":
            recommendations.push("Run more backtests: npx tsx scripts/run-backtest.ts --max-votes=100");
            break;
          case "Data Freshness":
            recommendations.push("Sync data: npx tsx scripts/sync-api.ts all");
            break;
          case "Voting Embeddings":
          case "Stenogram Embeddings":
            recommendations.push("Generate embeddings: npx tsx scripts/generate-embeddings.ts");
            break;
          case "Backtest Coverage":
            recommendations.push("Run backtests for more MPs: npx tsx scripts/run-backtest.ts");
            break;
        }
      }
    }
  }

  // Dedupe
  return Array.from(new Set(recommendations));
}

function generateSummary(categories: CategoryResult[], overallScore: number): string[] {
  const summary: string[] = [];

  if (overallScore >= 90) {
    summary.push("🎉 Excellent progress! MVP is nearly complete.");
  } else if (overallScore >= 70) {
    summary.push("👍 Good progress toward MVP goals.");
  } else if (overallScore >= 50) {
    summary.push("⚡ Moderate progress - focus on failing checks.");
  } else {
    summary.push("🚨 Significant work needed to meet MVP deadline.");
  }

  const failedChecks = categories
    .flatMap(c => c.checks)
    .filter(c => c.status === "fail");

  if (failedChecks.length > 0) {
    summary.push(`${failedChecks.length} critical issue(s) require attention.`);
  }

  const passedChecks = categories
    .flatMap(c => c.checks)
    .filter(c => c.status === "pass");

  summary.push(`${passedChecks.length} checks passing.`);

  return summary;
}

// ============================================================================
// Output
// ============================================================================

function printReport(report: ProgressReport): void {
  console.log("\n" + "═".repeat(70));
  console.log("  RIIGIKOGU RADAR - MVP PROGRESS REPORT");
  console.log("═".repeat(70));
  console.log(`  Generated: ${report.generatedAt}`);
  console.log(`  Days until deadline: ${report.daysUntilDeadline}`);
  console.log();

  // Overall score
  console.log("  OVERALL SCORE");
  console.log(`  ${progressBar(report.overallScore, 100)} ${report.overallScore}%`);
  console.log();

  // Summary
  console.log("  SUMMARY");
  for (const line of report.summary) {
    console.log(`  ${line}`);
  }
  console.log();

  // Categories
  for (const cat of report.categories) {
    console.log("─".repeat(70));
    console.log(`  ${cat.category.toUpperCase()} (Score: ${cat.score}%)`);
    console.log("─".repeat(70));

    for (const check of cat.checks) {
      const icon = statusIcon(check.status);
      const value = String(check.value).padEnd(15);
      const target = check.target ? ` (target: ${check.target})` : "";
      const details = check.details ? ` [${check.details}]` : "";

      console.log(`  ${icon} ${check.name.padEnd(30)} ${value}${target}${details}`);
    }
    console.log();
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    console.log("─".repeat(70));
    console.log("  RECOMMENDED ACTIONS");
    console.log("─".repeat(70));
    for (const rec of report.recommendations) {
      console.log(`  → ${rec}`);
    }
    console.log();
  }

  console.log("═".repeat(70));
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const jsonOutput = process.argv.includes("--json");

  try {
    // Run all checks in parallel
    const [mvp, data, embeddings, backtesting, features, roadmap] = await Promise.all([
      checkMVPCriteria(),
      checkDataCoverage(),
      checkEmbeddings(),
      checkBacktesting(),
      checkFeatures(),
      checkRoadmap(),
    ]);

    const categories = [mvp, roadmap, data, embeddings, backtesting, features];

    // Calculate overall score
    const overallScore = Math.round(
      categories.reduce((sum, c) => sum + c.score, 0) / categories.length
    );

    const daysUntilDeadline = Math.ceil(
      (MVP_CRITERIA.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    const report: ProgressReport = {
      generatedAt: new Date().toISOString(),
      daysUntilDeadline,
      overallScore,
      categories,
      summary: generateSummary(categories, overallScore),
      recommendations: generateRecommendations(categories),
    };

    if (jsonOutput) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printReport(report);
    }

  } catch (error) {
    console.error("Error generating progress report:", error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

main();
