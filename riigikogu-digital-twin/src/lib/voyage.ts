/**
 * Voyage AI client for generating multilingual embeddings
 * Model: voyage-multilingual-2 (1024 dimensions)
 * Better support for Estonian language compared to OpenAI embeddings
 */

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-multilingual-2';
export const EMBEDDING_DIMENSIONS = 1024;

interface VoyageEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

/**
 * Generate embedding for a document (for storage)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;

  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY environment variable is not set');
  }

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: text,
      input_type: 'document',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Voyage AI API error: ${response.status} - ${errorText}`);
  }

  const data: VoyageEmbeddingResponse = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate embedding for a query (for search)
 * Uses a different input_type for better retrieval performance
 */
export async function generateQueryEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;

  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY environment variable is not set');
  }

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: text,
      input_type: 'query',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Voyage AI API error: ${response.status} - ${errorText}`);
  }

  const data: VoyageEmbeddingResponse = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 * More efficient for bulk operations
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  inputType: 'document' | 'query' = 'document'
): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;

  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY environment variable is not set');
  }

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts,
      input_type: inputType,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Voyage AI API error: ${response.status} - ${errorText}`);
  }

  const data: VoyageEmbeddingResponse = await response.json();
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}
