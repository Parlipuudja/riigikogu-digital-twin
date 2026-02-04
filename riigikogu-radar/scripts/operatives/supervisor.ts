#!/usr/bin/env npx tsx
/**
 * Operative Supervisor
 *
 * Runs continuously, executing Project Manager and Developer at intervals.
 * Both operatives ALWAYS run - there is no idle state.
 * State is stored in MongoDB for access from admin dashboard.
 */

import "dotenv/config";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { MongoClient } from "mongodb";

const LOGS_DIR = path.join(__dirname, "../../logs/operatives");
const RUN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes between cycles
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
  lastDevRun: Date | null;
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

async function runOperative(operative: string, prompt: string): Promise<boolean> {
  const timestamp = new Date().toISOString();
  const logFile = path.join(LOGS_DIR, `${operative}-${timestamp.replace(/[:.]/g, "-")}.log`);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${timestamp}] Starting ${operative.toUpperCase()} run...`);
  console.log(`${"=".repeat(60)}`);

  return new Promise((resolve) => {
    const logStream = fs.createWriteStream(logFile);
    let output = "";

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
      console.log(`\n[${new Date().toISOString()}] ${operative.toUpperCase()} finished with code ${code}`);

      // Log to MongoDB
      await logOperativeRun(operative, status, output);

      resolve(code === 0);
    });

    claude.on("error", async (err) => {
      logStream.end();
      console.error(`[${new Date().toISOString()}] ${operative.toUpperCase()} error:`, err);

      // Log to MongoDB
      await logOperativeRun(operative, "error", err.message);

      resolve(false);
    });
  });
}

const PM_PROMPT = `You are the Project Manager operative for Riigikogu Radar.

Read your operative definition:
cat .context/operatives/00-project-manager.md

Read your brain:
cat ~/.claude/projects/-home-ubuntu-riigikogu-radar/memory/MEMORY.md

Then execute your session protocol:
1. Check production health: curl -s https://seosetu.ee/api/v1/health
2. Review priorities: cat .context/action/priorities.md
3. Review blockers: cat .context/state/blockers.json
4. THINK: What's the biggest gap right now?
5. Take strategic action:
   - Update the brain if it's stale or unclear
   - Update priorities if they've changed
   - Create a report if it's been a while
   - Document any blockers you discover
6. Decide what the Developer should focus on next
7. Update state files with results

You are ALWAYS WORKING. Strategic thinking is work. Brain maintenance is work.
Do not ask for permission. Be concise in output.`;

const DEV_PROMPT = `You are the Developer operative for Riigikogu Radar.

Read your operative definition:
cat .context/operatives/05-developer.md

Read your brain:
cat ~/.claude/projects/-home-ubuntu-riigikogu-radar/memory/MEMORY.md

Then execute your session protocol:
1. Read priorities: cat .context/action/priorities.md
2. Read blockers: cat .context/state/blockers.json
3. Pick the highest-priority unblocked implementation task
4. Write code to implement it
5. Test: npm run build
6. If build passes: git add, commit, push
7. Update priorities.md with progress
8. Continue to next task if time permits

You are ALWAYS WORKING. There is always code to write or improve.
If no clear priority, improve existing code quality or add tests.
Do not ask for permission. Ship code every session.`;

async function runCycle(state: SupervisorState | null): Promise<void> {
  // Run Project Manager first
  await updateSupervisorState({ lastPMRun: new Date() });
  await runOperative("project-manager", PM_PROMPT);

  // Short pause between operatives
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Run Developer second
  await updateSupervisorState({ lastDevRun: new Date() });
  await runOperative("developer", DEV_PROMPT);

  // Update total runs
  await updateSupervisorState({
    totalRuns: (state?.totalRuns || 0) + 1,
  });
}

async function main() {
  console.log("=".repeat(60));
  console.log("Riigikogu Radar - Operative Supervisor");
  console.log("=".repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Run interval: ${RUN_INTERVAL_MS / 1000 / 60} minutes`);
  console.log(`PID: ${process.pid}`);
  console.log(`Operatives: PROJECT MANAGER + DEVELOPER (both ALWAYS run)`);
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
      await runCycle(state);
    } else {
      console.log(`[${new Date().toISOString()}] Skipping - only ${Math.round(timeSinceLastRun / 1000)}s since last run`);
    }

    // Wait for next interval
    console.log(`\n[${new Date().toISOString()}] Sleeping for ${RUN_INTERVAL_MS / 1000 / 60} minutes...`);
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
