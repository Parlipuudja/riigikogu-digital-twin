import OpenAI from 'openai';
import { query } from './db';
import { v4 as uuidv4 } from 'uuid';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingResult {
  id: string;
  sourceType: 'vote' | 'bill' | 'speech';
  sourceId: string;
  content: string;
  similarity?: number;
}

/**
 * Generate embedding for a text string
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Store an embedding in the database
 */
export async function storeEmbedding(
  sourceType: 'vote' | 'bill' | 'speech',
  sourceId: string,
  content: string,
  embedding: number[]
): Promise<string> {
  const id = uuidv4();

  // Format embedding as PostgreSQL vector literal
  const vectorLiteral = `[${embedding.join(',')}]`;

  await query(
    `INSERT INTO embeddings (id, source_type, source_id, content, embedding)
     VALUES ($1, $2, $3, $4, $5::vector)
     ON CONFLICT DO NOTHING`,
    [id, sourceType, sourceId, content, vectorLiteral]
  );

  return id;
}

/**
 * Find similar embeddings using cosine similarity
 */
export async function findSimilar(
  queryEmbedding: number[],
  sourceTypes: ('vote' | 'bill' | 'speech')[],
  limit: number = 5,
  minSimilarity: number = 0.3
): Promise<EmbeddingResult[]> {
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  // Use pgvector's cosine distance operator (1 - similarity)
  const results = await query<{
    id: string;
    source_type: string;
    source_id: string;
    content: string;
    similarity: number;
  }>(
    `SELECT
       id,
       source_type,
       source_id,
       content,
       1 - (embedding <=> $1::vector) as similarity
     FROM embeddings
     WHERE source_type = ANY($2)
     AND 1 - (embedding <=> $1::vector) >= $3
     ORDER BY embedding <=> $1::vector
     LIMIT $4`,
    [vectorLiteral, sourceTypes, minSimilarity, limit]
  );

  return results.map(row => ({
    id: row.id,
    sourceType: row.source_type as 'vote' | 'bill' | 'speech',
    sourceId: row.source_id,
    content: row.content,
    similarity: row.similarity,
  }));
}

/**
 * Generate and store embeddings for all votes
 */
export async function generateVoteEmbeddings(): Promise<number> {
  const votes = await query<{
    id: string;
    voting_title: string;
    decision: string;
    date: string;
  }>(
    `SELECT v.id, v.voting_title, v.decision, v.date
     FROM votes v
     LEFT JOIN embeddings e ON e.source_id = v.id AND e.source_type = 'vote'
     WHERE e.id IS NULL`
  );

  console.log(`Generating embeddings for ${votes.length} votes...`);

  let count = 0;
  for (const vote of votes) {
    // Create rich text content for embedding
    const content = `Vote: ${vote.voting_title}
Decision: ${vote.decision}
Date: ${vote.date}`;

    try {
      const embedding = await generateEmbedding(content);
      await storeEmbedding('vote', vote.id, content, embedding);
      count++;

      if (count % 10 === 0) {
        console.log(`  Processed ${count}/${votes.length} votes`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error processing vote ${vote.id}:`, error);
    }
  }

  return count;
}

/**
 * Generate and store embeddings for all speeches
 */
export async function generateSpeechEmbeddings(): Promise<number> {
  const speeches = await query<{
    id: string;
    topic: string;
    full_text: string;
    session_date: string;
  }>(
    `SELECT s.id, s.topic, s.full_text, s.session_date
     FROM speeches s
     LEFT JOIN embeddings e ON e.source_id = s.id AND e.source_type = 'speech'
     WHERE e.id IS NULL`
  );

  console.log(`Generating embeddings for ${speeches.length} speeches...`);

  let count = 0;
  for (const speech of speeches) {
    // Truncate long texts to fit token limits (roughly 8000 chars = ~2000 tokens)
    const truncatedText = speech.full_text.substring(0, 8000);

    const content = `Speech Topic: ${speech.topic || 'General'}
Date: ${speech.session_date}
Content: ${truncatedText}`;

    try {
      const embedding = await generateEmbedding(content);
      await storeEmbedding('speech', speech.id, content, embedding);
      count++;

      if (count % 10 === 0) {
        console.log(`  Processed ${count}/${speeches.length} speeches`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error processing speech ${speech.id}:`, error);
    }
  }

  return count;
}

/**
 * Generate and store embeddings for all bills
 */
export async function generateBillEmbeddings(): Promise<number> {
  const bills = await query<{
    id: string;
    title: string;
    summary: string;
    category: string;
    date: string;
  }>(
    `SELECT b.id, b.title, b.summary, b.category, b.date
     FROM bills b
     LEFT JOIN embeddings e ON e.source_id = b.id AND e.source_type = 'bill'
     WHERE e.id IS NULL`
  );

  console.log(`Generating embeddings for ${bills.length} bills...`);

  let count = 0;
  for (const bill of bills) {
    const content = `Bill: ${bill.title}
Category: ${bill.category || 'General'}
Date: ${bill.date}
Summary: ${bill.summary || 'No summary available'}`;

    try {
      const embedding = await generateEmbedding(content);
      await storeEmbedding('bill', bill.id, content, embedding);
      count++;

      if (count % 10 === 0) {
        console.log(`  Processed ${count}/${bills.length} bills`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error processing bill ${bill.id}:`, error);
    }
  }

  return count;
}
