#!/usr/bin/env npx tsx
/**
 * THE BRAIN - Simplified
 *
 * One process. One job. Check health and act every 30 minutes.
 *
 * Following CLARITY: minimal code, maximum reliability.
 */

import "dotenv/config";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { MongoClient, Db } from "mongodb";

const CONFIG = {
  CYCLE_INTERVAL_MS: 15 * 60 * 1000,  // 15 minutes
  OPERATIVE_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes max
  WORKING_DIR: "/home/ubuntu/riigikogu-radar/riigikogu-radar",
  LOGS_DIR: "/home/ubuntu/riigikogu-radar/riigikogu-radar/logs/operatives",
};

const BRAIN_PROMPT = `You are the autonomous brain of Riigikogu Radar.

Read context:
- cat .context/action/priorities.md
- cat .context/state/health.json

Execute cycle:
1. HEALTH CHECK: curl -s https://seosetu.ee/api/v1/health
2. DATA FRESHNESS: Check if latest voting is >24h old via API
3. If unhealthy or stale → diagnose and report what's wrong
4. If healthy and fresh → report "HEALTHY" with 1-line summary
5. Update .context/state/health.json with timestamp and findings

Be FAST. Respond in under 60 seconds.`;

let db: Db | null = null;
let isShuttingDown = false;
let cycleCount = 0;

function log(msg: string, level = "INFO") {
  console.log(`[${new Date().toISOString()}] [${level}] ${msg}`);
}

async function connectDb(): Promise<Db> {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI required");

  const client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  return db;
}

async function runBrain(): Promise<{ output: string; status: string; durationMs: number }> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    let output = "";
    let resolved = false;

    const finish = (status: string) => {
      if (resolved) return;
      resolved = true;
      resolve({ output, status, durationMs: Date.now() - startTime });
    };

    // Use --print for immediate output
    const claude = spawn("claude", [
      "-p", BRAIN_PROMPT,
      "--dangerously-skip-permissions",
      "--print"
    ], {
      cwd: CONFIG.WORKING_DIR,
      env: { ...process.env },
    });

    claude.stdout.on("data", (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });

    claude.stderr.on("data", (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write(text);
    });

    claude.on("close", (code) => {
      finish(code === 0 ? "success" : "error");
    });

    claude.on("error", (err) => {
      log(`Spawn error: ${err.message}`, "ERROR");
      finish("error");
    });

    // Timeout
    setTimeout(() => {
      if (!resolved && claude.pid) {
        log("Brain timeout - killing", "WARN");
        claude.kill("SIGKILL");
        finish("timeout");
      }
    }, CONFIG.OPERATIVE_TIMEOUT_MS);
  });
}

async function runCycle() {
  cycleCount++;
  log(`\n${"=".repeat(50)}`);
  log(`CYCLE ${cycleCount}`);
  log(`${"=".repeat(50)}`);

  const database = await connectDb();

  // Update brain state
  await database.collection("brain_state").updateOne(
    { _id: "brain" },
    {
      $set: {
        status: "running",
        pid: process.pid,
        hostname: os.hostname(),
        lastHeartbeat: new Date(),
        cycleCount,
      },
      $setOnInsert: { startedAt: new Date() },
    },
    { upsert: true }
  );

  // Run brain
  const result = await runBrain();

  // Log result
  await database.collection("brain_runs").insertOne({
    startedAt: new Date(Date.now() - result.durationMs),
    finishedAt: new Date(),
    status: result.status,
    output: result.output.slice(-20000),
    durationMs: result.durationMs,
  });

  // Save to file
  if (!fs.existsSync(CONFIG.LOGS_DIR)) {
    fs.mkdirSync(CONFIG.LOGS_DIR, { recursive: true });
  }
  const logFile = path.join(CONFIG.LOGS_DIR, `brain-${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
  fs.writeFileSync(logFile, result.output);

  log(`Cycle complete: ${result.status} (${Math.round(result.durationMs / 1000)}s)`);

  // Clean old logs
  const files = fs.readdirSync(CONFIG.LOGS_DIR);
  if (files.length > 50) {
    const sorted = files
      .filter(f => f.startsWith("brain-"))
      .sort()
      .slice(0, -50);
    for (const f of sorted) {
      fs.unlinkSync(path.join(CONFIG.LOGS_DIR, f));
    }
  }
}

async function main() {
  log("=".repeat(50));
  log("RIIGIKOGU RADAR - THE BRAIN");
  log("=".repeat(50));
  log(`PID: ${process.pid}`);
  log(`Cycle interval: ${CONFIG.CYCLE_INTERVAL_MS / 1000 / 60} minutes`);
  log(`Timeout: ${CONFIG.OPERATIVE_TIMEOUT_MS / 1000 / 60} minutes`);

  await connectDb();
  log("Connected to MongoDB");

  // Shutdown handler
  const shutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    log("Shutting down...");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Main loop
  while (!isShuttingDown) {
    try {
      await runCycle();
    } catch (err) {
      log(`Cycle error: ${(err as Error).message}`, "ERROR");
    }

    if (!isShuttingDown) {
      log(`Sleeping ${CONFIG.CYCLE_INTERVAL_MS / 1000 / 60} minutes...`);
      await new Promise(r => setTimeout(r, CONFIG.CYCLE_INTERVAL_MS));
    }
  }
}

main().catch(err => {
  log(`Fatal: ${err.message}`, "ERROR");
  process.exit(1);
});
