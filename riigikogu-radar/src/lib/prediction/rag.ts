/**
 * RAG (Retrieval-Augmented Generation) module for vote prediction
 * Retrieves similar votes and speeches for context
 */

import { getCollection } from "@/lib/data/mongodb";
import { generateQueryEmbedding } from "@/lib/ai/voyage";
import type { VoteDecision, Voting, RagSimilarVote, RelevantSpeech } from "@/types";

// Re-export for convenience
type SimilarVote = RagSimilarVote;

// ============================================================================
// Types
// ============================================================================

export interface RAGContext {
  similarVotes: SimilarVote[];
  relevantSpeeches: RelevantSpeech[];
  error?: string;
}

interface Stenogram {
  uuid: string;
  sessionDate: string;
  speakers: Array<{
    memberUuid: string;
    text: string;
    topic?: string;
  }>;
}

// ============================================================================
// Vector Search Functions
// ============================================================================

/**
 * Find similar votings for an MP using MongoDB Atlas Vector Search
 *
 * @param queryText - The bill text to find similar votes for
 * @param mpUuid - The MP's UUID to filter votes
 * @param limit - Maximum number of results
 * @returns Similar votes or empty array with error info
 */
export async function findSimilarVotings(
  queryText: string,
  mpUuid: string,
  limit: number = 5
): Promise<{ votes: SimilarVote[]; error?: string }> {
  try {
    const queryEmbedding = await generateQueryEmbedding(queryText);
    const collection = await getCollection<Voting>("votings");

    // Check if embeddings exist
    const hasEmbeddings = await collection.countDocuments({
      embedding: { $exists: true },
    });

    if (hasEmbeddings === 0) {
      return {
        votes: [],
        error: "No embeddings available. Run embedding generation first.",
      };
    }

    const pipeline = [
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: limit * 10,
          limit: limit * 2,
        },
      },
      {
        $match: {
          "voters.memberUuid": mpUuid,
        },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          uuid: 1,
          title: 1,
          votingTime: 1,
          voters: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    const docs = await collection.aggregate(pipeline).toArray();

    const votes = docs.map((doc) => {
      const voting = doc as Voting & { score: number };
      const mpVote = voting.voters?.find((v) => v.memberUuid === mpUuid);
      return {
        billTitle: doc.title as string,
        decision: (mpVote?.decision || "ABSENT") as VoteDecision,
        date: new Date(doc.votingTime as string),
        similarity: doc.score || 0,
      };
    });

    return { votes };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error finding similar votings:", message);
    return {
      votes: [],
      error: `Vector search failed: ${message}`,
    };
  }
}

/**
 * Find relevant speeches for an MP
 * Falls back to keyword matching if no embeddings available
 */
export async function findRelevantSpeeches(
  queryText: string,
  mpUuid: string,
  limit: number = 3
): Promise<{ speeches: RelevantSpeech[]; error?: string }> {
  try {
    const collection = await getCollection<Stenogram>("stenograms");

    // Fallback: keyword-based search (embeddings not yet implemented for speeches)
    const stenograms = await collection
      .find({
        "speakers.memberUuid": mpUuid,
      })
      .limit(20)
      .toArray();

    // Simple keyword matching
    const queryWords = queryText
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);

    const results: RelevantSpeech[] = [];

    for (const steno of stenograms) {
      for (const speaker of steno.speakers) {
        if (speaker.memberUuid !== mpUuid) continue;

        const textLower = speaker.text.toLowerCase();
        const matchCount = queryWords.filter((w) => textLower.includes(w)).length;

        if (matchCount > 0) {
          results.push({
            topic: speaker.topic || "Parliamentary session",
            excerpt: speaker.text.substring(0, 300) + "...",
            date: new Date(steno.sessionDate),
            similarity: matchCount / Math.max(queryWords.length, 1),
          });
        }
      }
    }

    const speeches = results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return { speeches };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error finding relevant speeches:", message);
    return {
      speeches: [],
      error: `Speech search failed: ${message}`,
    };
  }
}

/**
 * Get full RAG context for a prediction
 */
export async function getRAGContext(
  billText: string,
  mpUuid: string,
  options: { voteLimit?: number; speechLimit?: number } = {}
): Promise<RAGContext> {
  const { voteLimit = 5, speechLimit = 3 } = options;

  const [votesResult, speechesResult] = await Promise.all([
    findSimilarVotings(billText, mpUuid, voteLimit),
    findRelevantSpeeches(billText, mpUuid, speechLimit),
  ]);

  const errors: string[] = [];
  if (votesResult.error) errors.push(votesResult.error);
  if (speechesResult.error) errors.push(speechesResult.error);

  return {
    similarVotes: votesResult.votes,
    relevantSpeeches: speechesResult.speeches,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}
