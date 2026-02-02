#!/usr/bin/env npx tsx
/**
 * Main sync orchestrator for Riigikogu API data
 *
 * Usage:
 *   npx tsx scripts/sync-api.ts [command] [options]
 *
 * Commands:
 *   all        - Sync all data types (members, votings, drafts, stenograms)
 *   members    - Sync parliament members only
 *   votings    - Sync votings with all voters
 *   drafts     - Sync drafts/bills
 *   stenograms - Sync parliamentary speeches
 *   status     - Show sync progress status
 *   resume     - Resume from last checkpoint
 *
 * Options:
 *   --year=YYYY  - Sync only a specific year
 *   --reset      - Reset progress and start fresh
 */

import 'dotenv/config';
import { closeConnection, getDbStats } from '../src/lib/data/mongodb';
import { syncMembers, getMemberCount } from './lib/sync-members';
import { syncAllVotings, resumeVotingsSync, syncVotingsForYear, getVotingCount } from './lib/sync-votings';
import { syncAllDrafts, resumeDraftsSync, syncDraftsForYear, getDraftCount } from './lib/sync-drafts';
import { syncAllStenograms, resumeStenogramsSync, syncStenogramsForYear, getStenogramCount } from './lib/sync-stenograms';
import { getAllProgress, clearProgress } from './lib/sync-progress';

const SIZE_LIMIT_MB = 480;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function showStatus(): Promise<void> {
  console.log('=== Riigikogu API Sync Status ===\n');

  // Database stats
  const stats = await getDbStats();
  console.log('Database Size:');
  console.log(`  Data:    ${formatBytes(stats.dataSize)}`);
  console.log(`  Indexes: ${formatBytes(stats.indexSize)}`);
  console.log(`  Total:   ${formatBytes(stats.totalSize)} / ${SIZE_LIMIT_MB} MB`);
  console.log(`  Usage:   ${((stats.totalSize / (SIZE_LIMIT_MB * 1024 * 1024)) * 100).toFixed(1)}%\n`);

  // Collection stats
  console.log('Collections:');
  for (const col of stats.collections) {
    console.log(`  ${col.name.padEnd(15)} ${col.count.toString().padStart(6)} docs  ${formatBytes(col.size).padStart(10)}`);
  }

  // Record counts
  console.log('\nRecord Counts:');
  console.log(`  Members:    ${await getMemberCount()}`);
  console.log(`  Votings:    ${await getVotingCount()}`);
  console.log(`  Drafts:     ${await getDraftCount()}`);
  console.log(`  Stenograms: ${await getStenogramCount()}`);

  // Sync progress
  const progress = await getAllProgress();
  if (progress.length > 0) {
    console.log('\nSync Progress:');
    for (const p of progress) {
      console.log(`  ${p._id}:`);
      console.log(`    Status: ${p.status}`);
      console.log(`    Total:  ${p.totalRecords} records`);
      console.log(`    Range:  ${p.earliestDate} to ${p.latestDate}`);
      if (p.checkpoints.length > 0) {
        const checkpointInfo = p.checkpoints
          .map(c => `${c.year}:${c.completed ? 'done' : 'partial'}(${c.recordCount})`)
          .join(', ');
        console.log(`    Years:  ${checkpointInfo}`);
      }
      if (p.error) {
        console.log(`    Error:  ${p.error}`);
      }
    }
  }
}

async function syncAll(year?: number): Promise<void> {
  console.log('=== Starting Full API Sync ===\n');

  // Check initial size
  const initialStats = await getDbStats();
  const initialSizeMB = initialStats.totalSize / (1024 * 1024);
  console.log(`Initial DB size: ${initialSizeMB.toFixed(2)} MB\n`);

  if (initialSizeMB >= SIZE_LIMIT_MB) {
    console.error('Database is already at size limit!');
    return;
  }

  // 1. Sync members first (small, required for everything)
  console.log('Step 1: Syncing members...');
  await syncMembers();

  // Check size
  let stats = await getDbStats();
  if (stats.totalSize / (1024 * 1024) >= SIZE_LIMIT_MB) {
    console.log('Size limit reached after members sync');
    return;
  }

  // 2. Sync votings (core prediction data)
  console.log('\nStep 2: Syncing votings...');
  if (year) {
    await syncVotingsForYear(year);
  } else {
    await syncAllVotings();
  }

  stats = await getDbStats();
  if (stats.totalSize / (1024 * 1024) >= SIZE_LIMIT_MB) {
    console.log('Size limit reached after votings sync');
    return;
  }

  // 3. Sync drafts (bill context)
  console.log('\nStep 3: Syncing drafts...');
  if (year) {
    await syncDraftsForYear(year);
  } else {
    await syncAllDrafts();
  }

  stats = await getDbStats();
  if (stats.totalSize / (1024 * 1024) >= SIZE_LIMIT_MB) {
    console.log('Size limit reached after drafts sync');
    return;
  }

  // 4. Sync stenograms (largest, last priority)
  console.log('\nStep 4: Syncing stenograms...');
  if (year) {
    await syncStenogramsForYear(year);
  } else {
    await syncAllStenograms();
  }

  // Final status
  console.log('\n=== Sync Complete ===');
  await showStatus();
}

async function resumeSync(): Promise<void> {
  console.log('=== Resuming Sync ===\n');

  // Resume each type that's not completed
  const progress = await getAllProgress();

  for (const p of progress) {
    if (p.status !== 'completed') {
      console.log(`Resuming ${p._id} sync...`);
      switch (p._id) {
        case 'members':
          await syncMembers();
          break;
        case 'votings':
          await resumeVotingsSync();
          break;
        case 'drafts':
          await resumeDraftsSync();
          break;
        case 'stenograms':
          await resumeStenogramsSync();
          break;
      }
    }
  }

  console.log('\n=== Resume Complete ===');
  await showStatus();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  // Parse options
  let year: number | undefined;
  let reset = false;

  for (const arg of args) {
    if (arg.startsWith('--year=')) {
      year = parseInt(arg.split('=')[1], 10);
    }
    if (arg === '--reset') {
      reset = true;
    }
  }

  try {
    // Handle reset flag
    if (reset) {
      console.log('Resetting sync progress...');
      await clearProgress();
    }

    switch (command) {
      case 'all':
        await syncAll(year);
        break;

      case 'members':
        await syncMembers();
        break;

      case 'votings':
        if (year) {
          await syncVotingsForYear(year);
        } else {
          await syncAllVotings();
        }
        break;

      case 'drafts':
        if (year) {
          await syncDraftsForYear(year);
        } else {
          await syncAllDrafts();
        }
        break;

      case 'stenograms':
        if (year) {
          await syncStenogramsForYear(year);
        } else {
          await syncAllStenograms();
        }
        break;

      case 'status':
        await showStatus();
        break;

      case 'resume':
        await resumeSync();
        break;

      default:
        console.log('Unknown command:', command);
        console.log('\nUsage: npx tsx scripts/sync-api.ts [command] [options]');
        console.log('\nCommands: all, members, votings, drafts, stenograms, status, resume');
        console.log('\nOptions:');
        console.log('  --year=YYYY  Sync only a specific year');
        console.log('  --reset      Reset progress and start fresh');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

main();
