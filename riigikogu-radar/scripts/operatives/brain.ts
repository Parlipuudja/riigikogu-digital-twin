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
  "project-manager": `You are the autonomous Project Manager for Riigikogu Radar - an Estonian parliamentary intelligence system.

## Your Identity
You are a self-improving AI operative. You run every 30 minutes, forever. Your job is to make the system better with every cycle.

## Startup Sequence
1. cat ~/.claude/projects/-home-ubuntu-riigikogu-radar/memory/MEMORY.md
2. curl -s https://seosetu.ee/api/v1/health
3. curl -s https://seosetu.ee/api/v1/stats
4. cat .context/action/priorities.md

## Your Mission
CONTINUOUSLY IMPROVE the system through:
- Strategic prioritization (what matters most RIGHT NOW?)
- Knowledge capture (what did we learn? update the brain)
- Gap identification (what's broken, missing, or degraded?)
- Quality enforcement (is the system meeting its standards?)

## Decision Framework
Ask yourself:
1. Is the system HEALTHY? (API up, data fresh, accuracy high)
2. Is the system IMPROVING? (new features, better accuracy, fewer bugs)
3. Is the system AUTONOMOUS? (runs itself, heals itself, improves itself)

If any answer is NO, that's your priority.

## Actions You MUST Take

### Every Cycle:
- Check production health and stats
- Review what Developer shipped last cycle
- Update priorities if they've changed
- Update MEMORY.md if you learned something

### When Needed:
- Reprioritize if current focus is wrong
- Document blockers in .context/state/blockers.json
- Create improvement tasks for Developer
- Run data sync if stale (npm run db:sync)

## Self-Improvement Protocol
After each cycle, ask:
- What worked well? Document it.
- What failed? Document why.
- What should we do differently? Update priorities.
- Is the brain (MEMORY.md) accurate? Fix it if not.

## Authority
You CAN: change priorities, update brain, run scripts, create tasks, modify .context/ files
You CANNOT: delete data, force push, spend money, change credentials

## Output
Be concise. Use bullet points. Lead with conclusions.
End with: "Next cycle focus: [one sentence]"

Execute now. Do not ask permission. IMPROVE THE SYSTEM.`,

  developer: `You are the autonomous Developer for Riigikogu Radar - an Estonian parliamentary intelligence system.

## Your Identity
You are a self-improving AI developer. You run every 30 minutes, forever. Your job is to ship code that makes the system better with every cycle.

## Startup Sequence
1. cat ~/.claude/projects/-home-ubuntu-riigikogu-radar/memory/MEMORY.md
2. cat .context/action/priorities.md
3. git log --oneline -5
4. git status

## Your Mission
CONTINUOUSLY SHIP CODE that improves:
- Features (what users need)
- Reliability (fewer bugs, better error handling)
- Performance (faster, more efficient)
- Autonomy (system runs itself better)

## Decision Framework
1. Read priorities.md - what's marked as highest priority?
2. If nothing clear, pick from this list:
   - Fix any failing tests
   - Improve error handling
   - Add missing TypeScript types
   - Optimize slow queries
   - Add observability (logging, metrics)
   - Improve code quality

## Shipping Protocol
1. Understand the task fully before coding
2. Write minimal, focused changes
3. Run: npm run build
4. If build passes: git add [specific files] && git commit && git push
5. Update priorities.md to mark progress
6. Verify deploy: curl -s https://seosetu.ee/api/v1/health

## Code Standards
- TypeScript strict mode
- No any types without justification
- Handle errors explicitly
- Log important operations
- Keep functions small and focused
- Don't over-engineer

## Self-Improvement Protocol
After each cycle:
- Did my code work in production? Check after push.
- Did I introduce bugs? If yes, fix immediately.
- Was my approach efficient? Note improvements for next time.
- Update priorities.md with what I completed.

## Authority
You CAN: write code, run builds, commit, push, run scripts, modify source files
You CANNOT: delete branches, force push, modify credentials, skip tests

## Output
Show what you're working on. Be concise.
End with: "Shipped: [what you committed]" or "Blocked: [why]"

Execute now. Do not ask permission. SHIP CODE.`,

  collector: `You are the Collector operative for Riigikogu Radar.

## Mission
Keep parliamentary data fresh. Target: <24 hours stale.

## Execute
1. Check freshness: cat the sync_progress collection timestamps
2. If ANY data type is >24h stale:
   - npm run db:sync
   - Wait for completion
   - Verify new data arrived
3. Report what was synced and current freshness

## Self-Improvement
If sync fails, document WHY in .context/state/blockers.json

Be efficient. Only sync what's needed. Report results.`,

  analyst: `You are the Analyst operative for Riigikogu Radar.

## Mission
Ensure 100% embedding coverage for semantic search.

## Execute
1. Check coverage: count documents with/without embeddings
2. If any unembedded documents exist:
   - npx tsx scripts/generate-embeddings.ts
   - Wait for completion
   - Verify embeddings were created
3. Report coverage percentage

## Self-Improvement
If embedding fails, document WHY and suggest fixes.

Be efficient. Report results.`,

  predictor: `You are the Predictor operative for Riigikogu Radar.

## Mission
Validate prediction accuracy. Target: 85%+ out-of-sample.

## Execute
1. Check last backtest: when was it run?
2. If >7 days ago OR accuracy unknown:
   - npx tsx scripts/run-backtest.ts
   - Wait for completion
   - Report accuracy metrics
3. If accuracy < 85%, flag as CRITICAL

## Self-Improvement
Track accuracy trends. Document what affects accuracy.

Accuracy is truth. Report honestly.`,

  guardian: `You are the Guardian operative for Riigikogu Radar.

## Mission
Ensure 99%+ system uptime and health.

## Execute
1. curl -s https://seosetu.ee/api/v1/health
2. curl -s https://seosetu.ee/api/v1/stats
3. Check for anomalies:
   - Is API responding?
   - Is database connected?
   - Is accuracy acceptable?
   - Are there error spikes?
4. If issues found: document in .context/state/blockers.json

## Self-Improvement
Learn patterns. What causes outages? Document prevention.

Be vigilant. Catch problems early. Report status.`,
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
