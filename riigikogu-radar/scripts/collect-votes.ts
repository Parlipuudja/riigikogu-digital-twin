/**
 * Collect voting data from Riigikogu API
 * Usage: npm run data:collect-votes
 */

import 'dotenv/config';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import {
  getVotings,
  getVotingDetails,
  normalizeDecision,
  findMpVote,
} from '../src/lib/sync/riigikogu-api';

// Tõnis Lukas MP UUID - replace with actual UUID from Riigikogu API
const MP_UUID = process.env.MP_UUID || '36a13f33-bfa9-4608-b686-4d7a4d33fdc4';
const MP_NAME = 'Tõnis Lukas';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/riigikogu';

const clientOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectVotes(startDate: string, endDate: string): Promise<void> {
  console.log(`Collecting votes from ${startDate} to ${endDate}...`);

  const client = new MongoClient(uri, clientOptions);

  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection('votes');

    // Get all votings in the date range
    const votingsResult = await getVotings(startDate, endDate);

    if (votingsResult.error) {
      console.error('Error fetching votings:', votingsResult.error);
      return;
    }

    const votings = votingsResult.data;
    console.log(`Found ${votings.length} votings`);

    let inserted = 0;
    let skipped = 0;

    for (const voting of votings) {
      // Add delay to avoid rate limiting
      await sleep(200);

      // Get voting details including individual votes
      const detailsResult = await getVotingDetails(voting.uuid);

      if (detailsResult.error) {
        console.error(`Error fetching voting ${voting.uuid}:`, detailsResult.error);
        continue;
      }

      const details = detailsResult.data;

      // Find MP's vote in this voting
      const mpVote = findMpVote(details, MP_UUID);

      if (!mpVote) {
        // MP didn't participate in this voting
        skipped++;
        continue;
      }

      const decision = normalizeDecision(mpVote.decision.code);
      const party = mpVote.faction?.value || 'Unknown';

      try {
        // Check if vote already exists
        const existing = await collection.findOne({
          voting_id: voting.uuid,
          mp_uuid: MP_UUID,
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Insert the vote
        await collection.insertOne({
          id: uuidv4(),
          voting_id: voting.uuid,
          mp_uuid: MP_UUID,
          mp_name: MP_NAME,
          party: party,
          decision: decision,
          voting_title: voting.title,
          date: voting.votingTime,
        });

        inserted++;
        console.log(`Inserted vote: ${voting.title.substring(0, 50)}... - ${decision}`);
      } catch (error) {
        console.error('Database error:', error);
      }
    }

    console.log(`\nCollection complete:`);
    console.log(`  Inserted: ${inserted}`);
    console.log(`  Skipped: ${skipped}`);
  } finally {
    await client.close();
  }
}

async function main(): Promise<void> {
  try {
    // Collect votes from 2023 to present (XV Riigikogu)
    const startDate = '2023-04-01'; // XV Riigikogu started April 2023
    const endDate = new Date().toISOString().split('T')[0];

    await collectVotes(startDate, endDate);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
