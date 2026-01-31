import { getCollection } from './mongodb';
import { generateEmbedding, generateQueryEmbedding, EMBEDDING_DIMENSIONS } from './voyage';

export { EMBEDDING_DIMENSIONS };

export interface EmbeddingResult {
  id: string;
  sourceType: 'vote' | 'bill' | 'speech';
  content: string;
  similarity?: number;
}

interface VoteDocument {
  id: string;
  voting_id: string;
  voting_title: string;
  decision: string;
  date: string;
  embedding?: number[];
}

interface SpeechDocument {
  id: string;
  topic: string;
  full_text: string;
  session_date: string;
  embedding?: number[];
}

interface BillDocument {
  id: string;
  title: string;
  summary: string;
  category: string;
  date: string;
  embedding?: number[];
}

/**
 * Find similar documents using MongoDB Atlas Vector Search
 */
export async function findSimilar(
  queryText: string,
  sourceTypes: ('vote' | 'bill' | 'speech')[],
  limit: number = 5,
  minSimilarity: number = 0.3
): Promise<EmbeddingResult[]> {
  const queryEmbedding = await generateQueryEmbedding(queryText);
  const results: EmbeddingResult[] = [];

  for (const sourceType of sourceTypes) {
    const collectionName = sourceType === 'vote' ? 'votes' :
                          sourceType === 'speech' ? 'speeches' : 'bills';

    const collection = await getCollection(collectionName);

    const pipeline = [
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: limit * 10,
          limit: limit,
        },
      },
      {
        $project: {
          id: 1,
          voting_title: 1,
          decision: 1,
          date: 1,
          topic: 1,
          full_text: 1,
          session_date: 1,
          title: 1,
          summary: 1,
          category: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
      {
        $match: {
          score: { $gte: minSimilarity },
        },
      },
    ];

    const docs = await collection.aggregate(pipeline).toArray();

    for (const doc of docs) {
      let content: string;

      if (sourceType === 'vote') {
        content = `Vote: ${doc.voting_title}\nDecision: ${doc.decision}\nDate: ${doc.date}`;
      } else if (sourceType === 'speech') {
        content = `Speech Topic: ${doc.topic || 'General'}\nDate: ${doc.session_date}\nContent: ${doc.full_text?.substring(0, 500)}`;
      } else {
        content = `Bill: ${doc.title}\nCategory: ${doc.category || 'General'}\nDate: ${doc.date}\nSummary: ${doc.summary || 'No summary'}`;
      }

      results.push({
        id: doc.id || doc._id?.toString() || '',
        sourceType,
        content,
        similarity: doc.score,
      });
    }
  }

  // Sort by similarity and return top results
  return results
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
    .slice(0, limit);
}

/**
 * Generate and store embeddings for all votes
 */
export async function generateVoteEmbeddings(): Promise<number> {
  const collection = await getCollection<VoteDocument>('votes');

  const votes = await collection
    .find({ embedding: { $exists: false } })
    .toArray();

  console.log(`Generating embeddings for ${votes.length} votes...`);

  let count = 0;
  for (const vote of votes) {
    // Rate limiting - wait 21 seconds BEFORE each request to stay under 3 RPM limit
    if (count > 0) {
      console.log(`  Waiting 21s for rate limit...`);
      await new Promise((resolve) => setTimeout(resolve, 21000));
    }

    const content = `Vote: ${vote.voting_title}
Decision: ${vote.decision}
Date: ${vote.date}`;

    try {
      const embedding = await generateEmbedding(content);
      await collection.updateOne(
        { id: vote.id },
        { $set: { embedding } }
      );
      count++;
      console.log(`  [${count}/${votes.length}] Generated embedding for vote`);
    } catch (error) {
      console.error(`Error processing vote ${vote.id}:`, error);
      // Wait extra time on error before retrying next
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
  }

  return count;
}

/**
 * Generate and store embeddings for all speeches
 */
export async function generateSpeechEmbeddings(): Promise<number> {
  const collection = await getCollection<SpeechDocument>('speeches');

  const speeches = await collection
    .find({ embedding: { $exists: false } })
    .toArray();

  console.log(`Generating embeddings for ${speeches.length} speeches...`);

  let count = 0;
  for (const speech of speeches) {
    // Rate limiting - wait 21 seconds BEFORE each request
    if (count > 0) {
      console.log(`  Waiting 21s for rate limit...`);
      await new Promise((resolve) => setTimeout(resolve, 21000));
    }

    // Truncate long texts to fit token limits
    const truncatedText = speech.full_text.substring(0, 8000);

    const content = `Speech Topic: ${speech.topic || 'General'}
Date: ${speech.session_date}
Content: ${truncatedText}`;

    try {
      const embedding = await generateEmbedding(content);
      await collection.updateOne(
        { id: speech.id },
        { $set: { embedding } }
      );
      count++;
      console.log(`  [${count}/${speeches.length}] Generated embedding for speech`);
    } catch (error) {
      console.error(`Error processing speech ${speech.id}:`, error);
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
  }

  return count;
}

/**
 * Generate and store embeddings for all bills
 */
export async function generateBillEmbeddings(): Promise<number> {
  const collection = await getCollection<BillDocument>('bills');

  const bills = await collection
    .find({ embedding: { $exists: false } })
    .toArray();

  console.log(`Generating embeddings for ${bills.length} bills...`);

  let count = 0;
  for (const bill of bills) {
    // Rate limiting - wait 21 seconds BEFORE each request
    if (count > 0) {
      console.log(`  Waiting 21s for rate limit...`);
      await new Promise((resolve) => setTimeout(resolve, 21000));
    }

    const content = `Bill: ${bill.title}
Category: ${bill.category || 'General'}
Date: ${bill.date}
Summary: ${bill.summary || 'No summary available'}`;

    try {
      const embedding = await generateEmbedding(content);
      await collection.updateOne(
        { id: bill.id },
        { $set: { embedding } }
      );
      count++;
      console.log(`  [${count}/${bills.length}] Generated embedding for bill`);
    } catch (error) {
      console.error(`Error processing bill ${bill.id}:`, error);
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
  }

  return count;
}
