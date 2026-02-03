/**
 * Sync votings with all voters embedded from Riigikogu API
 * Uses dynamic rate limiting that adapts to API responses
 */

import { getCollection, getDbStats } from '../../src/lib/data/mongodb';
import {
  getVotings,
  getVotingDetailsFull,
  normalizeDecision,
} from '../../src/lib/sync/riigikogu-api';
import {
  updateStatus,
  initProgress,
  updateCheckpoint,
  getProgress,
  getNextYearToSync,
  getLastSyncedDate,
} from './sync-progress';
import type { Voting, VotingVoter } from '../../src/types';

const COLLECTION_NAME = 'votings';
const SIZE_LIMIT_MB = 480;

// Dynamic rate limiting state
let currentDelayMs = 500; // Start with 500ms
const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 120000; // 2 minutes max

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Adjust delay based on API response
 */
function onSuccess(): void {
  // Gradually decrease delay on success (but keep minimum)
  currentDelayMs = Math.max(MIN_DELAY_MS, currentDelayMs * 0.9);
}

function onRateLimit(): void {
  // Exponentially increase delay on rate limit
  currentDelayMs = Math.min(MAX_DELAY_MS, currentDelayMs * 2);
  console.log(`  Rate limited - delay increased to ${(currentDelayMs / 1000).toFixed(1)}s`);
}

/**
 * Fetch with dynamic rate limiting - handles 429 automatically
 */
async function fetchWithDynamicRetry<T>(
  fetchFn: () => Promise<{ data: T; error?: string }>,
  description: string
): Promise<{ data: T; error?: string }> {
  while (true) {
    await sleep(currentDelayMs);

    const { data, error } = await fetchFn();

    if (error?.includes('429')) {
      onRateLimit();
      continue; // Retry with increased delay
    }

    if (!error) {
      onSuccess();
    }

    return { data, error };
  }
}

/**
 * Get the date range for a year
 * Extended to include 14th convocation (2019-2023) for historical patterns
 */
