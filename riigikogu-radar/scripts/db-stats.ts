#!/usr/bin/env npx tsx
/**
 * Database statistics reporting
 * Shows size, collection counts, and usage against the 512MB limit
 *
 * Usage: npx tsx scripts/db-stats.ts
 */

import 'dotenv/config';
import { closeConnection, getDbStats } from '../src/lib/data/mongodb';

const SIZE_LIMIT_MB = 512;
const WARNING_THRESHOLD = 480;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function progressBar(current: number, max: number, width: number = 40): string {
  const percentage = Math.min(current / max, 1);
  const filled = Math.round(percentage * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${(percentage * 100).toFixed(1)}%`;
}

async function main(): Promise<void> {
  try {
    console.log('=== MongoDB Atlas Database Statistics ===\n');

    const stats = await getDbStats();
    const totalMB = stats.totalSize / (1024 * 1024);
    const dataMB = stats.dataSize / (1024 * 1024);
    const indexMB = stats.indexSize / (1024 * 1024);

    // Size summary
    console.log('Storage Usage:');
    console.log(`  Data Size:    ${formatBytes(stats.dataSize).padStart(12)}`);
    console.log(`  Index Size:   ${formatBytes(stats.indexSize).padStart(12)}`);
    console.log(`  Total Size:   ${formatBytes(stats.totalSize).padStart(12)}`);
    console.log(`  Limit:        ${SIZE_LIMIT_MB} MB`);
    console.log();

    // Progress bar
    console.log('Capacity:');
    console.log(`  ${progressBar(totalMB, SIZE_LIMIT_MB)}`);
    console.log(`  ${totalMB.toFixed(2)} MB / ${SIZE_LIMIT_MB} MB used`);

    if (totalMB >= WARNING_THRESHOLD) {
      console.log('\n  ⚠️  WARNING: Approaching size limit!');
    }
    console.log();

    // Collection breakdown
    console.log('Collections:');
    console.log('  ' + '-'.repeat(60));
    console.log('  ' + 'Name'.padEnd(20) + 'Documents'.padStart(12) + 'Size'.padStart(15) + 'Avg Doc'.padStart(12));
    console.log('  ' + '-'.repeat(60));

    for (const col of stats.collections) {
      const avgDocSize = col.count > 0 ? col.size / col.count : 0;
      console.log(
        '  ' +
        col.name.padEnd(20) +
        col.count.toLocaleString().padStart(12) +
        formatBytes(col.size).padStart(15) +
        formatBytes(avgDocSize).padStart(12)
      );
    }
    console.log('  ' + '-'.repeat(60));

    // Recommendations
    console.log('\nRecommendations:');
    if (totalMB < 100) {
      console.log('  ✓ Plenty of space available for data sync');
    } else if (totalMB < 300) {
      console.log('  ✓ Good capacity, can sync more years of data');
    } else if (totalMB < WARNING_THRESHOLD) {
      console.log('  ⚡ Moderate usage, consider prioritizing core data');
    } else {
      console.log('  ⚠️  High usage, consider:');
      console.log('     - Skipping stenogram sync (largest collection)');
      console.log('     - Truncating speech text further');
      console.log('     - Removing old/unused collections');
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

main();
