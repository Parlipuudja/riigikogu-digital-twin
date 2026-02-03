/**
 * AI Provider Factory
 *
 * Creates and manages AI provider instances based on configuration.
 * Supports Anthropic Claude, OpenAI GPT, and Google Gemini.
 *
 * Configuration via environment variables:
 * - AI_PROVIDER: 'anthropic' | 'openai' | 'gemini' (default: 'anthropic')
 * - ANTHROPIC_API_KEY: For Anthropic Claude
 * - OPENAI_API_KEY: For OpenAI GPT
 * - GEMINI_API_KEY or GOOGLE_API_KEY: For Google Gemini
 */

import type { AIProvider, AIProviderType } from "./types";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { GeminiProvider } from "./gemini";

// Singleton provider instance
let currentProvider: AIProvider | null = null;
let currentProviderType: AIProviderType | null = null;

/**
 * Get the configured AI provider type from environment
 */
export function getProviderType(): AIProviderType {
  const provider = process.env.AI_PROVIDER?.toLowerCase().trim();
  if (provider === "openai") return "openai";
  if (provider === "gemini" || provider === "google") return "gemini";
  return "anthropic"; // Default
}

/**
 * Get an AI provider instance
 *
 * @param type - Optional provider type override
 * @returns AI provider instance
 */
export function getProvider(type?: AIProviderType): AIProvider {
  const targetType = type || getProviderType();

  // Return cached provider if type matches
  if (currentProvider && currentProviderType === targetType) {
    return currentProvider;
  }

  // Create new provider
  switch (targetType) {
    case "openai":
      currentProvider = new OpenAIProvider();
      break;
    case "gemini":
      currentProvider = new GeminiProvider();
      break;
    case "anthropic":
    default:
      currentProvider = new AnthropicProvider();
      break;
  }

  currentProviderType = targetType;

  if (!currentProvider.isConfigured()) {
    throw new Error(
      `AI provider '${targetType}' is not configured. ` +
      `Please set the appropriate API key environment variable.`
    );
  }

  return currentProvider;
}

/**
 * Reset the provider instance (useful for testing or switching providers)
 */
export function resetProvider(): void {
  currentProvider = null;
  currentProviderType = null;
}

/**
 * Get status of all available providers
 */
export function getProviderStatus(): Record<AIProviderType, { configured: boolean; active: boolean }> {
  const activeType = getProviderType();

  return {
    anthropic: {
      configured: new AnthropicProvider().isConfigured(),
      active: activeType === "anthropic",
    },
    openai: {
      configured: new OpenAIProvider().isConfigured(),
      active: activeType === "openai",
    },
    gemini: {
      configured: new GeminiProvider().isConfigured(),
      active: activeType === "gemini",
    },
  };
}

// Re-export types
export type { AIProvider, AIProviderType, CompletionOptions, CompletionResult } from "./types";
