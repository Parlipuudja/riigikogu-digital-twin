/**
 * Collect speech data from Riigikogu stenograms
 * Usage: npm run data:collect-speeches
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { getStenograms, extractMpSpeeches } from '../src/lib/riigikogu-api';

// Tõnis Lukas MP UUID
const MP_UUID = process.env.MP_UUID || '36a13f33-bfa9-4608-b686-4d7a4d33fdc4';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/riigikogu',
});

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function collectSpeeches(startDate: string, endDate: string): Promise<void> {
  console.log(`Collecting speeches from ${startDate} to ${endDate}...`);

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
        const existing = await pool.query(
          `SELECT id FROM speeches
           WHERE mp_uuid = $1
           AND session_date = $2
           AND full_text = $3`,
          [MP_UUID, stenogram.sessionDate, speech.text]
        );

        if (existing.rows.length > 0) {
          skipped++;
          continue;
        }

        // Determine session type
        const sessionType = stenogram.sessionType?.toLowerCase().includes('committee')
          ? 'COMMITTEE'
          : 'PLENARY';

        // Insert the speech
        await pool.query(
          `INSERT INTO speeches (id, mp_uuid, session_date, session_type, topic, full_text)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            uuidv4(),
            MP_UUID,
            stenogram.sessionDate,
            sessionType,
            speech.topic || 'General',
            speech.text,
          ]
        );

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
  } finally {
    await pool.end();
  }
}

main();
