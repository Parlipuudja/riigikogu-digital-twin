/**
 * Sync drafts (bills) from Riigikogu API
 * Uses dynamic rate limiting that adapts to API responses
 */

import { getCollection, getDbStats } from '../../src/lib/data/mongodb';
import { getDrafts, getDraftDetails } from '../../src/lib/sync/riigikogu-api';
import {
  updateStatus,
  initProgress,
  updateCheckpoint,
  getProgress,
  getNextYearToSync,
  getLastSyncedDate,
} from './sync-progress';
import type { Draft } from '../../src/types';

const COLLECTION_NAME = 'drafts';
const SIZE_LIMIT_MB = 480;

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

async function isNearSizeLimit(): Promise<boolean> {
  const stats = await getDbStats();
  const sizeMB = stats.totalSize / (1024 * 1024);
  return sizeMB >= SIZE_LIMIT_MB;
}

export async function syncDraftsForYear(
  year: number,
  resumeFromDate?: string
): Promise<{ inserted: number; skipped: number; errors: number }> {
  console.log(`\nSyncing drafts for ${year}...`);

  const collection = await getCollection<Draft>(COLLECTION_NAME);
  const { startDate, endDate } = getYearDateRange(year);
  const effectiveStartDate = resumeFromDate || startDate;
  console.log(`  Date range: ${effectiveStartDate} to ${endDate}`);

  const { data: draftList, error } = await fetchWithDynamicRetry(
    () => getDrafts(effectiveStartDate, endDate)
  );

  if (error || !draftList) {
    console.error('Error fetching drafts:', error);
    return { inserted: 0, skipped: 0, errors: 1 };
  }

  console.log(`  Found ${draftList.length} drafts (delay: ${(currentDelayMs / 1000).toFixed(1)}s)`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let lastProcessedDate = effectiveStartDate;

  for (let i = 0; i < draftList.length; i++) {
    const draftItem = draftList[i];

    if (i > 0 && i % 100 === 0) {
      const stats = await getDbStats();
      const sizeMB = stats.totalSize / (1024 * 1024);
      console.log(`  Size check: ${sizeMB.toFixed(2)}MB / ${SIZE_LIMIT_MB}MB`);

      if (sizeMB >= SIZE_LIMIT_MB) {
        console.log('  Size limit reached, pausing sync');
        await updateCheckpoint('drafts', year, false, inserted, lastProcessedDate);
        await updateStatus('drafts', 'paused', 'Size limit reached');
        return { inserted, skipped, errors };
      }
    }

    try {
      const existing = await collection.findOne({ uuid: draftItem.uuid });
      if (existing) {
        skipped++;
        continue;
      }

      // Build draft document handling both old and new API field names
      const draft: Draft = {
        uuid: draftItem.uuid,
        number: draftItem.number || (draftItem.mark ? String(draftItem.mark) : ''),
        title: draftItem.title,
        type: draftItem.draftType || {
          code: draftItem.draftTypeCode || 'UNKNOWN',
          value: draftItem.draftTypeCode || 'Unknown',
        },
        status: draftItem.draftStatus || {
          code: draftItem.activeDraftStatus || draftItem.proceedingStatus || 'UNKNOWN',
          value: draftItem.activeDraftStatus || draftItem.proceedingStatus || 'Unknown',
        },
        initiators: draftItem.initiators?.map(i => i.name),
        submitDate: draftItem.submitDate || draftItem.initiated,
        proceedingDate: draftItem.proceedingDate,
        syncedAt: new Date(),
      };

      await collection.insertOne(draft);
      inserted++;

      const processedDate = draftItem.submitDate || draftItem.initiated;
      if (processedDate) {
        lastProcessedDate = processedDate;
      }

      if (inserted % 20 === 0 || inserted === 1) {
        console.log(`  ${year}: ${inserted}/${draftList.length - skipped} inserted (delay: ${(currentDelayMs / 1000).toFixed(1)}s)`);
      }
    } catch (err) {
      errors++;
      console.error(`  Error processing draft:`, err);
    }
  }

  await updateCheckpoint('drafts', year, true, inserted, lastProcessedDate);

  console.log(`  Year ${year} complete: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);
  return { inserted, skipped, errors };
}

export async function syncAllDrafts(): Promise<{ total: number; years: number[] }> {
  console.log('Starting full drafts sync...');
  console.log('Using dynamic rate limiting - will adapt to API responses');

  const today = new Date().toISOString().split('T')[0];
  const progress = await getProgress('drafts');

  if (!progress) {
    await initProgress('drafts', today, '2019-04-04');
  }

  await updateStatus('drafts', 'running');

  const yearsCompleted: number[] = [];
  let totalInserted = 0;

  let nextYear = await getNextYearToSync('drafts');

  while (nextYear !== null) {
    if (await isNearSizeLimit()) {
      console.log('\nSize limit reached, stopping sync');
      await updateStatus('drafts', 'paused', 'Size limit reached');
      break;
    }

    const lastDate = await getLastSyncedDate('drafts', nextYear);
    const { inserted } = await syncDraftsForYear(nextYear, lastDate || undefined);
    totalInserted += inserted;
    yearsCompleted.push(nextYear);

    nextYear = await getNextYearToSync('drafts');
  }

  if (nextYear === null) {
    await updateStatus('drafts', 'completed');
  }

  console.log('\nDrafts sync complete:');
  console.log(`  Total inserted: ${totalInserted}`);
  console.log(`  Years completed: ${yearsCompleted.join(', ')}`);

  return { total: totalInserted, years: yearsCompleted };
}

export async function resumeDraftsSync(): Promise<{ total: number; years: number[] }> {
  const progress = await getProgress('drafts');

  if (!progress) {
    console.log('No previous sync found, starting fresh');
    return syncAllDrafts();
  }

  console.log(`Resuming drafts sync from ${progress.status} state`);
  return syncAllDrafts();
}

export async function getDraftCount(): Promise<number> {
  const collection = await getCollection<Draft>(COLLECTION_NAME);
  return collection.countDocuments({});
}
