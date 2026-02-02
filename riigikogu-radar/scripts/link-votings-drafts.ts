#!/usr/bin/env npx tsx
/**
 * Link votings to their related drafts using API-provided UUIDs
 *
 * This script uses relatedVotingUuids from drafts (populated by sync-draft-texts.ts)
 * to establish bidirectional links:
 * - Updates votings with relatedDraftUuid and relatedDraftText
 * - Ensures drafts have complete relatedVotingUuids arrays
 *
 * Usage:
 *   npx tsx scripts/link-votings-drafts.ts
 */

import 'dotenv/config';
import { getCollection, closeConnection } from '../src/lib/data/mongodb';
import type { Draft, Voting } from '../src/types';

async function main() {
  console.log('=== Linking Votings to Drafts ===\n');

  const votingsCollection = await getCollection<Voting>('votings');
  const draftsCollection = await getCollection<Draft>('drafts');

  // Get drafts that have related voting UUIDs from the API
  const draftsWithVotings = await draftsCollection.find({
    relatedVotingUuids: { $exists: true, $not: { $size: 0 } }
  }).toArray();

  console.log(`Found ${draftsWithVotings.length} drafts with voting links from API`);

  let votingsLinked = 0;
  let votingsAlreadyLinked = 0;
  let votingsNotFound = 0;
  let votingsWithText = 0;

  for (const draft of draftsWithVotings) {
    const votingUuids = draft.relatedVotingUuids || [];

    for (const votingUuid of votingUuids) {
      // Check if voting exists and needs updating
      const voting = await votingsCollection.findOne({ uuid: votingUuid });

      if (!voting) {
        votingsNotFound++;
        continue;
      }

      if (voting.relatedDraftUuid === draft.uuid) {
        votingsAlreadyLinked++;
        continue;
      }

      // Update voting with draft link and full text
      const update: Record<string, unknown> = {
        relatedDraftUuid: draft.uuid,
      };

      if (draft.fullText) {
        // Store a reasonable portion of the text for RAG
        update.relatedDraftText = draft.fullText.substring(0, 10000);
        votingsWithText++;
      }

      await votingsCollection.updateOne(
        { uuid: votingUuid },
        { $set: update }
      );

      votingsLinked++;

      if (votingsLinked % 50 === 0 || votingsLinked === 1) {
        console.log(`[${votingsLinked}] Linked: "${voting.title.substring(0, 40)}..." → "${draft.title.substring(0, 40)}..."`);
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Drafts with voting links: ${draftsWithVotings.length}`);
  console.log(`Votings linked: ${votingsLinked}`);
  console.log(`Votings already linked: ${votingsAlreadyLinked}`);
  console.log(`Votings not found in DB: ${votingsNotFound}`);
  console.log(`Votings with full text: ${votingsWithText}`);

  // Show statistics
  const totalVotings = await votingsCollection.countDocuments({});
  const linkedVotings = await votingsCollection.countDocuments({
    relatedDraftUuid: { $exists: true, $ne: '' }
  });
  const votingsWithTextCount = await votingsCollection.countDocuments({
    relatedDraftText: { $exists: true, $ne: '' }
  });

  console.log(`\n=== Database Status ===`);
  console.log(`Total votings: ${totalVotings}`);
  console.log(`Votings with draft link: ${linkedVotings} (${((linkedVotings / totalVotings) * 100).toFixed(1)}%)`);
  console.log(`Votings with draft text: ${votingsWithTextCount} (${((votingsWithTextCount / totalVotings) * 100).toFixed(1)}%)`);

  await closeConnection();
}

main().catch(error => {
  console.error('Fatal error:', error);
  closeConnection().finally(() => process.exit(1));
});
