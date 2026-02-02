#!/usr/bin/env npx tsx
/**
 * Regenerate MP profiles with fresh data analysis
 *
 * Usage:
 *   npx tsx scripts/regen-mp.ts               # Regenerate all existing MPs
 *   npx tsx scripts/regen-mp.ts <slug>        # Regenerate specific MP
 *   npx tsx scripts/regen-mp.ts --all         # Generate all members (create new MPs)
 *   npx tsx scripts/regen-mp.ts --limit=10    # Generate first N members
 */

import 'dotenv/config';
import { regenerateMPProfile, getMPBySlug, getAllMPs } from '../src/lib/data/mps';
import { closeConnection, getCollection } from '../src/lib/data/mongodb';

interface Member {
  uuid: string;
  fullName: string;
  active?: boolean;
}

async function regenerate() {
  const args = process.argv.slice(2);
  const allFlag = args.includes('--all');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const slug = args.find(a => !a.startsWith('--'));

  if (allFlag) {
    // Generate profiles for all current members
    console.log('Generating profiles for all current members...\n');

    const membersCollection = await getCollection<Member>('members');
    const mpsCollection = await getCollection<{ uuid: string }>('mps');

    // Get all current members (use 'active' field from Riigikogu API)
    let members = await membersCollection
      .find({ active: true })
      .sort({ fullName: 1 })
      .toArray();

    if (limit) {
      // Filter to members without profiles first
      const existingUuids = new Set(
        (await mpsCollection.find({}, { projection: { uuid: 1 } }).toArray()).map(mp => mp.uuid)
      );
      const newMembers = members.filter(m => !existingUuids.has(m.uuid));
      members = newMembers.slice(0, limit);
      console.log(`Processing ${members.length} new members (limit: ${limit})...\n`);
    } else {
      console.log(`Processing ${members.length} members...\n`);
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      console.log(`[${i + 1}/${members.length}] ${member.fullName}...`);
      try {
        const updated = await regenerateMPProfile(member.uuid);
        const votes = updated.info?.votingStats?.totalVotes || 0;
        console.log(`  ✓ Done - ${votes} votes analyzed`);
        success++;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ Error: ${msg}`);
        failed++;
      }
      // Add delay between API calls to avoid rate limiting
      await new Promise(r => setTimeout(r, 3000));
    }

    console.log(`\nCompleted: ${success} success, ${failed} failed`);
  } else if (slug) {
    // Regenerate specific MP
    const mp = await getMPBySlug(slug);
    if (!mp) {
      console.log(`MP not found: ${slug}`);
      await closeConnection();
      process.exit(1);
    }

    console.log(`Regenerating ${mp.info?.fullName || slug}...`);
    const updated = await regenerateMPProfile(mp.uuid);
    console.log(`Done - ${updated.info?.votingStats?.totalVotes || 0} votes analyzed`);
    console.log(`Prompt template length: ${updated.instruction?.promptTemplate?.length || 0}`);
    console.log('\nPrompt template:');
    console.log(updated.instruction?.promptTemplate || 'N/A');
  } else {
    // Regenerate all existing MPs
    console.log('Regenerating all existing MPs...\n');
    const { mps } = await getAllMPs();

    if (mps.length === 0) {
      console.log('No existing MPs found. Use --all to generate from members.');
      await closeConnection();
      return;
    }

    for (const mp of mps) {
      const name = mp.info?.fullName || mp.slug;
      console.log(`Regenerating: ${name}...`);
      try {
        const updated = await regenerateMPProfile(mp.uuid);
        const votes = updated.info?.votingStats?.totalVotes || 0;
        console.log(`  Done - ${votes} votes analyzed`);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`  Error: ${msg}`);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  await closeConnection();
}

regenerate().catch(e => {
  console.error('Error:', e.message || e);
  process.exit(1);
});
