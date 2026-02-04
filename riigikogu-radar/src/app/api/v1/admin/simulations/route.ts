import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/data/mongodb";
import type { StoredSimulation } from "@/types";

export const dynamic = "force-dynamic";

interface CachedPrediction {
  _id: string;
  cacheKey: string;
  mpSlug: string;
  mpUuid: string;
  billHash: string;
  prediction: {
    mpSlug: string;
    mpName: string;
    party: string;
    vote: string;
    confidence: number;
    reasoning: { et: string; en: string };
    predictedAt: Date;
  };
  createdAt: Date;
  expiresAt: Date;
}

/**
 * GET /api/v1/admin/simulations
 * Returns simulation history and individual prediction stats
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

    // Get full parliament simulations
    const simulationsCol = await getCollection<StoredSimulation>("simulations");
    const simulations = await simulationsCol
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    // Get individual prediction cache stats
    const predictionCacheCol = await getCollection<CachedPrediction>("prediction_cache");
    const totalCachedPredictions = await predictionCacheCol.countDocuments();
    const activePredictions = await predictionCacheCol.countDocuments({
      expiresAt: { $gt: new Date() }
    });

    // Get unique bills in prediction cache
    const uniqueBillHashes = await predictionCacheCol.distinct("billHash");

    // Get recent individual predictions (grouped by bill)
    const recentPredictions = await predictionCacheCol
      .aggregate([
        { $match: { expiresAt: { $gt: new Date() } } },
        { $sort: { createdAt: -1 } },
        { $group: {
          _id: "$billHash",
          firstPrediction: { $first: "$$ROOT" },
          count: { $sum: 1 },
          lastUpdated: { $max: "$createdAt" }
        }},
        { $sort: { lastUpdated: -1 } },
        { $limit: 20 }
      ])
      .toArray();

    // Format simulations for response
    const formattedSimulations = simulations.map(sim => ({
      id: sim._id,
      billTitle: sim.billTitle,
      billDescription: sim.billDescription?.substring(0, 200),
      draftUuid: sim.draftUuid,
      passageProbability: sim.result.passageProbability,
      totalFor: sim.result.totalFor,
      totalAgainst: sim.result.totalAgainst,
      totalAbstain: sim.result.totalAbstain,
      predictionsCount: sim.result.predictions.length,
      createdAt: sim.createdAt,
      updatedAt: sim.updatedAt,
    }));

    // Format individual prediction groups
    const individualPredictionGroups = recentPredictions.map(group => ({
      billHash: group._id,
      mpCount: group.count,
      lastUpdated: group.lastUpdated,
      samplePrediction: group.firstPrediction ? {
        mpName: group.firstPrediction.prediction?.mpName,
        party: group.firstPrediction.prediction?.party,
        vote: group.firstPrediction.prediction?.vote,
      } : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        fullParliamentSimulations: {
          total: await simulationsCol.countDocuments(),
          simulations: formattedSimulations,
        },
        individualPredictions: {
          totalCached: totalCachedPredictions,
          activeCached: activePredictions,
          uniqueBills: uniqueBillHashes.length,
          recentGroups: individualPredictionGroups,
        },
      },
    });
  } catch (error) {
    console.error("Admin simulations error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch simulation history" },
      { status: 500 }
    );
  }
}
