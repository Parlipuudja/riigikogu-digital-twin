import { getCollection } from "@/lib/data/mongodb";
import { apiSuccess, handleApiError } from "@/lib/utils/api-response";
import type { Draft } from "@/types";

export const dynamic = "force-dynamic";

interface DraftSummary {
  uuid: string;
  number: string;
  title: string;
  titleEn?: string;
  status?: string;
  phase?: string;
  submitDate?: string;
  initiators?: string[];
}

interface DraftsResponse {
  drafts: DraftSummary[];
  total: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status") || undefined;
    const upcoming = searchParams.get("upcoming") === "true";

    const collection = await getCollection<Draft>("drafts");

    // Build filter
    const filter: Record<string, unknown> = {};
    if (status) {
      filter["status.code"] = status;
    }

    // For upcoming votes, get recent drafts that might be voted on
    // Sort by most recent proceeding date
    const sort: Record<string, 1 | -1> = upcoming
      ? { proceedingDate: -1 }
      : { submitDate: -1 };

    const [drafts, total] = await Promise.all([
      collection
        .find(filter)
        .sort(sort)
        .skip(offset)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    // Map to summary format
    const summaries: DraftSummary[] = drafts.map((d) => ({
      uuid: d.uuid,
      number: d.number,
      title: d.title,
      titleEn: d.titleEn,
      status: typeof d.status === "object" ? d.status.value : d.status,
      phase: d.phase,
      submitDate: d.submitDate || d.proceedingDate,
      initiators: d.initiators,
    }));

    return apiSuccess<DraftsResponse>(
      {
        drafts: summaries,
        total,
      },
      {
        cacheMaxAge: 300,
        cacheStaleWhileRevalidate: 1800,
      }
    );
  } catch (error) {
    return handleApiError(error, "fetching drafts");
  }
}
