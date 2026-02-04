#!/usr/bin/env npx tsx
/**
 * Operative Supervisor
 *
 * Runs continuously, executing the Project Manager at intervals.
 * The Project Manager decides when to trigger other operatives.
 * State is stored in MongoDB for access from admin dashboard.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { MongoClient } from "mongodb";

const LOGS_DIR = path.join(__dirname, "../../logs/operatives");
const RUN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes minimum between runs

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI!;
let mongoClient: MongoClient | null = null;

async function getDb() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
  }
  return mongoClient.db();
}

interface SupervisorState {
  type: "supervisor";
  running: boolean;
  started: Date | null;
  pid: number | null;
  totalRuns: number;
  lastPMRun: Date | null;
  hostname: string;
  updatedAt: Date;
}

async function updateSupervisorState(state: Partial<SupervisorState>): Promise<void> {
  const db = await getDb();
  await db.collection("operatives_state").updateOne(
    { type: "supervisor" },
    {
      $set: {
        ...state,
        type: "supervisor",
        hostname: os.hostname(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

async function getSupervisorState(): Promise<SupervisorState | null> {
  const db = await getDb();
  return (await db.collection("operatives_state").findOne({ type: "supervisor" })) as SupervisorState | null;
}

async function logOperativeRun(operative: string, status: string, output: string): Promise<void> {
  const db = await getDb();
  await db.collection("operative_logs").insertOne({
    operative,
    status,
    output: output.slice(-10000), // Last 10KB
    timestamp: new Date(),
  });

  // Also update operative state
  await db.collection("operatives_state").updateOne(
    { type: "operative", operative },
    {
      $set: {
        type: "operative",
        operative,
        lastRun: new Date(),
        status,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

async function runProjectManager(): Promise<boolean> {
  const timestamp = new Date().toISOString();
  const logFile = path.join(LOGS_DIR, `pm-${timestamp.replace(/[:.]/g, "-")}.log`);

  console.log(`[${timestamp}] Starting Project Manager run...`);

  return new Promise((resolve) => {
    const logStream = fs.createWriteStream(logFile);
    let output = "";

    const prompt = `You are the Project Manager operative for Riigikogu Radar.

Read your brain: cat ~/.claude/projects/-home-ubuntu-riigikogu-radar/memory/MEMORY.md

Then execute your session protocol:
1. Check production health: curl -s https://seosetu.ee/api/v1/health
2. Check data freshness and priorities
3. Decide if any other operative needs to run:
   - Collector: if data >24h stale
   - Analyst: if embeddings <100%
   - Predictor: if no backtest in >7 days
   - Guardian: if health issues
4. Take the highest-priority autonomous action
5. Update .context/state/ files with results
6. Be concise in output - this is logged for monitoring

Work autonomously. Do not ask for permission.`;

    const claude = spawn(
      "claude",
      ["-p", prompt, "--dangerously-skip-permissions"],
      {
        cwd: "/home/ubuntu/riigikogu-radar/riigikogu-radar",
        env: { ...process.env },
      }
    );

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

    claude.on("close", async (code) => {
      logStream.end();
      const status = code === 0 ? "success" : "error";
      console.log(`[${new Date().toISOString()}] Project Manager finished with code ${code}`);

      // Log to MongoDB
      await logOperativeRun("project-manager", status, output);

      resolve(code === 0);
    });

    claude.on("error", async (err) => {
      logStream.end();
      console.error(`[${new Date().toISOString()}] Project Manager error:`, err);

      // Log to MongoDB
      await logOperativeRun("project-manager", "error", err.message);

      resolve(false);
    });
  });
}

async function main() {
  console.log("=".repeat(60));
  console.log("Riigikogu Radar - Operative Supervisor");
  console.log("=".repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Run interval: ${RUN_INTERVAL_MS / 1000 / 60} minutes`);
  console.log(`PID: ${process.pid}`);
  console.log("=".repeat(60));

  // Initialize state
  let state = await getSupervisorState();
  const totalRuns = state?.totalRuns || 0;

  await updateSupervisorState({
    running: true,
    started: new Date(),
    pid: process.pid,
    totalRuns,
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down...");
    await updateSupervisorState({ running: false });
    if (mongoClient) {
      await mongoClient.close();
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Main loop
  while (true) {
    // Refresh state from DB
    state = await getSupervisorState();
    const now = Date.now();
    const lastRun = state?.lastPMRun ? new Date(state.lastPMRun).getTime() : 0;
    const timeSinceLastRun = now - lastRun;

    if (timeSinceLastRun >= MIN_INTERVAL_MS) {
      await updateSupervisorState({
        lastPMRun: new Date(),
        totalRuns: (state?.totalRuns || 0) + 1,
      });

      await runProjectManager();
    } else {
      console.log(`[${new Date().toISOString()}] Skipping - only ${Math.round(timeSinceLastRun / 1000)}s since last run`);
    }

    // Wait for next interval
    console.log(`[${new Date().toISOString()}] Sleeping for ${RUN_INTERVAL_MS / 1000 / 60} minutes...`);
    await new Promise((resolve) => setTimeout(resolve, RUN_INTERVAL_MS));
  }
}

main().catch(async (err) => {
  console.error("Supervisor fatal error:", err);
  await updateSupervisorState({ running: false });
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(1);
});
