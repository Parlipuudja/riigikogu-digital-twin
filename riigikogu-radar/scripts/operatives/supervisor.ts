#!/usr/bin/env npx tsx
/**
 * Operative Supervisor
 *
 * Runs continuously, executing the Project Manager at intervals.
 * The Project Manager decides when to trigger other operatives.
 */

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

const STATE_FILE = path.join(__dirname, "../../.context/state/operatives.json");
const LOGS_DIR = path.join(__dirname, "../../logs/operatives");
const RUN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes minimum between runs

interface SupervisorState {
  started: string;
  lastPMRun: string | null;
  totalRuns: number;
  status: "running" | "stopped" | "paused";
  pid: number;
}

function loadSupervisorState(): SupervisorState {
  const stateFile = path.join(__dirname, "../../.context/state/supervisor.json");
  try {
    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    }
  } catch (e) {
    // Ignore
  }
  return {
    started: new Date().toISOString(),
    lastPMRun: null,
    totalRuns: 0,
    status: "running",
    pid: process.pid,
  };
}

function saveSupervisorState(state: SupervisorState): void {
  const stateFile = path.join(__dirname, "../../.context/state/supervisor.json");
  const dir = path.dirname(stateFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

async function runProjectManager(): Promise<boolean> {
  const timestamp = new Date().toISOString();
  const logFile = path.join(LOGS_DIR, `pm-${timestamp.replace(/[:.]/g, "-")}.log`);

  // Ensure logs directory exists
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }

  console.log(`[${timestamp}] Starting Project Manager run...`);

  return new Promise((resolve) => {
    const logStream = fs.createWriteStream(logFile);

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
      logStream.write(text);
      process.stdout.write(text);
    });

    claude.stderr.on("data", (data) => {
      const text = data.toString();
      logStream.write(text);
      process.stderr.write(text);
    });

    claude.on("close", (code) => {
      logStream.end();
      console.log(`[${new Date().toISOString()}] Project Manager finished with code ${code}`);
      resolve(code === 0);
    });

    claude.on("error", (err) => {
      logStream.end();
      console.error(`[${new Date().toISOString()}] Project Manager error:`, err);
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

  const state = loadSupervisorState();
  state.started = new Date().toISOString();
  state.status = "running";
  state.pid = process.pid;
  saveSupervisorState(state);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nReceived SIGINT, shutting down...");
    state.status = "stopped";
    saveSupervisorState(state);
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\nReceived SIGTERM, shutting down...");
    state.status = "stopped";
    saveSupervisorState(state);
    process.exit(0);
  });

  // Main loop
  while (true) {
    // Check if we should run
    const now = Date.now();
    const lastRun = state.lastPMRun ? new Date(state.lastPMRun).getTime() : 0;
    const timeSinceLastRun = now - lastRun;

    if (timeSinceLastRun >= MIN_INTERVAL_MS) {
      state.lastPMRun = new Date().toISOString();
      state.totalRuns++;
      saveSupervisorState(state);

      await runProjectManager();
    }

    // Wait for next interval
    console.log(`[${new Date().toISOString()}] Sleeping for ${RUN_INTERVAL_MS / 1000 / 60} minutes...`);
    await new Promise((resolve) => setTimeout(resolve, RUN_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error("Supervisor fatal error:", err);
  process.exit(1);
});
