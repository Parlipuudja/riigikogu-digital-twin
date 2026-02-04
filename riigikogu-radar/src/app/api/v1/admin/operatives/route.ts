import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/data/mongodb";

export const dynamic = "force-dynamic";

interface OperativeStatus {
  id: string;
  name: string;
  pillar: string;
  lastRun: string | null;
  status: "success" | "error" | "running" | "never";
}

interface SupervisorStatus {
  running: boolean;
  started: string | null;
  pid: number | null;
  totalRuns: number;
  lastPMRun: string | null;
  hostname: string | null;
}

interface LogEntry {
  operative: string;
  timestamp: string;
  status: string;
  output?: string;
}

const OPERATIVE_DEFINITIONS = [
  { id: "project-manager", name: "Project Manager", pillar: "ALL" },
  { id: "collector", name: "Collector", pillar: "COLLECT" },
  { id: "analyst", name: "Analyst", pillar: "ANALYZE" },
  { id: "predictor", name: "Predictor", pillar: "PREDICT" },
  { id: "guardian", name: "Guardian", pillar: "HEALTH" },
];

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    const stateCollection = await getCollection("operatives_state");
    const logsCollection = await getCollection("operative_logs");

    // Get specific log content
    if (action === "log") {
      const logId = searchParams.get("id");
      if (!logId) {
        return NextResponse.json({ error: "Missing log ID" }, { status: 400 });
      }

      const { ObjectId } = await import("mongodb");
      const log = await logsCollection.findOne({ _id: new ObjectId(logId) });
      return NextResponse.json({ content: log?.output || "No content" });
    }

    // Get supervisor state
    const supervisorDoc = await stateCollection.findOne({ type: "supervisor" });
    const supervisorState: SupervisorStatus = {
      running: supervisorDoc?.running || false,
      started: supervisorDoc?.started?.toISOString() || null,
      pid: supervisorDoc?.pid || null,
      totalRuns: supervisorDoc?.totalRuns || 0,
      lastPMRun: supervisorDoc?.lastPMRun?.toISOString() || null,
      hostname: supervisorDoc?.hostname || null,
    };

    // Get operative states
    const operativeDocs = await stateCollection.find({ type: "operative" }).toArray();
    const operativeStates = new Map(
      operativeDocs.map((doc) => [doc.operative, doc])
    );

    const operatives: OperativeStatus[] = OPERATIVE_DEFINITIONS.map((def) => {
      const state = operativeStates.get(def.id);
      return {
        id: def.id,
        name: def.name,
        pillar: def.pillar,
        lastRun: state?.lastRun?.toISOString() || null,
        status: state?.status || "never",
      };
    });

    // Get recent logs
    const recentLogDocs = await logsCollection
      .find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();

    const recentLogs: LogEntry[] = recentLogDocs.map((doc) => ({
      id: doc._id.toString(),
      operative: doc.operative,
      timestamp: doc.timestamp?.toISOString() || new Date().toISOString(),
      status: doc.status,
    }));

    return NextResponse.json({
      supervisor: supervisorState,
      operatives,
      recentLogs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching operative data:", error);
    return NextResponse.json(
      { error: "Failed to fetch operative data" },
      { status: 500 }
    );
  }
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
    // Note: This just logs the intent - actual triggering requires server-side execution
    return NextResponse.json({
      message: `Trigger request for ${operative} acknowledged`,
      note: "Manual triggering will be executed on next supervisor cycle",
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
