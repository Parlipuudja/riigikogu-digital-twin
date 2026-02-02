/**
 * Embeddings generation for database collections
 * Uses Voyage AI voyage-multilingual-2 model for Estonian language support
 */

import { getCollection } from "./mongodb";
import { generateEmbedding, generateEmbeddingsBatch } from "../ai/voyage";

// Rate limiting
const BATCH_SIZE = 20;
const DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate embeddings for votings collection
 * Embeds voting title + description for semantic search
 */
export async function generateVoteEmbeddings(): Promise<number> {
  const collection = await getCollection<{
    uuid: string;
    title: string;
    description?: string;
    embedding?: number[];
  }>("votings");

  // Find votings without embeddings
  const votings = await collection
    .find({ embedding: { $exists: false } })
    .limit(500)
    .toArray();

  if (votings.length === 0) {
    console.log("All votings already have embeddings");
    return 0;
  }

  console.log(`Generating embeddings for ${votings.length} votings...`);
  let count = 0;

  // Process in batches
  for (let i = 0; i < votings.length; i += BATCH_SIZE) {
    const batch = votings.slice(i, i + BATCH_SIZE);
    const texts = batch.map((v) => {
      const text = v.description
        ? `${v.title}\n\n${v.description}`
        : v.title;
      return text.slice(0, 8000); // Voyage max input length
    });

    try {
      const embeddings = await generateEmbeddingsBatch(texts, "document");

      // Update each document with its embedding
      for (let j = 0; j < batch.length; j++) {
        await collection.updateOne(
          { uuid: batch[j].uuid },
          { $set: { embedding: embeddings[j] } }
        );
        count++;
      }

      console.log(`  Processed ${count}/${votings.length} votings`);
    } catch (error) {
      console.error(`Error generating embeddings for batch:`, error);
    }

    await delay(DELAY_MS);
  }

  return count;
}

/**
 * Generate embeddings for stenograms/speeches collection
 * Embeds speaker text for similarity search
 */
export async function generateSpeechEmbeddings(): Promise<number> {
  const collection = await getCollection<{
    uuid: string;
    sessionDate: string;
    speakers: Array<{
      fullName: string;
      text: string;
      topic?: string;
    }>;
    embedding?: number[];
  }>("stenograms");

  // Find stenograms without embeddings
  const stenograms = await collection
    .find({ embedding: { $exists: false } })
    .limit(200)
    .toArray();

  if (stenograms.length === 0) {
    console.log("All stenograms already have embeddings");
    return 0;
  }

  console.log(`Generating embeddings for ${stenograms.length} stenograms...`);
  let count = 0;

  for (const stenogram of stenograms) {
    try {
      // Combine all speaker texts into one document
      const combinedText = stenogram.speakers
        .map((s) => {
          const topicPrefix = s.topic ? `[${s.topic}] ` : "";
          return `${topicPrefix}${s.fullName}: ${s.text}`;
        })
        .join("\n\n")
        .slice(0, 8000);

      const embedding = await generateEmbedding(combinedText);

      await collection.updateOne(
        { uuid: stenogram.uuid },
        { $set: { embedding } }
      );
      count++;

      if (count % 10 === 0) {
        console.log(`  Processed ${count}/${stenograms.length} stenograms`);
      }
    } catch (error) {
      console.error(`Error generating embedding for stenogram ${stenogram.uuid}:`, error);
    }

    await delay(DELAY_MS);
  }

  return count;
}

/**
 * Generate embeddings for drafts/bills collection
 * Embeds title + summary/text for semantic search
 */
export async function generateBillEmbeddings(): Promise<number> {
  const collection = await getCollection<{
    uuid: string;
    title: string;
    summary?: string;
    fullText?: string;
    embedding?: number[];
  }>("drafts");

  // Find drafts without embeddings
  const drafts = await collection
    .find({ embedding: { $exists: false } })
    .limit(500)
    .toArray();

  if (drafts.length === 0) {
    console.log("All drafts already have embeddings");
    return 0;
  }

  console.log(`Generating embeddings for ${drafts.length} drafts...`);
  let count = 0;

  // Process in batches
  for (let i = 0; i < drafts.length; i += BATCH_SIZE) {
    const batch = drafts.slice(i, i + BATCH_SIZE);
    const texts = batch.map((d) => {
      // Prefer summary over full text for embedding
      let text = d.title;
      if (d.summary) {
        text += `\n\n${d.summary}`;
      } else if (d.fullText) {
        // Take first part of full text
        text += `\n\n${d.fullText.slice(0, 4000)}`;
      }
      return text.slice(0, 8000);
    });

    try {
      const embeddings = await generateEmbeddingsBatch(texts, "document");

      for (let j = 0; j < batch.length; j++) {
        await collection.updateOne(
          { uuid: batch[j].uuid },
          { $set: { embedding: embeddings[j] } }
        );
        count++;
      }

      console.log(`  Processed ${count}/${drafts.length} drafts`);
    } catch (error) {
      console.error(`Error generating embeddings for batch:`, error);
    }

    await delay(DELAY_MS);
  }

  return count;
}
