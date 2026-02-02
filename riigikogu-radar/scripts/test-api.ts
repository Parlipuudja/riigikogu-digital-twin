#!/usr/bin/env npx tsx
import 'dotenv/config';
import { getCollection, closeConnection } from '../src/lib/data/mongodb';

async function test() {
  // Get a sample draft UUID
  const drafts = await getCollection('drafts');
  const sample = await drafts.findOne({});
  const uuid = (sample as any).uuid;
  console.log('Testing draft:', uuid, '\n');

  // Fetch from API
  const response = await fetch(`https://api.riigikogu.ee/api/volumes/drafts/${uuid}?lang=et`);
  const data = await response.json();

  console.log('API response keys:', Object.keys(data));
  console.log('\nHas readings:', data.readings ? 'YES' : 'NO');
  console.log('Has texts:', data.texts ? 'YES' : 'NO');

  if (data.readings) {
    console.log('\nReadings:');
    for (const r of data.readings) {
      console.log('  -', r.readingCode, '| votings:', r.votings?.length || 0);
      if (r.votings?.length > 0) {
        console.log('    Voting UUIDs:', r.votings.map((v: any) => v.uuid));
      }
    }
  }

  await closeConnection();
}

test().catch(e => console.error(e));
