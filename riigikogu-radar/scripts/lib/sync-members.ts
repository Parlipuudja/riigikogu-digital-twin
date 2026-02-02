/**
 * Sync parliament members from Riigikogu API
 */

import { getCollection } from '../../src/lib/data/mongodb';
import { getAllPlenaryMembers, getMemberDetails, factionsToParty } from '../../src/lib/sync/riigikogu-api';
import { updateStatus, initProgress, updateCheckpoint } from './sync-progress';
import type { Member } from '../../src/types';

const COLLECTION_NAME = 'members';
const RATE_LIMIT_MS = 200;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sync all parliament members
 * This is a one-time operation that fetches all members
 */
export async function syncMembers(): Promise<{ inserted: number; updated: number; errors: number }> {
  console.log('Starting member sync...');

  // Initialize progress
  const today = new Date().toISOString().split('T')[0];
  await initProgress('members', today, '2023-04-01');
  await updateStatus('members', 'running');

  const collection = await getCollection<Member>(COLLECTION_NAME);

  // Get all members from API
  const { data: apiMembers, error } = await getAllPlenaryMembers();

  if (error || !apiMembers) {
    console.error('Error fetching members:', error);
    await updateStatus('members', 'error', error || 'Unknown error');
    return { inserted: 0, updated: 0, errors: 1 };
  }

  console.log(`Found ${apiMembers.length} members in API`);

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const apiMember of apiMembers) {
    await sleep(RATE_LIMIT_MS);

    try {
      // Get detailed member info
      const { data: details } = await getMemberDetails(apiMember.uuid);

      // Extract committees from memberships
      const committees = (details?.memberships || [])
        .filter(m => m.bodyType === 'COMMITTEE')
        .map(m => ({
          name: m.bodyName,
          role: m.roleName || 'Liige',
          active: !m.endDate,
        }));

      // Extract convocation numbers
      const convocations = (details?.convocations || [])
        .map(c => c.number)
        .sort((a, b) => a - b);

      // Get faction/party info from factions array
      const party = factionsToParty(apiMember.factions);

      // Build faction object from party info
      const faction = {
        code: party.code,
        value: party.name,
      };

      const member: Member = {
        uuid: apiMember.uuid,
        firstName: apiMember.firstName,
        lastName: apiMember.lastName,
        fullName: apiMember.fullName || `${apiMember.firstName} ${apiMember.lastName}`,
        active: apiMember.active,
        faction,
        photoUrl: apiMember.photo?._links?.download?.href || details?.photoBig || details?.photoSmall || null,
        committees,
        convocations,
        syncedAt: new Date(),
      };

      // Upsert member
      const result = await collection.updateOne(
        { uuid: member.uuid },
        { $set: member },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        inserted++;
        console.log(`  Inserted: ${member.fullName} (${party.code})`);
      } else if (result.modifiedCount > 0) {
        updated++;
        console.log(`  Updated: ${member.fullName} (${party.code})`);
      }
    } catch (err) {
      errors++;
      console.error(`  Error syncing member ${apiMember.uuid}:`, err);
    }
  }

  // Update progress
  await updateCheckpoint('members', new Date().getFullYear(), true, inserted + updated);
  await updateStatus('members', 'completed');

  console.log('\nMember sync complete:');
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Errors: ${errors}`);

  return { inserted, updated, errors };
}

/**
 * Get member by UUID (cached from DB)
 */
export async function getMemberFromDb(uuid: string): Promise<Member | null> {
  const collection = await getCollection<Member>(COLLECTION_NAME);
  return collection.findOne({ uuid });
}

/**
 * Get all members from DB
 */
export async function getAllMembersFromDb(): Promise<Member[]> {
  const collection = await getCollection<Member>(COLLECTION_NAME);
  return collection.find({}).toArray();
}

/**
 * Get member count
 */
export async function getMemberCount(): Promise<number> {
  const collection = await getCollection<Member>(COLLECTION_NAME);
  return collection.countDocuments({});
}
