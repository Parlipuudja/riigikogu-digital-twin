import { NextResponse } from "next/server";
import { getActiveMPs } from "@/lib/data/mps";
import type { ApiResponse, MPListResponse, MPSummary, MPProfile } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const party = searchParams.get("party") || undefined;

    // Get all active MPs (MPProfile format)
    let mps = await getActiveMPs();

    // Filter by party if specified
    if (party) {
      mps = mps.filter((mp) => mp.info?.party?.code === party || mp.info?.party?.name === party);
    }

    // Helper to extract photo URL (handles both string and object formats)
    const getPhotoUrl = (photo: unknown): string | undefined => {
      if (typeof photo === "string") return photo;
      if (photo && typeof photo === "object") {
        // Handle Riigikogu API photo object format
        const photoObj = photo as { _links?: { download?: { href?: string } } };
        return photoObj._links?.download?.href;
      }
      return undefined;
    };

    // Map MPProfile to MPSummary
    // Note: votingStats uses different field names depending on how it was generated
    const summaries: MPSummary[] = mps.map((mp: MPProfile) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stats = mp.info?.votingStats as any;
      return {
        slug: mp.slug,
        name: mp.info?.fullName || mp.slug,
        party: mp.info?.party?.name || "",
        partyCode: mp.info?.party?.code || "",
        photoUrl: getPhotoUrl(mp.info?.photoUrl),
        isCurrentMember: mp.status === "active",
        stats: stats
          ? {
              totalVotes: stats.totalVotes ?? stats.total ?? 0,
              attendance: stats.attendance ?? stats.attendancePercent ?? 0,
              partyAlignmentRate: stats.partyAlignment ?? stats.partyLoyaltyPercent ?? 0,
            }
          : undefined,
      };
    });

    // Get unique parties from the loaded MPs
    const parties = [...new Set(mps.map((mp) => mp.info?.party?.name).filter(Boolean))] as string[];

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
