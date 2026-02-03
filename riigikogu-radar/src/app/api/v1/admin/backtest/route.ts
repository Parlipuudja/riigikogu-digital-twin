import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/data/mongodb";
import { runBacktest } from "@/lib/prediction/backtesting";
import type { MPProfile } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for Vercel

interface BacktestRequest {
  slug: string;
  maxVotes?: number;
  postCutoff?: boolean;
}

/**
 * Trigger a backtest for a specific MP
 * POST /api/v1/admin/backtest
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
    const body: BacktestRequest = await request.json();
    const { slug, maxVotes = 30, postCutoff = true } = body;

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "MP slug is required" },
        { status: 400 }
      );
    }

    // Find MP
    const mpsCollection = await getCollection<MPProfile>("mps");
    const mp = await mpsCollection.findOne({ slug });

    if (!mp) {
      return NextResponse.json(
        { success: false, error: `MP not found: ${slug}` },
        { status: 404 }
      );
    }

    if (mp.status !== "active") {
      return NextResponse.json(
        { success: false, error: `MP is not active (status: ${mp.status})` },
        { status: 400 }
      );
    }

    // Run backtest with limited votes (to fit within time limits)
    const effectiveMaxVotes = Math.min(maxVotes, 50); // Cap at 50 for API

    const results = await runBacktest(mp.uuid, {
      maxVotes: effectiveMaxVotes,
      stratifiedSampling: true,
      earlyStop: true,
      postCutoffOnly: postCutoff,
    });

    return NextResponse.json({
      success: true,
      data: {
        mp: mp.info?.fullName || slug,
        slug,
        accuracy: results.accuracy.overall,
        sampleSize: results.sampleSize,
        postCutoff,
        byDecision: {
          for: results.accuracy.byDecision.FOR,
          against: results.accuracy.byDecision.AGAINST,
          abstain: results.accuracy.byDecision.ABSTAIN,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Backtest error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Backtest failed",
      },
      { status: 500 }
    );
  }
}

/**
 * Get list of MPs available for backtesting
 * GET /api/v1/admin/backtest
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
    const mpsCollection = await getCollection<MPProfile>("mps");
    const mps = await mpsCollection
      .find({ status: "active" })
      .project({ slug: 1, "info.fullName": 1, "info.party": 1, "backtest.accuracy.overall": 1, "backtest.lastRun": 1, "backtest.postCutoffOnly": 1 })
      .sort({ "info.fullName": 1 })
      .toArray();

    const mpList = mps.map((mp) => ({
      slug: mp.slug,
      name: mp.info?.fullName || mp.slug,
      party: mp.info?.party?.code || "unknown",
      lastBacktest: mp.backtest?.lastRun || null,
      accuracy: mp.backtest?.accuracy?.overall || null,
      postCutoff: mp.backtest?.postCutoffOnly || false,
    }));

    return NextResponse.json({ success: true, data: mpList });
  } catch (error) {
    console.error("Error fetching MPs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch MPs" },
      { status: 500 }
    );
  }
}
