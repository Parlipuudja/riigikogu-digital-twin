/**
 * Generate embeddings for all data in the database
 * Usage: npm run embeddings:generate
 */

import {
  generateVoteEmbeddings,
  generateSpeechEmbeddings,
  generateBillEmbeddings,
} from '../src/lib/embeddings';
import pool from '../src/lib/db';

async function main(): Promise<void> {
  console.log('Starting embedding generation...\n');

  try {
    // Generate embeddings for votes
    const voteCount = await generateVoteEmbeddings();
    console.log(`Generated ${voteCount} vote embeddings\n`);

    // Generate embeddings for speeches
    const speechCount = await generateSpeechEmbeddings();
    console.log(`Generated ${speechCount} speech embeddings\n`);

    // Generate embeddings for bills
    const billCount = await generateBillEmbeddings();
    console.log(`Generated ${billCount} bill embeddings\n`);

    console.log('Embedding generation complete!');
    console.log(`Total: ${voteCount + speechCount + billCount} embeddings`);
  } catch (error) {
    console.error('Error generating embeddings:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
