/**
 * Sync stenograms (parliamentary speeches) from Riigikogu API
 * Uses dynamic rate limiting that adapts to API responses
 */

import { getCollection, getDbStats } from '../../src/lib/data/mongodb';
import { getStenograms } from '../../src/lib/sync/riigikogu-api';
import {
  updateStatus,
  initProgress,
  updateCheckpoint,
  getProgress,
  getNextYearToSync,
  getLastSyncedDate,
} from './sync-progress';
import type { Stenogram, StenogramSpeaker } from '../../src/types';

const COLLECTION_NAME = 'stenograms';
const SIZE_LIMIT_MB = 480;
const MAX_TEXT_LENGTH = 10000;

// Dynamic rate limiting state
let currentDelayMs = 500;
const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 120000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function onSuccess(): void {
  currentDelayMs = Math.max(MIN_DELAY_MS, currentDelayMs * 0.9);
}

function onRateLimit(): void {
  currentDelayMs = Math.min(MAX_DELAY_MS, currentDelayMs * 2);
  console.log(`  Rate limited - delay increased to ${(currentDelayMs / 1000).toFixed(1)}s`);
}

async function fetchWithDynamicRetry<T>(
  fetchFn: () => Promise<{ data: T; error?: string }>
): Promise<{ data: T; error?: string }> {
  while (true) {
    await sleep(currentDelayMs);
    const { data, error } = await fetchFn();

    if (error?.includes('429')) {
      onRateLimit();
      continue;
    }

    if (!error) {
      onSuccess();
    }

    return { data, error };
  }
}

function getYearDateRange(year: number): { startDate: string; endDate: string } {
  const riigikogusStart = new Date('2023-04-06');
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

async function isNearSizeLimit(): Promise<boolean> {
  const stats = await getDbStats();
  const sizeMB = stats.totalSize / (1024 * 1024);
  return sizeMB >= SIZE_LIMIT_MB;
}

function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) {
    return text;
  }
  return text.substring(0, MAX_TEXT_LENGTH) + '... [truncated]';
}

export async function syncStenogramsForYear(
  year: number,
  resumeFromDate?: string
): Promise<{ inserted: number; skipped: number; errors: number }> {
  console.log(`\nSyncing stenograms for ${year}...`);

  const collection = await getCollection<Stenogram>(COLLECTION_NAME);
  const { startDate, endDate } = getYearDateRange(year);
  const effectiveStartDate = resumeFromDate || startDate;
  console.log(`  Date range: ${effectiveStartDate} to ${endDate}`);

  // getStenograms now returns full data with embedded speeches
  const { data: stenogramList, error } = await fetchWithDynamicRetry(
    () => getStenograms(effectiveStartDate, endDate)
  );

  if (error || !stenogramList) {
    console.error('Error fetching stenograms:', error);
    return { inserted: 0, skipped: 0, errors: 1 };
  }

  console.log(`  Found ${stenogramList.length} stenograms (delay: ${(currentDelayMs / 1000).toFixed(1)}s)`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let lastProcessedDate = effectiveStartDate;

  for (let i = 0; i < stenogramList.length; i++) {
    const stenogramItem = stenogramList[i];

    // Check size limit after each stenogram (they're large)
    if (i > 0 && i % 5 === 0) {
      const stats = await getDbStats();
      const sizeMB = stats.totalSize / (1024 * 1024);
      console.log(`  Size check: ${sizeMB.toFixed(2)}MB / ${SIZE_LIMIT_MB}MB`);

      if (sizeMB >= SIZE_LIMIT_MB) {
        console.log('  Size limit reached, pausing sync');
        await updateCheckpoint('stenograms', year, false, inserted, lastProcessedDate);
        await updateStatus('stenograms', 'paused', 'Size limit reached');
        return { inserted, skipped, errors };
      }
    }

    try {
      const existing = await collection.findOne({ uuid: stenogramItem.uuid });
      if (existing) {
        skipped++;
        continue;
      }

      // Speeches are already embedded in the response from getStenograms
      const speakers: StenogramSpeaker[] = (stenogramItem.speakers || []).map(s => ({
        memberUuid: s.memberUuid,
        fullName: s.speakerName,
        text: truncateText(s.text || ''),
        topic: s.topic || null,
      }));

      const stenogram: Stenogram = {
        uuid: stenogramItem.uuid,
        sessionDate: stenogramItem.sessionDate,
        sessionNumber: undefined,
        sessionType: stenogramItem.sessionType || 'PLENARY',
        speakers,
        syncedAt: new Date(),
      };

      await collection.insertOne(stenogram);
      inserted++;
      lastProcessedDate = stenogramItem.sessionDate;

      console.log(`  ${year}: ${inserted} stenograms (${speakers.length} speakers)`);
    } catch (err) {
      errors++;
      console.error(`  Error processing stenogram:`, err);
    }
  }

  await updateCheckpoint('stenograms', year, true, inserted, lastProcessedDate);

  console.log(`  Year ${year} complete: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);
  return { inserted, skipped, errors };
}

export async function syncAllStenograms(): Promise<{ total: number; years: number[] }> {
  console.log('Starting full stenograms sync...');
  console.log('Using dynamic rate limiting - will adapt to API responses');

  const today = new Date().toISOString().split('T')[0];
  const progress = await getProgress('stenograms');

  if (!progress) {
    await initProgress('stenograms', today, '2023-04-06');
  }

  await updateStatus('stenograms', 'running');

  const yearsCompleted: number[] = [];
  let totalInserted = 0;

  let nextYear = await getNextYearToSync('stenograms');

  while (nextYear !== null) {
    if (await isNearSizeLimit()) {
      console.log('\nSize limit reached, stopping sync');
      await updateStatus('stenograms', 'paused', 'Size limit reached');
      break;
    }

    const lastDate = await getLastSyncedDate('stenograms', nextYear);
    const { inserted } = await syncStenogramsForYear(nextYear, lastDate || undefined);
    totalInserted += inserted;
    yearsCompleted.push(nextYear);

    nextYear = await getNextYearToSync('stenograms');
  }

  if (nextYear === null) {
    await updateStatus('stenograms', 'completed');
  }

  console.log('\nStenograms sync complete:');
  console.log(`  Total inserted: ${totalInserted}`);
  console.log(`  Years completed: ${yearsCompleted.join(', ')}`);

  return { total: totalInserted, years: yearsCompleted };
}

export async function resumeStenogramsSync(): Promise<{ total: number; years: number[] }> {
  const progress = await getProgress('stenograms');

  if (!progress) {
    console.log('No previous sync found, starting fresh');
    return syncAllStenograms();
  }

  console.log(`Resuming stenograms sync from ${progress.status} state`);
  return syncAllStenograms();
}

export async function getStenogramCount(): Promise<number> {
  const collection = await getCollection<Stenogram>(COLLECTION_NAME);
  return collection.countDocuments({});
}
