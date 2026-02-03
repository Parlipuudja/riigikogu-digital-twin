/**
 * Unified AI client with multi-provider support
 *
 * Supports Anthropic Claude, OpenAI GPT, and Google Gemini.
 * Configure via AI_PROVIDER environment variable.
 *
 * For backwards compatibility, also exports Anthropic-specific functions.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getProvider, getProviderType, resetProvider } from "./providers";
import type { AIProvider, CompletionOptions } from "./providers";

/** Default model for predictions (Anthropic) */
export const DEFAULT_MODEL = "claude-sonnet-4-20250514";

/** Cheap model for high-volume predictions (12x cheaper than Sonnet) */
export const CHEAP_MODEL = "claude-3-5-haiku-20241022";

/** Use cheap model for predictions to reduce costs */
export const USE_CHEAP_MODEL_FOR_PREDICTIONS = true;

// Legacy Anthropic client (for backwards compatibility)
let anthropicClient: Anthropic | null = null;

/**
 * Get the current AI provider
 */
export function getAIProvider(): AIProvider {
  return getProvider();
}

/**
 * Get the Anthropic client instance (legacy, for backwards compatibility)
 * @deprecated Use getAIProvider() instead
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
 * Reset the client instances (useful for testing)
 */
export function resetAnthropicClient(): void {
  anthropicClient = null;
  resetProvider();
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
 * Create a completion using the configured AI provider
 */
export async function createCompletion(
  prompt: string,
  options: CompletionOptions & { model?: string } = {}
): Promise<string> {
  const provider = getProvider();
  const result = await provider.complete(prompt, options);
  return result.text;
}

/**
 * Get information about the current AI configuration
 */
export function getAIConfig(): {
  provider: string;
  model: string;
  configured: boolean;
} {
  try {
    const provider = getProvider();
    return {
      provider: provider.name,
      model: provider.model,
      configured: provider.isConfigured(),
    };
  } catch {
    return {
      provider: getProviderType(),
      model: "unknown",
      configured: false,
    };
  }
}
