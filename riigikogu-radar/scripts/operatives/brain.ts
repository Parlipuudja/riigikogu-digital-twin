#!/usr/bin/env npx tsx
/**
 * THE BRAIN
 *
 * The autonomous supervisor for Riigikogu Radar operatives.
 * Designed to never stop running.
 *
 * Architecture:
 *   LAYER 0: Cron watchdog (external, restarts brain if dead)
 *   LAYER 1: Systemd (restarts on crash, watchdog timeout)
 *   LAYER 2: This script (brain.ts) - runs operative cycles
 *   LAYER 3: Operatives (Claude CLI instances, isolated)
 *
 * Key principles:
 *   - Defense in depth (multiple restart mechanisms)
 *   - Operative isolation (one failure doesn't kill brain)
 *   - External heartbeat (MongoDB tracks liveness)
 *   - Resource bounded (can't OOM or fill disk)
 */

import "dotenv/config";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { MongoClient, Db } from "mongodb";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Timing
  CYCLE_INTERVAL_MS: 30 * 60 * 1000,    // 30 minutes between cycles
  OPERATIVE_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes max per operative
  HEARTBEAT_INTERVAL_MS: 60 * 1000,     // 1 minute heartbeat
  WATCHDOG_INTERVAL_MS: 60 * 1000,      // 1 minute systemd notify

  // Paths
  WORKING_DIR: "/home/ubuntu/riigikogu-radar/riigikogu-radar",
  LOGS_DIR: "/home/ubuntu/riigikogu-radar/riigikogu-radar/logs/operatives",

  // Resource limits
  MAX_LOG_SIZE_MB: 100,
  MAX_LOG_AGE_DAYS: 7,
  MAX_MONGO_LOG_AGE_DAYS: 30,
};

// ============================================================================
// STATE
// ============================================================================

interface BrainState {
  _id: string;
  status: "running" | "stopped" | "error";
  pid: number;
  hostname: string;
  startedAt: Date;
  lastHeartbeat: Date;
  currentOperative: string | null;
  cycleCount: number;
  lastCycleAt: Date | null;
  errors: string[];
}

interface OperativeRun {
  operative: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: "running" | "success" | "error" | "timeout";
  exitCode: number | null;
  output: string;
  durationMs: number | null;
}

let mongoClient: MongoClient | null = null;
let db: Db | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let watchdogInterval: NodeJS.Timeout | null = null;
let currentOperativeProcess: ChildProcess | null = null;
let isShuttingDown = false;
let cycleCount = 0;

// ============================================================================
// DATABASE
// ============================================================================

async function connectDb(): Promise<Db> {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  db = mongoClient.db();

  log("Connected to MongoDB");
  return db;
}

async function closeDb(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    db = null;
  }
}

// ============================================================================
// LOGGING
// ============================================================================

