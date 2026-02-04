#!/usr/bin/env npx tsx
/**
 * Live Operative Server
 *
 * Provides HTTP endpoints for:
 * - Triggering operatives on demand
 * - Streaming live output via Server-Sent Events (SSE)
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { spawn, ChildProcess } from "child_process";
import { MongoClient } from "mongodb";
import * as os from "os";

const PORT = process.env.OPERATIVE_SERVER_PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI!;

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
let mongoClient: MongoClient | null = null;
async function getDb() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
  }
  return mongoClient.db();
}

// Track active PM process
let activePMProcess: ChildProcess | null = null;
let activePMClients: express.Response[] = [];

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    hostname: os.hostname(),
    pmRunning: activePMProcess !== null,
    activeClients: activePMClients.length,
  });
});

// Get current status
app.get("/status", async (req, res) => {
  try {
    const db = await getDb();
    const supervisor = await db.collection("operatives_state").findOne({ type: "supervisor" });
    const operatives = await db.collection("operatives_state").find({ type: "operative" }).toArray();
    const recentLogs = await db.collection("operative_logs")
      .find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    res.json({
      supervisor,
      operatives,
      recentLogs,
      pmRunning: activePMProcess !== null,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Trigger Project Manager with SSE streaming
app.get("/trigger/project-manager", async (req, res) => {
  // Check if already running
  if (activePMProcess) {
    res.status(409).json({ error: "Project Manager is already running" });
    return;
  }

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Add client to list
  activePMClients.push(res);

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent("status", { message: "Starting Project Manager..." });

  const prompt = `You are the Project Manager operative for Riigikogu Radar.

CRITICAL: Have an original thought every time you run. Don't just check boxes — observe, analyze, and contribute something new.

Read your brain: cat ~/.claude/projects/-home-ubuntu-riigikogu-radar/memory/MEMORY.md

Then execute your session protocol:
1. Check production health: curl -s https://seosetu.ee/api/v1/health
2. Check data freshness and priorities
3. Think originally — notice something, suggest something, improve something
4. Decide if any other operative needs to run
5. Take the highest-priority autonomous action
6. Update state files with your observations

Work autonomously. Be concise - this output is streamed live.`;

  let output = "";

  activePMProcess = spawn(
    "claude",
    ["-p", prompt, "--dangerously-skip-permissions"],
    {
      cwd: "/home/ubuntu/riigikogu-radar/riigikogu-radar",
      env: { ...process.env },
    }
  );

  activePMProcess.stdout?.on("data", (data) => {
    const text = data.toString();
    output += text;
    // Send to all connected clients
    activePMClients.forEach((client) => {
      try {
        client.write(`event: output\n`);
        client.write(`data: ${JSON.stringify({ text })}\n\n`);
      } catch (e) {
        // Client disconnected
      }
    });
  });

  activePMProcess.stderr?.on("data", (data) => {
    const text = data.toString();
    output += text;
    activePMClients.forEach((client) => {
      try {
        client.write(`event: output\n`);
        client.write(`data: ${JSON.stringify({ text, stderr: true })}\n\n`);
      } catch (e) {
        // Client disconnected
      }
    });
  });

  activePMProcess.on("close", async (code) => {
    const status = code === 0 ? "success" : "error";

    // Log to MongoDB
    try {
      const db = await getDb();
      await db.collection("operative_logs").insertOne({
        operative: "project-manager",
        status,
        output: output.slice(-50000), // Last 50KB
        timestamp: new Date(),
        triggeredBy: "manual",
      });

      await db.collection("operatives_state").updateOne(
        { type: "operative", operative: "project-manager" },
        {
          $set: {
            lastRun: new Date(),
            status,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (e) {
      console.error("Failed to log to MongoDB:", e);
    }

    // Notify all clients
    activePMClients.forEach((client) => {
      try {
        client.write(`event: complete\n`);
        client.write(`data: ${JSON.stringify({ code, status })}\n\n`);
        client.end();
      } catch (e) {
        // Client disconnected
      }
    });

    activePMProcess = null;
    activePMClients = [];
  });

  activePMProcess.on("error", (err) => {
    sendEvent("error", { message: err.message });
    activePMProcess = null;
    activePMClients = [];
    res.end();
  });

  // Handle client disconnect
  req.on("close", () => {
    activePMClients = activePMClients.filter((client) => client !== res);
  });
});

// Join existing PM stream
app.get("/stream/project-manager", (req, res) => {
  if (!activePMProcess) {
    res.status(404).json({ error: "No Project Manager running" });
    return;
  }

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  activePMClients.push(res);

  res.write(`event: status\n`);
  res.write(`data: ${JSON.stringify({ message: "Connected to running Project Manager" })}\n\n`);

  req.on("close", () => {
    activePMClients = activePMClients.filter((client) => client !== res);
  });
});

// Stop running PM
app.post("/stop/project-manager", (req, res) => {
  if (!activePMProcess) {
    res.status(404).json({ error: "No Project Manager running" });
    return;
  }

  activePMProcess.kill("SIGTERM");
  res.json({ message: "Stop signal sent" });
});

app.listen(PORT, () => {
  console.log(`Live Operative Server running on port ${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /health - Health check`);
  console.log(`  GET  /status - Current status`);
  console.log(`  GET  /trigger/project-manager - Trigger PM with SSE streaming`);
  console.log(`  GET  /stream/project-manager - Join existing PM stream`);
  console.log(`  POST /stop/project-manager - Stop running PM`);
});
