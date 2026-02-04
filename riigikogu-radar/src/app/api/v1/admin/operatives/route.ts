import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";

const STATE_DIR = path.join(process.cwd(), ".context/state");
const LOGS_DIR = path.join(process.cwd(), "logs/operatives");

interface OperativeStatus {
  id: string;
  name: string;
  pillar: string;
  lastRun: string | null;
  status: "success" | "error" | "running" | "never";
  nextRun: string | null;
}

interface SupervisorStatus {
  running: boolean;
  started: string | null;
  pid: number | null;
  totalRuns: number;
  lastPMRun: string | null;
}

function getOperativeState(): Record<string, any> {
  const stateFile = path.join(STATE_DIR, "operatives.json");
  try {
    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    }
  } catch (e) {
    // Ignore
  }
  return { lastRun: {}, lastStatus: {}, lastOutput: {} };
}

function getSupervisorState(): SupervisorStatus {
  const stateFile = path.join(STATE_DIR, "supervisor.json");
  try {
    if (fs.existsSync(stateFile)) {
      const data = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
      return {
        running: data.status === "running",
        started: data.started || null,
        pid: data.pid || null,
        totalRuns: data.totalRuns || 0,
        lastPMRun: data.lastPMRun || null,
      };
    }
  } catch (e) {
    // Ignore
  }
  return {
    running: false,
    started: null,
    pid: null,
    totalRuns: 0,
    lastPMRun: null,
  };
}

function getRecentLogs(limit: number = 10): Array<{ file: string; timestamp: string; operative: string }> {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      return [];
    }

    const files = fs.readdirSync(LOGS_DIR)
      .filter(f => f.endsWith(".log") && f !== "supervisor.log")
      .map(f => {
        const parts = f.replace(".log", "").split("-");
        const operative = parts[0];
        const timestamp = parts.slice(1).join("-").replace(/-/g, (m, i) =>
          i < 10 ? "-" : i === 10 ? "T" : i === 13 || i === 16 ? ":" : "."
        );
        return { file: f, timestamp, operative };
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);

    return files;
  } catch (e) {
    return [];
  }
}

function getLogContent(filename: string): string | null {
  try {
    const logPath = path.join(LOGS_DIR, filename);
    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, "utf-8");
      // Return last 500 lines max
      const lines = content.split("\n");
      return lines.slice(-500).join("\n");
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // Get specific log content
  if (action === "log") {
    const file = searchParams.get("file");
    if (!file) {
      return NextResponse.json({ error: "Missing file parameter" }, { status: 400 });
    }
    const content = getLogContent(file);
    return NextResponse.json({ content });
  }

  // Default: return full status
  const opState = getOperativeState();
  const supervisorState = getSupervisorState();

  const operatives: OperativeStatus[] = [
    {
      id: "project-manager",
      name: "Project Manager",
      pillar: "ALL",
      lastRun: opState.lastRun?.["project-manager"] || supervisorState.lastPMRun || null,
      status: opState.lastStatus?.["project-manager"] || (supervisorState.lastPMRun ? "success" : "never"),
      nextRun: null, // PM runs on interval
    },
    {
      id: "collector",
      name: "Collector",
      pillar: "COLLECT",
      lastRun: opState.lastRun?.["collector"] || null,
      status: opState.lastStatus?.["collector"] || "never",
      nextRun: null,
    },
    {
      id: "analyst",
      name: "Analyst",
      pillar: "ANALYZE",
      lastRun: opState.lastRun?.["analyst"] || null,
      status: opState.lastStatus?.["analyst"] || "never",
      nextRun: null,
    },
    {
      id: "predictor",
      name: "Predictor",
      pillar: "PREDICT",
      lastRun: opState.lastRun?.["predictor"] || null,
      status: opState.lastStatus?.["predictor"] || "never",
      nextRun: null,
    },
    {
      id: "guardian",
      name: "Guardian",
      pillar: "HEALTH",
      lastRun: opState.lastRun?.["guardian"] || null,
      status: opState.lastStatus?.["guardian"] || "never",
      nextRun: null,
    },
  ];

  const recentLogs = getRecentLogs(20);

  return NextResponse.json({
    supervisor: supervisorState,
    operatives,
    recentLogs,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  // Check authentication
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action, operative } = body;

  if (action === "trigger") {
    // This would trigger an operative run
    // For now, just return acknowledgment - actual triggering needs server-side execution
    return NextResponse.json({
      message: `Trigger request for ${operative} acknowledged`,
      note: "Manual triggering will be executed on next supervisor cycle",
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