function log(message: string, level: "INFO" | "WARN" | "ERROR" = "INFO"): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}`;
  console.log(line);
}

function logError(message: string, error?: Error): void {
  log(`${message}${error ? `: ${error.message}` : ""}`, "ERROR");
  if (error?.stack) {
    console.error(error.stack);
  }
}

// ============================================================================
// HEARTBEAT
// ============================================================================

async function sendHeartbeat(operative: string | null = null): Promise<void> {
  try {
    const database = await connectDb();
    await database.collection<BrainState>("brain_state").updateOne(
      { _id: "brain" },
      {
        $set: {
          status: "running",
          pid: process.pid,
          hostname: os.hostname(),
          lastHeartbeat: new Date(),
          currentOperative: operative,
          cycleCount,
        },
        $setOnInsert: {
          startedAt: new Date(),
          errors: [],
        },
      },
      { upsert: true }
    );
  } catch (error) {
    logError("Failed to send heartbeat", error as Error);
  }
}

function startHeartbeat(): void {
  // Send initial heartbeat
  sendHeartbeat();

  // Send periodic heartbeats
  heartbeatInterval = setInterval(() => {
    sendHeartbeat(currentOperativeProcess ? "running" : null);
  }, CONFIG.HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ============================================================================
// SYSTEMD WATCHDOG
// ============================================================================

function notifySystemd(message: string): void {
  // systemd-notify via socket
  const notifySocket = process.env.NOTIFY_SOCKET;
  if (!notifySocket) return;

  try {
    const dgram = require("dgram");
    const client = dgram.createSocket("unix_dgram");
    client.send(message, notifySocket, (err: Error | null) => {
      client.close();
      if (err) {
        logError("Failed to notify systemd", err);
      }
    });
  } catch (error) {
    // Ignore - systemd notify is optional
  }
}

function startWatchdog(): void {
  // Notify systemd we're ready
  notifySystemd("READY=1");

  // Send periodic watchdog pings
  watchdogInterval = setInterval(() => {
    notifySystemd("WATCHDOG=1");
  }, CONFIG.WATCHDOG_INTERVAL_MS);
}

function stopWatchdog(): void {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
  notifySystemd("STOPPING=1");
}

// ============================================================================
// OPERATIVE EXECUTION
// ============================================================================

const OPERATIVE_PROMPTS: Record<string, string> = {
  "project-manager": `You are the Project Manager operative for Riigikogu Radar.

Read your operative definition:
cat .context/operatives/00-project-manager.md

Read your brain:
cat ~/.claude/projects/-home-ubuntu-riigikogu-radar/memory/MEMORY.md

Then execute your session protocol:
1. Check production health: curl -s https://seosetu.ee/api/v1/health
2. Review priorities: cat .context/action/priorities.md
3. THINK: What's the biggest gap right now?
4. Take strategic action:
   - Update the brain if it's stale or unclear
   - Update priorities if they've changed
   - Create a report if needed
   - Document any blockers you discover
5. Update state files with results

You are ALWAYS WORKING. Strategic thinking is work. Brain maintenance is work.
Do not ask for permission. Be concise in output.`,

  developer: `You are the Developer operative for Riigikogu Radar.

Read your operative definition:
cat .context/operatives/05-developer.md

Read your brain:
cat ~/.claude/projects/-home-ubuntu-riigikogu-radar/memory/MEMORY.md

Then execute your session protocol:
1. Read priorities: cat .context/action/priorities.md
2. Pick the highest-priority unblocked implementation task
3. Write code to implement it
4. Test: npm run build
5. If build passes: git add, commit, push
6. Update priorities.md with progress
7. Continue to next task if time permits

You are ALWAYS WORKING. There is always code to write or improve.
If no clear priority, improve existing code quality or add tests.
Do not ask for permission. Ship code every session.`,

  collector: `You are the Collector operative for Riigikogu Radar.

Your mission: Keep data fresh (<24h stale).

Execute:
1. Check last sync: look at sync_progress collection
2. If data is stale (>24h): run npm run db:sync
3. Report results

Be efficient. Only sync what's needed.`,

  analyst: `You are the Analyst operative for Riigikogu Radar.

Your mission: 100% embedding coverage.

Execute:
1. Check embedding coverage
2. If incomplete: run npx tsx scripts/generate-embeddings.ts
3. Report results

Be efficient. Only embed what's needed.`,

  predictor: `You are the Predictor operative for Riigikogu Radar.

Your mission: Validate 85%+ accuracy.

Execute:
1. Check when last backtest ran
2. If >7 days: run npx tsx scripts/run-backtest.ts
3. Report accuracy results

Accuracy is critical. Don't skip validation.`,

  guardian: `You are the Guardian operative for Riigikogu Radar.

Your mission: 99%+ uptime.

Execute:
1. Check health: curl -s https://seosetu.ee/api/v1/health
2. Check stats: curl -s https://seosetu.ee/api/v1/stats
3. Report any issues found
4. If critical issues: document in .context/state/blockers.json

Be vigilant. Catch problems early.`,
};

