import { getActiveMPs } from "@/lib/data/mps";
import { extractPhotoUrl } from "@/lib/utils/photo";
import { apiSuccess, handleApiError, normalizeVotingStats, type VotingStatsLegacy } from "@/lib/utils/api-response";
import type { MPListResponse, MPSummary, MPProfile } from "@/types";

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

    // Map MPProfile to MPSummary
    const summaries: MPSummary[] = mps.map((mp: MPProfile) => {
      const stats = normalizeVotingStats(mp.info?.votingStats as VotingStatsLegacy | undefined);
      return {
        slug: mp.slug,
        name: mp.info?.fullName || mp.slug,
        party: mp.info?.party?.name || "",
        partyCode: mp.info?.party?.code || "",
        photoUrl: extractPhotoUrl(mp.info?.photoUrl),
        isCurrentMember: mp.status === "active",
        stats,
      };
    });

    // Get unique parties from the loaded MPs
    const partyNames = mps.map((mp) => mp.info?.party?.name).filter((p): p is string => Boolean(p));
    const parties = Array.from(new Set(partyNames));

    return apiSuccess<MPListResponse & { parties: string[] }>(
      {
        mps: summaries,
        total: summaries.length,
        parties,
      },
      {
        // Cache for 5 minutes, allow stale for 30 minutes
        cacheMaxAge: 300,
        cacheStaleWhileRevalidate: 1800,
      }
    );
  } catch (error) {
    return handleApiError(error, "fetching MPs");
  }
}
