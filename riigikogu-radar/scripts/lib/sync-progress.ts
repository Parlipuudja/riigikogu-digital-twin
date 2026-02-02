/**
 * Sync progress tracking utilities
 * Manages checkpoint state for resumable syncing
 */

import { getCollection } from '../../src/lib/data/mongodb';
import type { SyncProgress, SyncCheckpoint, SyncStatus } from '../../src/types';

const COLLECTION_NAME = 'sync_progress';

type SyncType = 'votings' | 'drafts' | 'stenograms' | 'members';

/**
 * Get progress for a specific sync type
 */
export async function getProgress(type: SyncType): Promise<SyncProgress | null> {
  const collection = await getCollection<SyncProgress>(COLLECTION_NAME);
  return collection.findOne({ _id: type });
}

/**
 * Initialize or reset progress for a sync type
 */
export async function initProgress(
  type: SyncType,
  latestDate: string,
  earliestDate: string
): Promise<SyncProgress> {
  const collection = await getCollection<SyncProgress>(COLLECTION_NAME);

  const progress: SyncProgress = {
    _id: type,
    earliestDate,
    latestDate,
    totalRecords: 0,
    status: 'idle',
    lastRunAt: new Date(),
    checkpoints: [],
  };

  await collection.replaceOne({ _id: type }, progress, { upsert: true });
  return progress;
}

/**
 * Update progress status
 */
export async function updateStatus(type: SyncType, status: SyncStatus, error?: string): Promise<void> {
  const collection = await getCollection<SyncProgress>(COLLECTION_NAME);

  const update: Partial<SyncProgress> = {
    status,
    lastRunAt: new Date(),
  };

  if (error !== undefined) {
    update.error = error;
  }

  await collection.updateOne({ _id: type }, { $set: update });
}

/**
 * Add or update a year checkpoint
 */
export async function updateCheckpoint(
  type: SyncType,
  year: number,
  completed: boolean,
  recordCount: number,
  lastDate?: string
): Promise<void> {
  const collection = await getCollection<SyncProgress>(COLLECTION_NAME);

  const progress = await getProgress(type);
  if (!progress) {
    throw new Error(`No progress record for ${type}`);
  }

  // Find existing checkpoint or create new one
  const existingIdx = progress.checkpoints.findIndex(c => c.year === year);
  const checkpoint: SyncCheckpoint = {
    year,
    completed,
    recordCount,
    lastDate,
  };

  if (existingIdx >= 0) {
    progress.checkpoints[existingIdx] = checkpoint;
  } else {
    progress.checkpoints.push(checkpoint);
  }

  // Sort by year descending
  progress.checkpoints.sort((a, b) => b.year - a.year);

  // Update total records
  const totalRecords = progress.checkpoints.reduce((sum, c) => sum + c.recordCount, 0);

  await collection.updateOne(
    { _id: type },
    {
      $set: {
        checkpoints: progress.checkpoints,
        totalRecords,
        lastRunAt: new Date(),
      },
    }
  );
}

/**
 * Get the next year that needs syncing
 * Returns null if all years are completed
 */
export async function getNextYearToSync(type: SyncType): Promise<number | null> {
  const progress = await getProgress(type);
  if (!progress) {
    return null;
  }

  // Find the earliest year we want to sync to (XV Riigikogu started April 2023)
  const earliestYear = new Date(progress.earliestDate).getFullYear();
  const latestYear = new Date(progress.latestDate).getFullYear();

  // Check each year from latest to earliest
  for (let year = latestYear; year >= earliestYear; year--) {
    const checkpoint = progress.checkpoints.find(c => c.year === year);
    if (!checkpoint || !checkpoint.completed) {
      return year;
    }
  }

  return null;
}

/**
 * Get the last date synced for a given year
 * Used for resuming partial year syncs
 */
export async function getLastSyncedDate(type: SyncType, year: number): Promise<string | null> {
  const progress = await getProgress(type);
  if (!progress) {
    return null;
  }

  const checkpoint = progress.checkpoints.find(c => c.year === year);
  return checkpoint?.lastDate || null;
}

/**
 * Get all progress records
 */
export async function getAllProgress(): Promise<SyncProgress[]> {
  const collection = await getCollection<SyncProgress>(COLLECTION_NAME);
  return collection.find({}).toArray();
}

/**
 * Clear all progress (use with caution)
 */
export async function clearProgress(type?: SyncType): Promise<void> {
  const collection = await getCollection<SyncProgress>(COLLECTION_NAME);
  if (type) {
    await collection.deleteOne({ _id: type });
  } else {
    await collection.deleteMany({});
  }
}
