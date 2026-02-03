import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCollection, getDbStats } from "@/lib/data/mongodb";
import type { MPProfile, Voting, Stenogram } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 1 minute for status checks

interface SyncStatus {
  database: {
    totalSize: string;
    usagePercent: number;
  };
  collections: {
    mps: { count: number; active: number };
    votings: { count: number; withEmbeddings: number };
    stenograms: { count: number; withEmbeddings: number };
    drafts: { count: number };
  };
  lastSync: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Get sync status
 * GET /api/v1/admin/sync
 */
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
    const dbStats = await getDbStats();
    const SIZE_LIMIT_MB = 480;

    const mpsCol = await getCollection<MPProfile>("mps");
    const votingsCol = await getCollection<Voting>("votings");
    const stenogramsCol = await getCollection<Stenogram>("stenograms");
    const draftsCol = await getCollection("drafts");

    const [
      mpsCount,
      activeMps,
      votingsCount,
      votingsWithEmbed,
      stenogramsCount,
      stenogramsWithEmbed,
      draftsCount,
    ] = await Promise.all([
      mpsCol.countDocuments(),
      mpsCol.countDocuments({ status: "active" }),
      votingsCol.countDocuments(),
      votingsCol.countDocuments({ embedding: { $exists: true } }),
      stenogramsCol.countDocuments(),
      stenogramsCol.countDocuments({ embedding: { $exists: true } }),
      draftsCol.countDocuments(),
    ]);

    // Get latest voting date as proxy for last sync
    const latestVoting = await votingsCol
      .find()
      .sort({ votingTime: -1 })
      .limit(1)
      .toArray();

    const status: SyncStatus = {
      database: {
        totalSize: formatBytes(dbStats.totalSize),
        usagePercent: Math.round((dbStats.totalSize / (SIZE_LIMIT_MB * 1024 * 1024)) * 100),
      },
      collections: {
        mps: { count: mpsCount, active: activeMps },
        votings: { count: votingsCount, withEmbeddings: votingsWithEmbed },
        stenograms: { count: stenogramsCount, withEmbeddings: stenogramsWithEmbed },
        drafts: { count: draftsCount },
      },
      lastSync: latestVoting[0]?.votingTime || null,
    };

    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    console.error("Sync status error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}

/**
 * Trigger a sync operation
 * POST /api/v1/admin/sync
 *
 * Note: Full syncs are long-running and should be run via CLI.
 * This endpoint provides guidance and triggers lightweight operations.
 */
export async function POST(request: NextRequest) {
  // Check authentication
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { type = "status" } = body;

    if (type === "status") {
      // Just return instructions - syncs must be run via CLI
      return NextResponse.json({
        success: true,
        data: {
          message: "Data syncs must be run via CLI due to execution time limits",
          instructions: {
            fullSync: "npx tsx scripts/sync-api.ts all",
            membersOnly: "npx tsx scripts/sync-api.ts members",
            votingsOnly: "npx tsx scripts/sync-api.ts votings",
            status: "npx tsx scripts/sync-api.ts status",
            resume: "npx tsx scripts/sync-api.ts resume",
          },
          note: "For automated syncs, configure a Vercel cron job or external scheduler",
        },
      });
    }

    // For now, only support status - actual sync requires CLI
    return NextResponse.json({
      success: false,
      error: `Sync type '${type}' not supported via API. Use CLI for data syncs.`,
      cliCommand: `npx tsx scripts/sync-api.ts ${type}`,
    }, { status: 400 });

  } catch (error) {
    console.error("Sync trigger error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process sync request" },
      { status: 500 }
    );
  }
}
