/**
 * Brain Chat API
 *
 * Provides instant natural language communication with the brain.
 * Messages are processed immediately via Claude API and stored in MongoDB.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/data/mongodb";
import Anthropic from "@anthropic-ai/sdk";

interface ChatMessage {
  role: "human" | "brain";
  content: string;
  timestamp: Date;
  actionItems?: string[];
  processed?: boolean;
}

interface Conversation {
  _id?: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// System prompt for the brain
const BRAIN_SYSTEM_PROMPT = `You are the Brain of Riigikogu Radar, an autonomous parliamentary intelligence system for Estonia.

You are speaking directly with your human operator. Be helpful, concise, and proactive.

## Your Capabilities
- You manage priorities for the system (stored in .context/action/priorities.md)
- You coordinate PM and Developer operatives that run every 30 minutes
- You have access to parliamentary data: votings, stenograms, MPs, predictions
- You generate daily self-reports

## Current System State
{SYSTEM_STATE}

## Current Priorities
{PRIORITIES}

## How to Respond
1. Answer questions directly and concisely
2. If the human asks you to do something, acknowledge it and explain what will happen
3. If it's a priority change, note it as an ACTION ITEM that the PM operative will execute
4. Be honest about what you can and cannot do immediately vs. what requires operative action

## Action Items
If the human requests something that requires action (code changes, priority updates, etc.), include it in your response as:
ACTION: [description of what needs to be done]

The PM operative will see these and execute them in the next cycle.

Respond naturally, as if you are a helpful AI assistant managing this parliamentary intelligence system.`;

async function getSystemContext(): Promise<{ state: string; priorities: string }> {
  const db = await getDatabase();

  // Get brain state
  const brainState = await db.collection("brain_state").findOne({ _id: "brain" as unknown as import("mongodb").ObjectId });

  // Get stats
  const votings = await db.collection("votings").countDocuments();
  const stenograms = await db.collection("stenograms").countDocuments();
  const mps = await db.collection("mps").countDocuments({ isActive: true });

  // Get recent operative runs
  const recentRuns = await db.collection("operative_runs")
    .find({})
    .sort({ startedAt: -1 })
    .limit(5)
    .toArray();

  const state = `
Status: ${brainState?.status || "unknown"}
Last Heartbeat: ${brainState?.lastHeartbeat || "unknown"}
Cycle Count: ${brainState?.cycleCount || 0}
Data: ${votings} votings, ${stenograms} stenograms, ${mps} MPs
Recent Runs: ${recentRuns.map(r => `${r.operative}:${r.status}`).join(", ") || "none"}
`.trim();

  // Get priorities from file (simplified - in production would read from git or MongoDB)
  const priorities = `
P0: Living Brain - Phase 1 Complete, Phase 2 in progress
P1: Auto-sync (Vercel cron) - Not started
P2: Proactive predictions (/upcoming) - Not started
P3: Enhance Insights page - Exists, needs work
P4: Temporal analysis - Not started
`.trim();

  return { state, priorities };
}

async function getChatHistory(): Promise<ChatMessage[]> {
  const db = await getDatabase();
  const conversation = await db.collection<Conversation>("brain_chat")
    .findOne({}, { sort: { updatedAt: -1 } });

  return conversation?.messages || [];
}

async function saveChatMessage(message: ChatMessage): Promise<void> {
  const db = await getDatabase();
  const today = new Date().toISOString().split("T")[0];

  await db.collection("brain_chat").updateOne(
    { date: today },
    {
      $push: { messages: message } as never,
      $set: { updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date(), date: today }
    } as never,
    { upsert: true }
  );
}

async function saveActionItem(action: string, fromMessage: string): Promise<void> {
  const db = await getDatabase();

  await db.collection("brain_action_items").insertOne({
    action,
    fromMessage,
    status: "pending",
    createdAt: new Date(),
    processedAt: null,
    processedBy: null
  });
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    // Save human message
    const humanMessage: ChatMessage = {
      role: "human",
      content: message,
      timestamp: new Date()
    };
    await saveChatMessage(humanMessage);

    // Get context
    const { state, priorities } = await getSystemContext();
    const history = await getChatHistory();

    // Build conversation for Claude
    const systemPrompt = BRAIN_SYSTEM_PROMPT
      .replace("{SYSTEM_STATE}", state)
      .replace("{PRIORITIES}", priorities);

    // Get recent messages for context (last 10)
    const recentMessages: Array<{ role: "user" | "assistant"; content: string }> = history.slice(-10).map(m => ({
      role: m.role === "human" ? "user" as const : "assistant" as const,
      content: m.content
    }));

    // Add current message
    recentMessages.push({ role: "user", content: message });

    // Call Claude API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: recentMessages
    }).catch(async () => {
      // Fallback to claude-3-5-sonnet if newer model not available
      return anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        system: systemPrompt,
        messages: recentMessages
      });
    });

    const brainResponse = response.content[0].type === "text"
      ? response.content[0].text
      : "I couldn't generate a response.";

    // Extract action items
    const actionItems: string[] = [];
    const actionRegex = /ACTION:\s*(.+?)(?:\n|$)/g;
    let match;
    while ((match = actionRegex.exec(brainResponse)) !== null) {
      actionItems.push(match[1].trim());
      await saveActionItem(match[1].trim(), message);
    }

    // Save brain response
    const brainMessage: ChatMessage = {
      role: "brain",
      content: brainResponse,
      timestamp: new Date(),
      actionItems: actionItems.length > 0 ? actionItems : undefined
    };
    await saveChatMessage(brainMessage);

    return NextResponse.json({
      success: true,
      data: {
        response: brainResponse,
        actionItems,
        timestamp: brainMessage.timestamp
      }
    });

  } catch (error) {
    console.error("Brain chat error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to process message: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const db = await getDatabase();
    const today = new Date().toISOString().split("T")[0];

    // Get today's conversation
    const conversation = await db.collection("brain_chat")
      .findOne({ date: today });

    // Get pending action items
    const actionItems = await db.collection("brain_action_items")
      .find({ status: "pending" })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    return NextResponse.json({
      success: true,
      data: {
        messages: conversation?.messages || [],
        pendingActions: actionItems
      }
    });

  } catch (error) {
    console.error("Brain chat error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
