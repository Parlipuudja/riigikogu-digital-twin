/**
 * Collect speech data from Riigikogu stenograms
 * Usage: npm run data:collect-speeches
 */

import 'dotenv/config';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { getStenograms, extractMpSpeeches } from '../src/lib/sync/riigikogu-api';

// Tõnis Lukas MP UUID
const MP_UUID = process.env.MP_UUID || '36a13f33-bfa9-4608-b686-4d7a4d33fdc4';

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

async function collectSpeeches(startDate: string, endDate: string): Promise<void> {
  console.log(`Collecting speeches from ${startDate} to ${endDate}...`);

  const client = new MongoClient(uri, clientOptions);

  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection('speeches');

    const result = await getStenograms(startDate, endDate);

    if (result.error) {
      console.error('Error fetching stenograms:', result.error);
      return;
    }

    const stenograms = result.data;
    console.log(`Found ${stenograms.length} stenograms`);

    let inserted = 0;
    let skipped = 0;

    for (const stenogram of stenograms) {
      await sleep(100);

      // Extract speeches by the target MP
      const speeches = extractMpSpeeches(stenogram, MP_UUID);

      if (speeches.length === 0) {
        continue;
      }

      console.log(`Found ${speeches.length} speeches in session ${stenogram.sessionDate}`);

      for (const speech of speeches) {
        if (!speech.text || speech.text.trim().length < 50) {
          // Skip very short entries (procedural comments)
          skipped++;
          continue;
        }

        try {
          // Check if speech already exists (simple deduplication)
          const existing = await collection.findOne({
            mp_uuid: MP_UUID,
            session_date: stenogram.sessionDate,
            full_text: speech.text,
          });

          if (existing) {
            skipped++;
            continue;
          }

          // Determine session type
          const sessionType = stenogram.sessionType?.toLowerCase().includes('committee')
            ? 'COMMITTEE'
            : 'PLENARY';

          // Insert the speech
          await collection.insertOne({
            id: uuidv4(),
            mp_uuid: MP_UUID,
            session_date: stenogram.sessionDate,
            session_type: sessionType,
            topic: speech.topic || 'General',
            full_text: speech.text,
          });

          inserted++;
          const topicPreview = speech.topic || 'General';
          console.log(`  Inserted: ${topicPreview.substring(0, 40)}...`);
        } catch (error) {
          console.error('Database error:', error);
        }
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
    // Collect speeches from 2023 to present
    const startDate = '2023-04-01';
    const endDate = new Date().toISOString().split('T')[0];

    await collectSpeeches(startDate, endDate);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
