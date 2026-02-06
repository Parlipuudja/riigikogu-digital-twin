/**
 * Brain Chat API - Full Agent Mode
 *
 * Provides Claude Code-level power via the brain chat interface.
 * The brain can read/write files, run commands, query database, and more.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/data/mongodb";
import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const WORKING_DIR = "/home/ubuntu/riigikogu-radar/riigikogu-radar";
const MAX_ITERATIONS = 10;

interface ChatMessage {
  role: "human" | "brain";
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
}

// Tool definitions for the brain
const TOOLS: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file. Use this to understand code, configs, or data files.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Path to the file (relative to project root or absolute)" }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file",
    description: "Write content to a file. Creates the file if it doesn't exist.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Path to the file" },
        content: { type: "string", description: "Content to write" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "run_command",
    description: "Run a bash command. Use for git, npm, curl, database queries, etc. Be careful with destructive commands.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "The bash command to run" },
        timeout: { type: "number", description: "Timeout in seconds (default 30)" }
      },
      required: ["command"]
    }
  },
  {
    name: "list_files",
    description: "List files in a directory with optional pattern matching.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Directory path (default: project root)" },
        pattern: { type: "string", description: "Glob pattern to filter files (e.g., '*.ts')" }
      },
      required: []
    }
  },
  {
    name: "search_code",
    description: "Search for a pattern in the codebase using grep.",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: { type: "string", description: "Regex pattern to search for" },
        path: { type: "string", description: "Directory to search in (default: src/)" },
        fileType: { type: "string", description: "File extension to filter (e.g., 'ts', 'tsx')" }
      },
      required: ["pattern"]
    }
  },
  {
    name: "query_database",
    description: "Query MongoDB directly. Returns JSON results.",
    input_schema: {
      type: "object" as const,
      properties: {
        collection: { type: "string", description: "Collection name (e.g., 'mps', 'votings', 'brain_state')" },
        operation: { type: "string", enum: ["find", "findOne", "count", "aggregate"], description: "Operation type" },
        query: { type: "string", description: "JSON query string (e.g., '{\"isActive\": true}')" },
        limit: { type: "number", description: "Limit for find operations (default: 10)" }
      },
      required: ["collection", "operation"]
    }
  }
];

// Tool execution
async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "read_file": {
        const filePath = input.path as string;
        const fullPath = filePath.startsWith("/") ? filePath : path.join(WORKING_DIR, filePath);
        if (!fs.existsSync(fullPath)) {
          return `Error: File not found: ${fullPath}`;
        }
        const content = fs.readFileSync(fullPath, "utf-8");
        if (content.length > 50000) {
          return content.slice(0, 50000) + "\n\n... [truncated, file too large]";
        }
        return content;
      }

      case "write_file": {
        const filePath = input.path as string;
        const content = input.content as string;
        const fullPath = filePath.startsWith("/") ? filePath : path.join(WORKING_DIR, filePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, content);
        return `Successfully wrote ${content.length} bytes to ${fullPath}`;
      }

      case "run_command": {
        const command = input.command as string;
        const timeout = ((input.timeout as number) || 30) * 1000;

        // Safety checks
        const dangerous = ["rm -rf /", "dd if=", "mkfs", "> /dev/", "chmod -R 777 /"];
        if (dangerous.some(d => command.includes(d))) {
          return "Error: Command blocked for safety reasons";
        }

        try {
          const output = execSync(command, {
            cwd: WORKING_DIR,
            timeout,
            encoding: "utf-8",
            maxBuffer: 10 * 1024 * 1024
          });
          return output.slice(0, 50000) || "(no output)";
        } catch (err: unknown) {
          const error = err as { stderr?: string; message?: string };
          return `Command failed: ${error.stderr || error.message || "Unknown error"}`;
        }
      }

      case "list_files": {
        const dirPath = (input.path as string) || ".";
        const pattern = input.pattern as string;
        const fullPath = dirPath.startsWith("/") ? dirPath : path.join(WORKING_DIR, dirPath);

        let command = `find "${fullPath}" -type f`;
        if (pattern) {
          command += ` -name "${pattern}"`;
        }
        command += " | head -100";

        try {
          const output = execSync(command, { encoding: "utf-8", timeout: 10000 });
          return output || "(no files found)";
        } catch {
          return `Error listing files in ${fullPath}`;
        }
      }

      case "search_code": {
        const pattern = input.pattern as string;
        const searchPath = (input.path as string) || "src/";
        const fileType = input.fileType as string;
        const fullPath = searchPath.startsWith("/") ? searchPath : path.join(WORKING_DIR, searchPath);

        let command = `grep -rn "${pattern}" "${fullPath}"`;
        if (fileType) {
          command += ` --include="*.${fileType}"`;
        }
        command += " | head -50";

        try {
          const output = execSync(command, { encoding: "utf-8", timeout: 30000 });
          return output || "(no matches found)";
        } catch {
          return "(no matches found)";
        }
      }

      case "query_database": {
        const db = await getDatabase();
        const collection = input.collection as string;
        const operation = input.operation as string;
        const queryStr = (input.query as string) || "{}";
        const limit = (input.limit as number) || 10;

        let query;
        try {
          query = JSON.parse(queryStr);
        } catch {
          return `Error: Invalid JSON query: ${queryStr}`;
        }

        let result;
        switch (operation) {
          case "findOne":
            result = await db.collection(collection).findOne(query);
            break;
          case "count":
            result = await db.collection(collection).countDocuments(query);
            break;
          case "aggregate":
            result = await db.collection(collection).aggregate(query).toArray();
            break;
          case "find":
          default:
            result = await db.collection(collection).find(query).limit(limit).toArray();
        }

        return JSON.stringify(result, null, 2);
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err: unknown) {
    const error = err as Error;
    return `Error executing ${name}: ${error.message}`;
  }
}

// System prompt
const BRAIN_SYSTEM_PROMPT = `You are the Brain of Riigikogu Radar - a parliamentary intelligence system for Estonia.

You have FULL ACCESS to the system. Use your tools to:
- Read and write files
- Run bash commands (git, npm, curl, etc.)
- Query the MongoDB database directly
- Search and modify code

## Project Structure
- Working directory: ${WORKING_DIR}
- Source code: src/
- Scripts: scripts/
- Context files: .context/
- Brain memory: ~/.claude/projects/-home-ubuntu-riigikogu-radar/memory/MEMORY.md

## Key Files
- Priorities: .context/action/priorities.md
- Brain memory: ~/.claude/projects/-home-ubuntu-riigikogu-radar/memory/MEMORY.md
- Package.json: package.json

## Database Collections
- mps: MP data
- votings: Voting records
- stenograms: Parliament transcripts
- brain_state: Brain status
- brain_chat: Chat history
- brain_action_items: Pending actions

## Current Principle: CLARITY
Remove unnecessary complexity. Keep only what is essential. Simplify.

## How to Work
1. When asked to do something, USE YOUR TOOLS to actually do it
2. Read files before modifying them
3. Run commands to verify changes
4. Be concise in responses but thorough in actions
5. If you modify code, run \`npm run build\` to verify it compiles

You are autonomous. Execute tasks directly. Don't just describe what could be done - do it.`;

async function getSystemContext(): Promise<string> {
  const db = await getDatabase();

  const brainState = await db.collection("brain_state").findOne({ _id: "brain" as unknown as import("mongodb").ObjectId });
  const votings = await db.collection("votings").countDocuments();
  const mps = await db.collection("mps").countDocuments({ isActive: true });

  return `
Status: ${brainState?.status || "unknown"}
Last Heartbeat: ${brainState?.lastHeartbeat || "unknown"}
Data: ${votings} votings, ${mps} active MPs
`.trim();
}

async function getChatHistory(): Promise<ChatMessage[]> {
  const db = await getDatabase();
  const conversation = await db.collection("brain_chat")
    .findOne({}, { sort: { updatedAt: -1 } });
  return (conversation?.messages as ChatMessage[]) || [];
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    }

    const { message } = body;
    if (!message || typeof message !== "string") {
      return NextResponse.json({ success: false, error: "Message required" }, { status: 400 });
    }

    // Save human message
    await saveChatMessage({ role: "human", content: message, timestamp: new Date() });

    // Get context
    const systemContext = await getSystemContext();
    const history = await getChatHistory();

    // Build messages
    const systemPrompt = BRAIN_SYSTEM_PROMPT + "\n\n## Current State\n" + systemContext;

    const messages: Anthropic.MessageParam[] = history.slice(-8).map(m => ({
      role: m.role === "human" ? "user" as const : "assistant" as const,
      content: m.content
    }));
    messages.push({ role: "user", content: message });

    // Claude client
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    // Agentic loop
    let iterations = 0;
    let finalResponse = "";
    const toolsUsed: string[] = [];

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        tools: TOOLS,
        messages
      }).catch(() =>
        anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 4096,
          system: systemPrompt,
          tools: TOOLS,
          messages
        })
      );

      // Check if we need to process tool calls
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );

      // Collect any text response
      if (textBlocks.length > 0) {
        finalResponse = textBlocks.map(b => b.text).join("\n");
      }

      // If no tool calls, we're done
      if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
        break;
      }

      // Execute tools
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        toolsUsed.push(toolUse.name);
        const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result
        });
      }

      // Add assistant message and tool results to continue conversation
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    }

    // Save brain response
    const brainMessage: ChatMessage = {
      role: "brain",
      content: finalResponse,
      timestamp: new Date(),
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined
    };
    await saveChatMessage(brainMessage);

    return NextResponse.json({
      success: true,
      data: {
        response: finalResponse,
        toolsUsed,
        iterations,
        timestamp: brainMessage.timestamp
      }
    });

  } catch (error) {
    console.error("Brain chat error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const db = await getDatabase();
    const today = new Date().toISOString().split("T")[0];

    const conversation = await db.collection("brain_chat").findOne({ date: today });
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
    return NextResponse.json({ success: false, error: "Failed to fetch messages" }, { status: 500 });
  }
}
