import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCollection, getDbStats, healthCheck } from "@/lib/data/mongodb";
import { getProviderStatus, getProviderType, getAvailableProviders } from "@/lib/ai/providers";
import type { MPProfile, Voting, Stenogram } from "@/types";

export const dynamic = "force-dynamic";

interface AdminStatusResponse {
  database: {
    healthy: boolean;
    totalSize: string;
    collections: { name: string; count: number; size: string }[];
  };
  embeddings: {
    votings: { total: number; withEmbeddings: number; percentage: number };
    stenograms: { total: number; withEmbeddings: number; percentage: number };
    overall: number;
  };
  ai: {
    activeProvider: string;
    failoverEnabled: boolean;
    availableProviders: string[];
    providerStatus: Record<string, { configured: boolean; active: boolean }>;
  };
  backtests: {
    total: number;
    postCutoff: number;
    recentRuns: Array<{
      mp: string;
      accuracy: number;
      sampleSize: number;
      postCutoff: boolean;
      lastRun: string;
    }>;
  };
  mps: {
    total: number;
    active: number;
    withProfiles: number;
  };
  timestamp: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export async function GET() {
  // Check authentication
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Database health and stats
    const dbHealthy = await healthCheck();
    const dbStats = await getDbStats();

    // Embedding stats
    const votingsCol = await getCollection<Voting>("votings");
    const stenogramsCol = await getCollection<Stenogram>("stenograms");
    const mpsCol = await getCollection<MPProfile>("mps");

    const totalVotings = await votingsCol.countDocuments();
    const votingsWithEmbeddings = await votingsCol.countDocuments({ embedding: { $exists: true } });

    const totalStenograms = await stenogramsCol.countDocuments();
    const stenogramsWithEmbeddings = await stenogramsCol.countDocuments({ embedding: { $exists: true } });

    const embeddingsPercentage =
      ((votingsWithEmbeddings + stenogramsWithEmbeddings) / (totalVotings + totalStenograms)) * 100;

    // AI provider status
    const providerStatus = getProviderStatus();
    const activeProvider = getProviderType();
    const availableProviders = getAvailableProviders();
    const failoverEnabled = process.env.ENABLE_AI_FAILOVER === "true";

    // MP stats
    const totalMPs = await mpsCol.countDocuments();
    const activeMPs = await mpsCol.countDocuments({ status: "active" });
    const mpsWithProfiles = await mpsCol.countDocuments({ "instruction.promptTemplate": { $exists: true } });

    // Backtest stats
    const mpsWithBacktests = await mpsCol
      .find({ "backtest.accuracy": { $exists: true } })
      .sort({ "backtest.lastRun": -1 })
      .limit(10)
      .toArray();

    const postCutoffCount = await mpsCol.countDocuments({ "backtest.postCutoffOnly": true });
    const totalBacktested = await mpsCol.countDocuments({ "backtest.accuracy": { $exists: true } });

    const recentRuns = mpsWithBacktests.map(mp => ({
      mp: mp.info?.fullName || mp.slug,
      accuracy: mp.backtest?.accuracy?.overall || 0,
      sampleSize: mp.backtest?.sampleSize || 0,
      postCutoff: mp.backtest?.postCutoffOnly || false,
      lastRun: mp.backtest?.lastRun?.toISOString() || "",
    }));

    const response: AdminStatusResponse = {
      database: {
        healthy: dbHealthy,
        totalSize: formatBytes(dbStats.totalSize),
        collections: dbStats.collections.map(c => ({
          name: c.name,
          count: c.count,
          size: formatBytes(c.size),
        })),
      },
      embeddings: {
        votings: {
          total: totalVotings,
          withEmbeddings: votingsWithEmbeddings,
          percentage: Math.round((votingsWithEmbeddings / totalVotings) * 100),
        },
        stenograms: {
          total: totalStenograms,
          withEmbeddings: stenogramsWithEmbeddings,
          percentage: Math.round((stenogramsWithEmbeddings / totalStenograms) * 100),
        },
        overall: Math.round(embeddingsPercentage),
      },
      ai: {
        activeProvider,
        failoverEnabled,
        availableProviders,
        providerStatus,
      },
      backtests: {
        total: totalBacktested,
        postCutoff: postCutoffCount,
        recentRuns,
      },
      mps: {
        total: totalMPs,
        active: activeMPs,
        withProfiles: mpsWithProfiles,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error("Admin status error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch admin status" },
      { status: 500 }
    );
  }
}