function getYearDateRange(year: number): { startDate: string; endDate: string } {
  // 14th convocation started April 4, 2019 (extended from 15th which started April 6, 2023)
  const riigikogusStart = new Date('2019-04-04');
  const now = new Date();

  let startDate = new Date(year, 0, 1);
  let endDate = new Date(year, 11, 31);

  if (startDate < riigikogusStart) {
    startDate = riigikogusStart;
  }

  if (endDate > now) {
    endDate = now;
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Check if database is approaching size limit
 */
async function isNearSizeLimit(): Promise<boolean> {
  const stats = await getDbStats();
  const sizeMB = stats.totalSize / (1024 * 1024);
  return sizeMB >= SIZE_LIMIT_MB;
}

/**
 * Sync votings for a specific year
 */
export async function syncVotingsForYear(
  year: number,
  resumeFromDate?: string
): Promise<{ inserted: number; skipped: number; errors: number }> {
  console.log(`\nSyncing votings for ${year}...`);

  const collection = await getCollection<Voting>(COLLECTION_NAME);
  const { startDate, endDate } = getYearDateRange(year);
  const effectiveStartDate = resumeFromDate || startDate;
  console.log(`  Date range: ${effectiveStartDate} to ${endDate}`);

  // Get all votings in the date range with dynamic retry
  const { data: votingList, error } = await fetchWithDynamicRetry(
    () => getVotings(effectiveStartDate, endDate),
    'voting list'
  );

  if (error || !votingList) {
    console.error('Error fetching votings:', error);
    return { inserted: 0, skipped: 0, errors: 1 };
  }

  console.log(`  Found ${votingList.length} votings (delay: ${(currentDelayMs / 1000).toFixed(1)}s)`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let lastProcessedDate = effectiveStartDate;

  for (let i = 0; i < votingList.length; i++) {
    const votingItem = votingList[i];

    // Check size limit periodically
    if (i > 0 && i % 50 === 0) {
      const stats = await getDbStats();
      const sizeMB = stats.totalSize / (1024 * 1024);
      console.log(`  Size check: ${sizeMB.toFixed(2)}MB / ${SIZE_LIMIT_MB}MB`);

      if (sizeMB >= SIZE_LIMIT_MB) {
        console.log('  Size limit reached, pausing sync');
        await updateCheckpoint('votings', year, false, inserted, lastProcessedDate);
        await updateStatus('votings', 'paused', 'Size limit reached');
        return { inserted, skipped, errors };
      }
    }

    try {
      // Check if already exists
      const existing = await collection.findOne({ uuid: votingItem.uuid });
      if (existing) {
        skipped++;
        continue;
      }

      // Get full voting details with dynamic retry
      const { data: details, error: detailError } = await fetchWithDynamicRetry(
        () => getVotingDetailsFull(votingItem.uuid),
        `voting ${votingItem.uuid}`
      );

      if (detailError || !details) {
        // Skip 404 errors silently (voting was deleted)
        if (!detailError?.includes('404')) {
          console.error(`  Error: ${detailError}`);
        }
        errors++;
        continue;
      }

      // Transform votes to voters array
      const voters: VotingVoter[] = (details.votes || []).map(vote => ({
        memberUuid: vote.memberUuid,
        fullName: `${vote.memberFirstName} ${vote.memberLastName}`,
        faction: vote.faction?.code || 'FR',
        decision: normalizeDecision(vote.decision.code),
      }));

      const voting: Voting = {
        uuid: details.uuid,
        title: details.title,
        votingTime: details.votingTime,
        type: details.votingType,
        result: details.result,
        inFavor: voters.filter(v => v.decision === 'FOR').length,
        against: voters.filter(v => v.decision === 'AGAINST').length,
        abstained: voters.filter(v => v.decision === 'ABSTAIN').length,
        absent: voters.filter(v => v.decision === 'ABSENT').length,
        voters,
        syncedAt: new Date(),
      };

      await collection.insertOne(voting);
      inserted++;
      lastProcessedDate = votingItem.votingTime.split('T')[0];

      // Progress output
      if (inserted % 10 === 0 || inserted === 1) {
        console.log(`  ${year}: ${inserted}/${votingList.length - skipped} inserted (delay: ${(currentDelayMs / 1000).toFixed(1)}s)`);
      }
    } catch (err) {
      errors++;
      console.error(`  Error processing voting:`, err);
    }
  }

  // Update checkpoint
  await updateCheckpoint('votings', year, true, inserted, lastProcessedDate);

  console.log(`  Year ${year} complete: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);
  return { inserted, skipped, errors };
}

/**
 * Sync all votings, year by year from latest to earliest
 */
export async function syncAllVotings(): Promise<{ total: number; years: number[] }> {
  console.log('Starting full votings sync...');
  console.log('Using dynamic rate limiting - will adapt to API responses');

  const today = new Date().toISOString().split('T')[0];
  const progress = await getProgress('votings');

  if (!progress) {
    await initProgress('votings', today, '2019-04-04');
  }

  await updateStatus('votings', 'running');

  const yearsCompleted: number[] = [];
  let totalInserted = 0;

  let nextYear = await getNextYearToSync('votings');

  while (nextYear !== null) {
    if (await isNearSizeLimit()) {
      console.log('\nSize limit reached, stopping sync');
      await updateStatus('votings', 'paused', 'Size limit reached');
      break;
    }

    const lastDate = await getLastSyncedDate('votings', nextYear);
    const { inserted } = await syncVotingsForYear(nextYear, lastDate || undefined);
    totalInserted += inserted;
    yearsCompleted.push(nextYear);

    nextYear = await getNextYearToSync('votings');
  }

  if (nextYear === null) {
    await updateStatus('votings', 'completed');
  }

  console.log('\nVotings sync complete:');
  console.log(`  Total inserted: ${totalInserted}`);
  console.log(`  Years completed: ${yearsCompleted.join(', ')}`);

  return { total: totalInserted, years: yearsCompleted };
}

/**
 * Resume votings sync from last checkpoint
 */
export async function resumeVotingsSync(): Promise<{ total: number; years: number[] }> {
  const progress = await getProgress('votings');

  if (!progress) {
    console.log('No previous sync found, starting fresh');
    return syncAllVotings();
  }

  console.log(`Resuming votings sync from ${progress.status} state`);
  console.log(`  Total records: ${progress.totalRecords}`);
  console.log(`  Checkpoints: ${progress.checkpoints.map(c => `${c.year}:${c.completed ? 'done' : 'partial'}`).join(', ')}`);

  return syncAllVotings();
}

/**
 * Get voting count from DB
 */
export async function getVotingCount(): Promise<number> {
  const collection = await getCollection<Voting>(COLLECTION_NAME);
  return collection.countDocuments({});
}
