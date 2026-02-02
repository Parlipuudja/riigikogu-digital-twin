import { getMPBySlug } from "@/lib/data/mps";
import { apiSuccess, apiError, handleApiError } from "@/lib/utils/api-response";
import type { MPDetailResponse } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const mp = await getMPBySlug(params.slug);

    if (!mp) {
      return apiError("NOT_FOUND", `MP with slug "${params.slug}" not found`, 404);
    }

    return apiSuccess<MPDetailResponse>(
      {
        mp,
        // TODO: Add recent votes
      },
      {
        // Cache for 5 minutes, allow stale for 30 minutes
        cacheMaxAge: 300,
        cacheStaleWhileRevalidate: 1800,
      }
    );
  } catch (error) {
    return handleApiError(error, "fetching MP");
  }
}
