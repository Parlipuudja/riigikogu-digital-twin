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

// Failover chain: try providers in this order
const FAILOVER_CHAIN: AIProviderType[] = ["anthropic", "openai", "gemini"];

// Circuit breaker state: track failed providers
const failedProviders: Map<AIProviderType, { until: number; attempts: number }> = new Map();

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

/**
 * Check if a provider is currently in circuit breaker cooldown
 */
function isProviderAvailable(type: AIProviderType): boolean {
  const failure = failedProviders.get(type);
  if (!failure) return true;
  if (Date.now() > failure.until) {
    failedProviders.delete(type);
    return true;
  }
  return false;
}

/**
 * Mark a provider as failed (circuit breaker)
 */
function markProviderFailed(type: AIProviderType): void {
  const existing = failedProviders.get(type);
  const attempts = (existing?.attempts || 0) + 1;
  // Exponential backoff: 30s, 60s, 120s, max 5min
  const cooldownMs = Math.min(30000 * Math.pow(2, attempts - 1), 300000);
  failedProviders.set(type, {
    until: Date.now() + cooldownMs,
    attempts,
  });
  console.warn(`Provider ${type} marked as failed. Cooldown: ${cooldownMs / 1000}s`);
}

/**
 * Mark a provider as recovered (reset circuit breaker)
 */
function markProviderRecovered(type: AIProviderType): void {
  if (failedProviders.has(type)) {
    failedProviders.delete(type);
    console.log(`Provider ${type} recovered`);
  }
}

/**
 * Get the list of available providers in failover order
 */
export function getAvailableProviders(): AIProviderType[] {
  return FAILOVER_CHAIN.filter((type) => {
    try {
      const provider = createProvider(type);
      return provider.isConfigured() && isProviderAvailable(type);
    } catch {
      return false;
    }
  });
}

/**
 * Create a provider instance without caching
 */
function createProvider(type: AIProviderType): AIProvider {
  switch (type) {
    case "openai":
      return new OpenAIProvider();
    case "gemini":
      return new GeminiProvider();
    case "anthropic":
    default:
      return new AnthropicProvider();
  }
}

/**
 * Complete with automatic failover
 *
 * Tries providers in order until one succeeds.
 * Implements circuit breaker pattern to avoid hammering failed providers.
 */
export async function completeWithFailover(
  prompt: string,
  options: import("./types").CompletionOptions = {}
): Promise<import("./types").CompletionResult & { provider: AIProviderType }> {
  const availableProviders = getAvailableProviders();

  if (availableProviders.length === 0) {
    throw new Error(
      "No AI providers available. All providers are either unconfigured or in cooldown. " +
      `Failed providers: ${Array.from(failedProviders.keys()).join(", ")}`
    );
  }

  const errors: Array<{ provider: AIProviderType; error: string }> = [];

  for (const providerType of availableProviders) {
    try {
      const provider = createProvider(providerType);
      const result = await provider.complete(prompt, options);

      // Success - mark as recovered if it was previously failed
      markProviderRecovered(providerType);

      return {
        ...result,
        provider: providerType,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ provider: providerType, error: errorMsg });

      // Check if this is a temporary error (rate limit, server error) vs permanent (auth)
      const isTemporary =
        errorMsg.includes("429") ||
        errorMsg.includes("500") ||
        errorMsg.includes("503") ||
        errorMsg.includes("timeout") ||
        errorMsg.includes("ECONNRESET");

      if (isTemporary) {
        markProviderFailed(providerType);
      }

      console.warn(`Provider ${providerType} failed: ${errorMsg}`);
      // Continue to next provider
    }
  }

  // All providers failed
  throw new Error(
    `All AI providers failed:\n${errors.map((e) => `  - ${e.provider}: ${e.error}`).join("\n")}`
  );
}

/**
 * Get circuit breaker status for all providers
 */
export function getCircuitBreakerStatus(): Record<AIProviderType, { available: boolean; cooldownRemaining?: number }> {
  const now = Date.now();
  return FAILOVER_CHAIN.reduce((acc, type) => {
    const failure = failedProviders.get(type);
    acc[type] = {
      available: isProviderAvailable(type),
      cooldownRemaining: failure && failure.until > now ? Math.ceil((failure.until - now) / 1000) : undefined,
    };
    return acc;
  }, {} as Record<AIProviderType, { available: boolean; cooldownRemaining?: number }>);
}

// Re-export types
export type { AIProvider, AIProviderType, CompletionOptions, CompletionResult } from "./types";
