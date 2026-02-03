import { z } from "zod";
import { getAnthropicClient, extractTextContent, DEFAULT_MODEL, CHEAP_MODEL, USE_CHEAP_MODEL_FOR_PREDICTIONS } from "./client";
import { completeWithFailover } from "./providers";
import type { VoteDecision } from "@/types";

/** Model to use for vote predictions */
const PREDICTION_MODEL = USE_CHEAP_MODEL_FOR_PREDICTIONS ? CHEAP_MODEL : DEFAULT_MODEL;

/** Enable automatic failover to alternative providers */
const ENABLE_FAILOVER = process.env.ENABLE_AI_FAILOVER === "true";

// ============================================================================
// Types
// ============================================================================

export interface PredictionInput {
  billTitle: string;
  billDescription: string;
  billFullText?: string;
  similarVotes: {
    title: string;
    decision: string;
    date: string;
    similarity: number;
  }[];
  relevantSpeeches: {
    topic: string;
    excerpt: string;
    date: string;
    similarity: number;
  }[];
}

export interface PredictionOutput {
  prediction: VoteDecision;
  confidence: number;
  reasoning: string;
  reasoningEt: string;
}

// Zod schema for safe JSON parsing
const PredictionResponseSchema = z.object({
  prediction: z.enum(["FOR", "AGAINST", "ABSTAIN", "ABSENT"]),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
  reasoningEt: z.string().optional(),
});

// ============================================================================
// JSON Parsing (Fixed from v0.1)
// ============================================================================

/**
 * Safely extract and parse JSON from Claude's response
 * Fixed: Uses proper JSON boundary detection instead of greedy regex
 * @internal Exported for testing
 */
export function extractJson(text: string): unknown {
  // Find the first { and match to its closing }
  const startIndex = text.indexOf("{");
  if (startIndex === -1) {
    throw new Error("No JSON object found in response");
  }

  let depth = 0;
  let endIndex = -1;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];
    if (char === "{") depth++;
    if (char === "}") depth--;
    if (depth === 0) {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    throw new Error("Malformed JSON: unmatched braces");
  }

  const jsonStr = text.substring(startIndex, endIndex + 1);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : "parse error"}`);
  }
}

/**
 * Parse and validate prediction response with Zod
 */
function parsePredictionResponse(text: string): PredictionOutput {
  const json = extractJson(text);
  const result = PredictionResponseSchema.safeParse(json);

  if (!result.success) {
    throw new Error(`Invalid prediction format: ${result.error.message}`);
  }

  return {
    prediction: result.data.prediction,
    confidence: Math.min(100, Math.max(0, result.data.confidence)),
    reasoning: result.data.reasoning || "No reasoning provided",
    reasoningEt: result.data.reasoningEt || result.data.reasoning || "Põhjendus puudub",
  };
}

// ============================================================================
// Prompt Building
// ============================================================================

/**
 * Build prompt for vote prediction using MP-specific instruction template
 */
function buildPrompt(
  input: PredictionInput,
  instructionTemplate: string,
  mpName: string
): string {
  const similarVotesText =
    input.similarVotes.length > 0
      ? input.similarVotes
          .map(
            (v, i) =>
              `${i + 1}. "${v.title}" - Voted: ${v.decision} (${v.date}, similarity: ${(v.similarity * 100).toFixed(0)}%)`
          )
          .join("\n")
      : "No similar past votes found.";

  const speechesText =
    input.relevantSpeeches.length > 0
      ? input.relevantSpeeches
          .map(
            (s, i) =>
              `${i + 1}. Topic: ${s.topic} (${s.date})\n   "${s.excerpt.substring(0, 300)}..."`
          )
          .join("\n")
      : "No relevant speeches found.";

  return `${instructionTemplate}

---

You are predicting how ${mpName} would vote on legislation based on the profile above.

## Bill Information
Title: ${input.billTitle}
Description: ${input.billDescription}
${input.billFullText ? `\nFull Text (excerpt):\n${input.billFullText.substring(0, 1000)}` : ""}

## Similar Past Votes
${similarVotesText}

## Relevant Speeches
${speechesText}

## Instructions
1. Analyze the bill content and context
2. Compare with similar past votes
3. Consider the MP's known positions and decision factors
4. Predict the vote: FOR, AGAINST, ABSTAIN, or ABSENT
5. Provide confidence level (0-100%)
6. Explain your reasoning in both English and Estonian

Respond ONLY with valid JSON in this exact format:
{
  "prediction": "FOR" | "AGAINST" | "ABSTAIN" | "ABSENT",
  "confidence": <number 0-100>,
  "reasoning": "<explanation in English>",
  "reasoningEt": "<explanation in Estonian>"
}`;
}

// ============================================================================
// Main Prediction Functions
// ============================================================================

/**
 * Predict vote using MP-specific instruction template
 *
 * Supports automatic failover to alternative providers when ENABLE_AI_FAILOVER=true
 */
export async function predictVote(
  input: PredictionInput,
  instructionTemplate: string,
  mpName: string
): Promise<PredictionOutput> {
  const prompt = buildPrompt(input, instructionTemplate, mpName);

  let text: string;

  if (ENABLE_FAILOVER) {
    // Use failover mechanism - tries Anthropic, then OpenAI, then Gemini
    const result = await completeWithFailover(prompt, { maxTokens: 512 });
    text = result.text;
  } else {
    // Direct Anthropic call (default, most cost-effective with Haiku)
    const response = await getAnthropicClient().messages.create({
      model: PREDICTION_MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseText = extractTextContent(response);
    if (!responseText) {
      throw new Error("No text response from Claude");
    }
    text = responseText;
  }

  return parsePredictionResponse(text);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Translate text to Estonian using Claude
 */
export async function translateToEstonian(text: string): Promise<string> {
  const response = await getAnthropicClient().messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Translate the following English text to Estonian. Only respond with the translation, nothing else.\n\n${text}`,
      },
    ],
  });

  const responseText = extractTextContent(response);
  if (!responseText) {
    return text;
  }

  return responseText.trim();
}

/**
 * Generate a general completion from Claude
 */
export async function complete(
  prompt: string,
  maxTokens: number = 2048
): Promise<string> {
  const response = await getAnthropicClient().messages.create({
    model: DEFAULT_MODEL,
    max_tokens: maxTokens,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const text = extractTextContent(response);
  if (!text) {
    throw new Error("No text response from Claude");
  }

  return text;
}