async function runOperative(operative: string): Promise<OperativeRun> {
  const prompt = OPERATIVE_PROMPTS[operative];
  if (!prompt) {
    throw new Error(`Unknown operative: ${operative}`);
  }

  const startedAt = new Date();
  const logFile = path.join(
    CONFIG.LOGS_DIR,
    `${operative}-${startedAt.toISOString().replace(/[:.]/g, "-")}.log`
  );

  log(`Starting operative: ${operative}`);

  // Ensure logs directory exists
  if (!fs.existsSync(CONFIG.LOGS_DIR)) {
    fs.mkdirSync(CONFIG.LOGS_DIR, { recursive: true });
  }

  const run: OperativeRun = {
    operative,
    startedAt,
    finishedAt: null,
    status: "running",
    exitCode: null,
    output: "",
    durationMs: null,
  };

  // Record start in MongoDB
  const database = await connectDb();
  const runId = await database.collection("operative_runs").insertOne({
    ...run,
    logFile,
  });

  return new Promise((resolve) => {
    const logStream = fs.createWriteStream(logFile);
    let output = "";
    let resolved = false;

    const finish = async (status: OperativeRun["status"], exitCode: number | null) => {
      if (resolved) return;
      resolved = true;

      currentOperativeProcess = null;
      logStream.end();

      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      run.finishedAt = finishedAt;
      run.status = status;
      run.exitCode = exitCode;
      run.output = output.slice(-50000); // Last 50KB
      run.durationMs = durationMs;

      // Update MongoDB
      await database.collection("operative_runs").updateOne(
        { _id: runId.insertedId },
        {
          $set: {
            finishedAt,
            status,
            exitCode,
            output: run.output,
            durationMs,
          },
        }
      );

      log(`Operative ${operative} finished: ${status} (${Math.round(durationMs / 1000)}s)`);
      resolve(run);
    };

    // Spawn Claude CLI
    const claude = spawn("claude", ["-p", prompt, "--dangerously-skip-permissions"], {
      cwd: CONFIG.WORKING_DIR,
      env: { ...process.env },
    });

    currentOperativeProcess = claude;

    claude.stdout.on("data", (data) => {
      const text = data.toString();
      output += text;
      logStream.write(text);
      process.stdout.write(text);
    });

    claude.stderr.on("data", (data) => {
      const text = data.toString();
      output += text;
      logStream.write(text);
      process.stderr.write(text);
    });

    claude.on("close", (code) => {
      finish(code === 0 ? "success" : "error", code);
    });

    claude.on("error", (err) => {
      logError(`Operative ${operative} spawn error`, err);
      finish("error", null);
    });

    // Timeout handler
    setTimeout(() => {
      if (!resolved && claude.pid) {
        log(`Operative ${operative} timed out after ${CONFIG.OPERATIVE_TIMEOUT_MS / 1000}s`, "WARN");
        claude.kill("SIGKILL");
        finish("timeout", null);
      }
    }, CONFIG.OPERATIVE_TIMEOUT_MS);
  });
}

// ============================================================================
// CYCLE EXECUTION
// ============================================================================

async function runCycle(): Promise<void> {
  cycleCount++;
  log(`\n${"=".repeat(60)}`);
  log(`CYCLE ${cycleCount} STARTING`);
  log(`${"=".repeat(60)}`);

  const database = await connectDb();
  await database.collection<BrainState>("brain_state").updateOne(
    { _id: "brain" },
    { $set: { lastCycleAt: new Date(), cycleCount } }
  );

  // Always run PM first, then Developer
  // In Phase 2, we'll add smart scheduling based on conditions

  await sendHeartbeat("project-manager");
  await runOperative("project-manager");

  if (isShuttingDown) return;

  // Short pause between operatives
  await new Promise((resolve) => setTimeout(resolve, 5000));

  await sendHeartbeat("developer");
  await runOperative("developer");

  await sendHeartbeat(null);
  log(`CYCLE ${cycleCount} COMPLETE`);
}

// ============================================================================
// RESOURCE MANAGEMENT
// ============================================================================

