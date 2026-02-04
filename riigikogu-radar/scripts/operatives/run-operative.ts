#!/usr/bin/env npx tsx
/**
 * Operative Runner
 *
 * Executes a Claude Code operative with the appropriate prompt
 * and logs output for monitoring.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

const OPERATIVES_DIR = path.join(__dirname, "../../.context/operatives");
const LOGS_DIR = path.join(__dirname, "../../logs/operatives");
const STATE_FILE = path.join(__dirname, "../../.context/state/operatives.json");

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

interface OperativeState {
  lastRun: Record<string, string>;
  lastStatus: Record<string, "success" | "error" | "running">;
  lastOutput: Record<string, string>;
}

function loadState(): OperativeState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to load state:", e);
  }
  return { lastRun: {}, lastStatus: {}, lastOutput: {} };
}

function saveState(state: OperativeState): void {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getOperativePrompt(operative: string): string {
  const prompts: Record<string, string> = {
    "project-manager": `You are the Project Manager operative. Read your brain at ~/.claude/projects/-home-ubuntu-riigikogu-radar/memory/MEMORY.md and execute your session protocol. Check system health, review priorities, and take autonomous action. Update state files after completing work.`,

    "collector": `You are the Collector operative. Your mission: keep data fresh (<24h). Run npm run db:sync if needed. Report results.`,

    "analyst": `You are the Analyst operative. Your mission: 100% embedding coverage. Check for unembedded data and generate embeddings if needed.`,

    "predictor": `You are the Predictor operative. Your mission: validate 85%+ accuracy. Run backtests if >7 days since last run.`,

    "guardian": `You are the Guardian operative. Your mission: 99%+ uptime. Check production health and report any issues.`,
  };

  return prompts[operative] || prompts["project-manager"];
}

async function runOperative(operative: string): Promise<{ success: boolean; output: string }> {
  const state = loadState();
  const timestamp = new Date().toISOString();
  const logFile = path.join(LOGS_DIR, `${operative}-${timestamp.replace(/[:.]/g, "-")}.log`);

  console.log(`[${timestamp}] Starting operative: ${operative}`);

  // Update state to running
  state.lastRun[operative] = timestamp;
  state.lastStatus[operative] = "running";
  saveState(state);

  const prompt = getOperativePrompt(operative);

  return new Promise((resolve) => {
    const logStream = fs.createWriteStream(logFile);
    let output = "";

    // Run Claude Code with the operative prompt
    const claude = spawn("claude", ["-p", prompt, "--dangerously-skip-permissions"], {
      cwd: "/home/ubuntu/riigikogu-radar/riigikogu-radar",
      env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: "cli" },
    });

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
      logStream.end();

      const success = code === 0;
      state.lastStatus[operative] = success ? "success" : "error";
      state.lastOutput[operative] = logFile;
      saveState(state);

      console.log(`[${new Date().toISOString()}] Operative ${operative} finished with code ${code}`);

      resolve({ success, output });
    });

    claude.on("error", (err) => {
      logStream.end();

      state.lastStatus[operative] = "error";
      state.lastOutput[operative] = logFile;
      saveState(state);

      console.error(`[${new Date().toISOString()}] Operative ${operative} failed:`, err);

      resolve({ success: false, output: err.message });
    });
  });
}

// Main execution
const operative = process.argv[2] || "project-manager";
runOperative(operative).then(({ success }) => {
  process.exit(success ? 0 : 1);
});
