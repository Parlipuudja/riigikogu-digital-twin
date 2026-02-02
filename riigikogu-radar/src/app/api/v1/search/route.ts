import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/data/mongodb";
import { generateQueryEmbedding } from "@/lib/ai/voyage";

interface SearchResult {
  type: "voting" | "draft" | "mp";
  score: number;
  title: string;
  date?: string;
  summary?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Natural language search across parliament data
 * GET /api/v1/search?q=<query>&type=<voting|draft|mp|all>
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const type = searchParams.get("type") || "all";
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

  if (!query || query.trim().length < 3) {
    return NextResponse.json(
      { success: false, error: "Query must be at least 3 characters" },
      { status: 400 }
    );
  }

  try {
    const results: SearchResult[] = [];

    // Generate embedding for semantic search
    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await generateQueryEmbedding(query);
    } catch {
      // Fall back to keyword search if embedding fails
    }

    // Search votings
    if (type === "all" || type === "voting") {
      const votings = await getCollection("votings");

      if (queryEmbedding) {
        // Vector search
        const vectorResults = await votings
          .aggregate([
            {
              $vectorSearch: {
                index: "voting_embeddings",
                path: "embedding",
                queryVector: queryEmbedding,
                numCandidates: limit * 10,
                limit: limit,
              },
            },
            {
              $project: {
                title: 1,
                votingTime: 1,
                description: 1,
                score: { $meta: "vectorSearchScore" },
              },
            },
          ])
          .toArray();

        for (const v of vectorResults) {
          results.push({
            type: "voting",
            score: v.score || 0,
            title: v.title,
            date: v.votingTime?.split("T")[0],
            summary: v.description?.substring(0, 200),
          });
        }
      } else {
        // Keyword fallback
        const keywordResults = await votings
          .find(
            { $text: { $search: query } },
            { projection: { score: { $meta: "textScore" }, title: 1, votingTime: 1, description: 1 } }
          )
          .sort({ score: { $meta: "textScore" } })
          .limit(limit)
          .toArray();

        for (const v of keywordResults) {
          results.push({
            type: "voting",
            score: v.score || 0,
            title: v.title,
            date: v.votingTime?.split("T")[0],
            summary: v.description?.substring(0, 200),
          });
        }
      }
    }

    // Search drafts
    if (type === "all" || type === "draft") {
      const drafts = await getCollection("drafts");

      if (queryEmbedding) {
        const vectorResults = await drafts
          .aggregate([
            {
              $vectorSearch: {
                index: "draft_embeddings",
                path: "embedding",
                queryVector: queryEmbedding,
                numCandidates: limit * 10,
                limit: limit,
              },
            },
            {
              $project: {
                title: 1,
                submittedDate: 1,
                summary: 1,
                score: { $meta: "vectorSearchScore" },
              },
            },
          ])
          .toArray();

        for (const d of vectorResults) {
          results.push({
            type: "draft",
            score: d.score || 0,
            title: d.title,
            date: d.submittedDate?.split("T")[0],
            summary: d.summary?.substring(0, 200),
          });
        }
      } else {
        const keywordResults = await drafts
          .find(
            { $text: { $search: query } },
            { projection: { score: { $meta: "textScore" }, title: 1, submittedDate: 1, summary: 1 } }
          )
          .sort({ score: { $meta: "textScore" } })
          .limit(limit)
          .toArray();

        for (const d of keywordResults) {
          results.push({
            type: "draft",
            score: d.score || 0,
            title: d.title,
            date: d.submittedDate?.split("T")[0],
            summary: d.summary?.substring(0, 200),
          });
        }
      }
    }

    // Search MPs (keyword only - by name, party)
    if (type === "all" || type === "mp") {
      const mps = await getCollection("mps");
      const mpResults = await mps
        .find({
          status: "active",
          $or: [
            { "info.fullName": { $regex: query, $options: "i" } },
            { "info.party.name": { $regex: query, $options: "i" } },
            { slug: { $regex: query, $options: "i" } },
          ],
        })
        .project({ slug: 1, "info.fullName": 1, "info.party": 1, "backtest.accuracy": 1 })
        .limit(limit)
        .toArray();

      for (const mp of mpResults) {
        results.push({
          type: "mp",
          score: 1,
          title: mp.info?.fullName || mp.slug,
          summary: mp.info?.party?.name,
          url: `/mps/${mp.slug}`,
          metadata: {
            accuracy: mp.backtest?.accuracy?.overall,
          },
        });
      }
    }

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    const finalResults = results.slice(0, limit);

    return NextResponse.json({
      success: true,
      query,
      count: finalResults.length,
      results: finalResults,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { success: false, error: "Search failed" },
      { status: 500 }
    );
  }
}