async function cleanupLogs(): Promise<void> {
  log("Cleaning up old logs...");

  try {
    // Clean old log files
    const files = fs.readdirSync(CONFIG.LOGS_DIR);
    const now = Date.now();
    const maxAge = CONFIG.MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (file === ".gitkeep") continue;

      const filePath = path.join(CONFIG.LOGS_DIR, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        log(`Deleted old log: ${file}`);
      }
    }

    // Clean old MongoDB logs
    const database = await connectDb();
    const cutoff = new Date(Date.now() - CONFIG.MAX_MONGO_LOG_AGE_DAYS * 24 * 60 * 60 * 1000);
    const result = await database.collection("operative_runs").deleteMany({
      startedAt: { $lt: cutoff },
    });

    if (result.deletedCount > 0) {
      log(`Deleted ${result.deletedCount} old MongoDB log entries`);
    }
  } catch (error) {
    logError("Log cleanup failed", error as Error);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  log("=".repeat(60));
  log("RIIGIKOGU RADAR - THE BRAIN");
  log("=".repeat(60));
  log(`Started at: ${new Date().toISOString()}`);
  log(`PID: ${process.pid}`);
  log(`Hostname: ${os.hostname()}`);
  log(`Cycle interval: ${CONFIG.CYCLE_INTERVAL_MS / 1000 / 60} minutes`);
  log(`Operative timeout: ${CONFIG.OPERATIVE_TIMEOUT_MS / 1000 / 60} minutes`);
  log("=".repeat(60));

  // Connect to database
  await connectDb();

  // Initialize state
  const database = await connectDb();
  await database.collection<BrainState>("brain_state").updateOne(
    { _id: "brain" },
    {
      $set: {
        status: "running",
        pid: process.pid,
        hostname: os.hostname(),
        startedAt: new Date(),
        lastHeartbeat: new Date(),
        currentOperative: null,
        cycleCount: 0,
        errors: [],
      },
    },
    { upsert: true }
  );

  // Start heartbeat and watchdog
  startHeartbeat();
  startWatchdog();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log(`Received ${signal}, shutting down...`);

    // Stop intervals
    stopHeartbeat();
    stopWatchdog();

    // Kill current operative if running
    if (currentOperativeProcess?.pid) {
      log("Killing current operative...");
      currentOperativeProcess.kill("SIGKILL");
    }

    // Update state
    try {
      const database = await connectDb();
      await database.collection<BrainState>("brain_state").updateOne(
        { _id: "brain" },
        { $set: { status: "stopped", currentOperative: null } }
      );
    } catch (error) {
      logError("Failed to update shutdown state", error as Error);
    }

    // Close database
    await closeDb();

    log("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Initial cleanup
  await cleanupLogs();

  // Main loop
  while (!isShuttingDown) {
    try {
      await runCycle();
    } catch (error) {
      logError("Cycle failed", error as Error);

      // Record error in state
      try {
        const database = await connectDb();
        await database.collection<BrainState>("brain_state").updateOne(
          { _id: "brain" },
          {
            $push: {
              errors: {
                $each: [`${new Date().toISOString()}: ${(error as Error).message}`],
                $slice: -10, // Keep last 10 errors
              },
            },
          }
        );
      } catch {
        // Ignore
      }
    }

    if (isShuttingDown) break;

    // Wait for next cycle
    log(`\nSleeping for ${CONFIG.CYCLE_INTERVAL_MS / 1000 / 60} minutes...`);
    await new Promise((resolve) => setTimeout(resolve, CONFIG.CYCLE_INTERVAL_MS));

    // Periodic cleanup
    if (cycleCount % 10 === 0) {
      await cleanupLogs();
    }
  }
}

// Run
main().catch(async (error) => {
  logError("Brain fatal error", error as Error);

  try {
    const database = await connectDb();
    await database.collection<BrainState>("brain_state").updateOne(
      { _id: "brain" },
      { $set: { status: "error" } }
    );
  } catch {
    // Ignore
  }

  await closeDb();
  process.exit(1);
});
