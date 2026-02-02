#!/usr/bin/env npx tsx
/**
 * Regenerate an MP profile with fresh data analysis
 */

import 'dotenv/config';
import { regenerateMPProfile, getMPBySlug, getAllMPs } from '../src/lib/data/mps';
import { closeConnection } from '../src/lib/data/mongodb';

async function regenerate() {
  const slug = process.argv[2];

  if (!slug) {
    // Regenerate all MPs
    console.log('No slug provided - regenerating all MPs...\n');
    const { mps } = await getAllMPs();

    for (const mp of mps) {
      const name = mp.info?.fullName || mp.slug;
      console.log(`Regenerating: ${name}...`);
      try {
        const updated = await regenerateMPProfile(mp.uuid);
        const votes = updated.info?.votingStats?.total || 0;
        console.log(`  Done - ${votes} votes analyzed`);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`  Error: ${msg}`);
      }
      // Add delay between API calls
      await new Promise(r => setTimeout(r, 2000));
    }
  } else {
    const mp = await getMPBySlug(slug);
    if (!mp) {
      console.log(`MP not found: ${slug}`);
      await closeConnection();
      process.exit(1);
    }

    console.log(`Regenerating ${mp.info?.fullName || slug}...`);
    const updated = await regenerateMPProfile(mp.uuid);
    console.log(`Done - ${updated.info?.votingStats?.total || 0} votes analyzed`);
    console.log(`Prompt template length: ${updated.instruction?.promptTemplate?.length || 0}`);
    console.log('\nPrompt template:');
    console.log(updated.instruction?.promptTemplate || 'N/A');
  }

  await closeConnection();
}

regenerate().catch(e => {
  console.error('Error:', e.message || e);
  process.exit(1);
});
