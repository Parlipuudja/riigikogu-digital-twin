/**
 * AI Provider Abstraction Types
 *
 * Defines a common interface for multiple AI providers (Anthropic, OpenAI, Gemini)
 * allowing easy switching between providers via configuration.
 */

export type AIProviderType = 'anthropic' | 'openai' | 'gemini';

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

export interface CompletionResult {
  text: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Common interface for AI providers
 */
export interface AIProvider {
  /** Provider identifier */
  readonly name: AIProviderType;

  /** Model being used */
  readonly model: string;

  /**
   * Create a text completion
   */
  complete(prompt: string, options?: CompletionOptions): Promise<CompletionResult>;

  /**
   * Check if the provider is properly configured
   */
  isConfigured(): boolean;
}

/**
 * Configuration for each provider
 */
export interface ProviderConfig {
  anthropic?: {
    apiKey: string;
    model?: string;
  };
  openai?: {
    apiKey: string;
    model?: string;
  };
  gemini?: {
    apiKey: string;
    model?: string;
  };
}
