#!/usr/bin/env npx tsx
/**
 * Updates .context/state/ files with current system state
 * Run at the start of each session or after significant changes
 */

import { config } from "dotenv";
config({ path: ".env" });

import fs from "fs/promises";
import path from "path";

const CONTEXT_DIR = path.join(process.cwd(), ".context");
const STATE_DIR = path.join(CONTEXT_DIR, "state");

interface HealthState {
  lastUpdated: string;
  overall: "healthy" | "degraded" | "down";
  components: Record<string, {
    status: "healthy" | "degraded" | "failed";
    error?: string;
    lastCheck: string;
  }>;
  degradedFeatures: string[];
  workingFeatures: string[];
}

async function checkDatabase(): Promise<{ status: "healthy" | "failed"; error?: string }> {
  try {
    const response = await fetch("https://seosetu.ee/api/v1/health");
    const data = await response.json();
    if (data.data?.database) {
      return { status: "healthy" };
    }
    return { status: "failed", error: "Database connection failed" };
  } catch (error) {
    return { status: "failed", error: String(error) };
  }
}

async function checkAnthropicApi(): Promise<{ status: "healthy" | "failed"; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { status: "failed", error: "ANTHROPIC_API_KEY not set" };
  }

  try {
    // Just check if we can make a minimal request
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }]
      })
    });

    if (response.ok) {
      return { status: "healthy" };
    }

    const error = await response.json();
    return {
      status: "failed",
      error: error.error?.message || `HTTP ${response.status}`
    };
  } catch (error) {
    return { status: "failed", error: String(error) };
  }
}

async function checkVoyageApi(): Promise<{ status: "healthy" | "failed"; error?: string }> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    return { status: "failed", error: "VOYAGE_API_KEY not set" };
  }
  // Assume healthy if key is set (actual check would cost money)
  return { status: "healthy" };
}

async function updateHealthState(): Promise<void> {
  console.log("Checking system health...\n");

  const now = new Date().toISOString();

  const [db, anthropic, voyage] = await Promise.all([
    checkDatabase(),
    checkAnthropicApi(),
    checkVoyageApi()
  ]);

  console.log(`Database: ${db.status}${db.error ? ` (${db.error})` : ""}`);
  console.log(`Anthropic: ${anthropic.status}${anthropic.error ? ` (${anthropic.error})` : ""}`);
  console.log(`Voyage: ${voyage.status}${voyage.error ? ` (${voyage.error})` : ""}`);

  const allHealthy = db.status === "healthy" && anthropic.status === "healthy" && voyage.status === "healthy";
  const anyFailed = db.status === "failed" || anthropic.status === "failed" || voyage.status === "failed";

  const degradedFeatures: string[] = [];
  const workingFeatures: string[] = [];

  if (anthropic.status === "failed") {
    degradedFeatures.push("Vote predictions", "Parliament simulation", "MP profile generation");
  } else {
    workingFeatures.push("Vote predictions", "Parliament simulation");
  }

  if (db.status === "healthy") {
    workingFeatures.push("MP browsing", "Voting history", "Draft browsing", "Search", "Export");
  }

  const health: HealthState = {
    lastUpdated: now,
    overall: allHealthy ? "healthy" : anyFailed ? "degraded" : "degraded",
    components: {
      database: { status: db.status, error: db.error, lastCheck: now },
      anthropicApi: { status: anthropic.status, error: anthropic.error, lastCheck: now },
      voyageApi: { status: voyage.status, error: voyage.error, lastCheck: now }
    },
    degradedFeatures,
    workingFeatures
  };

  await fs.writeFile(
    path.join(STATE_DIR, "health.json"),
    JSON.stringify(health, null, 2)
  );

  console.log(`\nOverall: ${health.overall.toUpperCase()}`);
  console.log(`\nState written to .context/state/health.json`);
}

async function main() {
  console.log("=".repeat(50));
  console.log("CONTEXT STATE UPDATE");
  console.log("=".repeat(50));
  console.log();

  await updateHealthState();
}

main().catch(console.error);
