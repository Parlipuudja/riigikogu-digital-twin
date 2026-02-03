/**
 * Google Gemini Provider
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProvider, CompletionOptions, CompletionResult } from "./types";

const DEFAULT_MODEL = "gemini-1.5-pro";

export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;
  readonly model: string;
  private client: GoogleGenerativeAI | null = null;
  private apiKey: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || "";
    this.model = model || DEFAULT_MODEL;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private getClient(): GoogleGenerativeAI {
    if (!this.client) {
      if (!this.apiKey) {
        throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY is not configured");
      }
      this.client = new GoogleGenerativeAI(this.apiKey);
    }
    return this.client;
  }

  async complete(
    prompt: string,
    options: CompletionOptions = {}
  ): Promise<CompletionResult> {
    const { maxTokens = 2048, system } = options;
    const client = this.getClient();

    const model = client.getGenerativeModel({
      model: this.model,
      generationConfig: {
        maxOutputTokens: maxTokens,
      },
    });

    // Gemini uses system instruction differently
    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error("No response from Gemini");
    }

    const usageMetadata = response.usageMetadata;

    return {
      text,
      usage: usageMetadata
        ? {
            inputTokens: usageMetadata.promptTokenCount || 0,
            outputTokens: usageMetadata.candidatesTokenCount || 0,
          }
        : undefined,
    };
  }
}
