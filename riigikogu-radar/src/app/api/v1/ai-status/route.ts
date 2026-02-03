import { NextResponse } from "next/server";
import { getProviderStatus, getProviderType } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

/**
 * Get AI provider status
 * GET /api/v1/ai-status
 */
export async function GET() {
  const status = getProviderStatus();
  const activeProvider = getProviderType();

  return NextResponse.json({
    success: true,
    data: {
      activeProvider,
      providers: status,
      configuration: {
        anthropic: {
          envVar: "ANTHROPIC_API_KEY",
          model: "claude-sonnet-4-20250514",
        },
        openai: {
          envVar: "OPENAI_API_KEY",
          model: "gpt-4o",
        },
        gemini: {
          envVar: "GEMINI_API_KEY or GOOGLE_API_KEY",
          model: "gemini-1.5-pro",
        },
      },
      switchProvider: "Set AI_PROVIDER environment variable to 'anthropic', 'openai', or 'gemini'",
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}
