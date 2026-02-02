/**
 * Unified Anthropic client with lazy initialization
 *
 * Supports dotenv in scripts by initializing only when first used,
 * allowing .env to be loaded before client creation.
 */

import Anthropic from "@anthropic-ai/sdk";

/** Default model for predictions and analysis */
export const DEFAULT_MODEL = "claude-sonnet-4-20250514";

// Singleton client instance
let anthropicClient: Anthropic | null = null;

/**
 * Get the Anthropic client instance
 * Uses lazy initialization to support dotenv in scripts
 *
 * @returns Anthropic client instance
 * @throws Error if ANTHROPIC_API_KEY is not set
 */
export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY environment variable is not set. " +
        "Please add it to your .env file or environment configuration."
      );
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Reset the client instance (useful for testing)
 */
export function resetAnthropicClient(): void {
  anthropicClient = null;
}

/**
 * Extract text content from Anthropic message response
 */
export function extractTextContent(
  response: Anthropic.Message
): string | null {
  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    return null;
  }
  return textContent.text;
}

/**
 * Create a simple completion with the default model
 */
export async function createCompletion(
  prompt: string,
  options: {
    maxTokens?: number;
    model?: string;
    system?: string;
  } = {}
): Promise<string> {
  const client = getAnthropicClient();
  const { maxTokens = 2048, model = DEFAULT_MODEL, system } = options;

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    ...(system && { system }),
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
