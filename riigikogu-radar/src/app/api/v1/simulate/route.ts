import { NextResponse } from "next/server";
import { getActiveMPs } from "@/lib/data/mps";
import { predictMultipleMPs, type PredictResult } from "@/lib/prediction";
import { SimulateRequestSchema } from "@/lib/utils/validation";
import type {
  ApiResponse,
  SimulateResponse,
  SimulationResult,
  PartyBreakdown,
  SwingVote,
  ConfidenceDistribution,
  PartyCode,
} from "@/types";
import { getPartyCode } from "@/components/data/party-badge";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Allow up to 5 minutes for full simulation

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = SimulateRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.flatten(),
          },
          meta: { requestId, timestamp: new Date().toISOString() },
        },
        { status: 400 }
      );
    }

    // Get all active MPs
    const mps = await getActiveMPs();

    if (mps.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "No active MPs found. Generate MP profiles first.",
          },
          meta: { requestId, timestamp: new Date().toISOString() },
        },
        { status: 400 }
      );
    }

    // Run predictions for all MPs
    const results = await predictMultipleMPs(mps, {
      billTitle: validation.data.billTitle,
      billDescription: validation.data.billDescription,
      billFullText: validation.data.billFullText,
    });

    // Separate successful predictions from errors
    const predictions = results
      .filter((r): r is PredictResult => "prediction" in r)
      .map((r) => r.prediction);

    const errors = results.filter((r): r is { error: string; mpSlug: string } => "error" in r);

    // Calculate totals
    const totalFor = predictions.filter((p) => p.vote === "FOR").length;
    const totalAgainst = predictions.filter((p) => p.vote === "AGAINST").length;
    const totalAbstain = predictions.filter((p) => p.vote === "ABSTAIN").length;
    const totalUnknown = errors.length;

    // Calculate passage probability (simple majority = 51 votes)
    const passageProbability = Math.round((totalFor / 101) * 100);

    // Group by party
    const partyMap = new Map<string, { for: number; against: number; abstain: number; total: number }>();

    for (const p of predictions) {
      const existing = partyMap.get(p.party) || { for: 0, against: 0, abstain: 0, total: 0 };
      existing.total++;
      if (p.vote === "FOR") existing.for++;
      if (p.vote === "AGAINST") existing.against++;
      if (p.vote === "ABSTAIN") existing.abstain++;
      partyMap.set(p.party, existing);
    }

    const partyBreakdown: PartyBreakdown[] = Array.from(partyMap.entries()).map(
      ([party, stats]) => {
        let stance: PartyBreakdown["stance"] = "UNKNOWN";
        if (stats.for > stats.against * 2) stance = "SUPPORTS";
        else if (stats.against > stats.for * 2) stance = "OPPOSES";
        else if (stats.for > 0 || stats.against > 0) stance = "SPLIT";

        return {
          party,
          partyCode: getPartyCode(party) as PartyCode,
          totalMembers: stats.total,
          predictedFor: stats.for,
          predictedAgainst: stats.against,
          predictedAbstain: stats.abstain,
          stance,
        };
      }
    );

    // Identify swing votes (low confidence, could change outcome)
    const swingVotes: SwingVote[] = predictions
      .filter((p) => p.confidence < 60)
      .sort((a, b) => a.confidence - b.confidence)
      .slice(0, 5)
      .map((p) => ({
        mpSlug: p.mpSlug,
        mpName: p.mpName,
        party: p.party,
        confidence: p.confidence,
        predictedVote: p.vote,
        reason: `Low confidence (${p.confidence}%)`,
      }));

    // Confidence distribution
    const confidenceDistribution: ConfidenceDistribution = {
      high: predictions.filter((p) => p.confidence >= 80).length,
      medium: predictions.filter((p) => p.confidence >= 50 && p.confidence < 80).length,
      low: predictions.filter((p) => p.confidence < 50).length,
      unknown: totalUnknown,
    };

    const simulation: SimulationResult = {
      draftTitle: validation.data.billTitle,
      passageProbability,
      totalFor,
      totalAgainst,
      totalAbstain,
      totalUnknown,
      predictions,
      partyBreakdown,
      swingVotes,
      confidenceDistribution,
      simulatedAt: new Date(),
    };

    const response: ApiResponse<SimulateResponse & { errors: typeof errors }> = {
      success: true,
      data: {
        simulation,
        errors,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Simulation error:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Simulation failed",
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      { status: 500 }
    );
  }
}
