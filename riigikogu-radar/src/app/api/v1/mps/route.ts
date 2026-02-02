import { NextResponse } from "next/server";
import { getMPs, getParties } from "@/lib/data/mps";
import type { ApiResponse, MPListResponse, MPSummary } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const party = searchParams.get("party") || undefined;
    const activeOnly = searchParams.get("active") !== "false";

    const mps = await getMPs({
      party,
      isCurrentMember: activeOnly ? true : undefined,
      status: activeOnly ? "active" : undefined,
    });

    const summaries: MPSummary[] = mps.map((mp) => ({
      slug: mp.slug,
      name: mp.name,
      party: mp.party,
      partyCode: mp.partyCode,
      photoUrl: mp.photoUrl,
      isCurrentMember: mp.isCurrentMember,
      stats: mp.stats
        ? {
            totalVotes: mp.stats.totalVotes,
            attendance: mp.stats.attendance,
            partyAlignmentRate: mp.stats.partyAlignmentRate,
          }
        : undefined,
    }));

    const parties = await getParties();

    const response: ApiResponse<MPListResponse & { parties: string[] }> = {
      success: true,
      data: {
        mps: summaries,
        total: summaries.length,
        parties,
      },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching MPs:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch MPs",
        },
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
