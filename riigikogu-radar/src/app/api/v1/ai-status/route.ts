import { NextResponse } from "next/server";
import { getProviderStatus, getProviderType, getCircuitBreakerStatus, getAvailableProviders } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

/**
 * Get AI provider status and configuration
 * GET /api/v1/ai-status
 */
export async function GET() {
  const status = getProviderStatus();
  const activeProvider = getProviderType();
  const circuitBreaker = getCircuitBreakerStatus();
  const availableProviders = getAvailableProviders();
  const failoverEnabled = process.env.ENABLE_AI_FAILOVER === "true";

  return NextResponse.json({
    success: true,
    data: {
      activeProvider,
      providers: status,
      failover: {
        enabled: failoverEnabled,
        availableProviders,
        circuitBreaker,
      },
      configuration: {
        anthropic: {
          envVar: "ANTHROPIC_API_KEY",
          model: "claude-3-haiku-20240307",
        },
        openai: {
          envVar: "OPENAI_API_KEY",
          model: "gpt-4o-mini",
        },
        gemini: {
          envVar: "GEMINI_API_KEY or GOOGLE_API_KEY",
          model: "gemini-1.5-flash",
        },
      },
      switchProvider: "Set AI_PROVIDER env var, or enable ENABLE_AI_FAILOVER=true for automatic fallback",
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}
