#!/usr/bin/env npx tsx
/**
 * Download and extract full text from draft/bill documents
 *
 * This script:
 * 1. Fetches detailed draft info including file links
 * 2. Downloads TXT, DOCX, and PDF files
 * 3. Extracts text content
 * 4. Stores full text in the drafts collection
 *
 * Usage:
 *   npx tsx scripts/sync-draft-texts.ts
 *   npx tsx scripts/sync-draft-texts.ts --limit=50
 */

import 'dotenv/config';
import { getCollection, closeConnection } from '../src/lib/data/mongodb';
import type { Draft } from '../src/types';

// Dynamic imports for file parsing
let PDFParse: typeof import('pdf-parse').PDFParse;
let mammoth: typeof import('mammoth');

async function loadParsers() {
  const pdfModule = await import('pdf-parse');
  PDFParse = pdfModule.PDFParse;
  mammoth = await import('mammoth');
}

const BASE_URL = 'https://api.riigikogu.ee/api';

// Rate limiting
let currentDelayMs = 1000;
const MIN_DELAY_MS = 500;
const MAX_DELAY_MS = 30000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function onRateLimit(): void {
  currentDelayMs = Math.min(MAX_DELAY_MS, currentDelayMs * 2);
  console.log(`  Rate limited - delay increased to ${(currentDelayMs / 1000).toFixed(1)}s`);
}

function onSuccess(): void {
  currentDelayMs = Math.max(MIN_DELAY_MS, currentDelayMs * 0.9);
}

interface DraftFile {
  uuid: string;
  fileName: string;
  fileExtension: string;
  fileTitle: string;
  downloadUrl: string;
}

interface DraftDetails {
  uuid: string;
  title: string;
  introduction?: string;
  texts: {
    readingCode: string;
    file?: {
      uuid: string;
      fileName: string;
      fileExtension: string;
      fileTitle: string;
      _links?: {
        download?: { href: string };
      };
    };
  }[];
  readings?: {
    readingCode: string;
    votings?: { uuid: string }[];
  }[];
}

async function fetchWithRetry<T>(url: string): Promise<T | null> {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await sleep(currentDelayMs);

    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (response.status === 429) {
        onRateLimit();
        continue;
      }

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}`);
      }

      onSuccess();
      return await response.json();
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error(`  Failed after ${maxRetries} attempts:`, error);
        return null;
      }
      onRateLimit();
    }
  }

  return null;
}

async function downloadFile(url: string): Promise<Buffer | null> {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await sleep(currentDelayMs);

    try {
      const response = await fetch(url);

      if (response.status === 429) {
        onRateLimit();
        continue;
      }

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}`);
      }

      onSuccess();
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error(`  Download failed:`, error);
        return null;
      }
      onRateLimit();
    }
  }

  return null;
}

async function extractTextFromFile(buffer: Buffer, extension: string): Promise<string | null> {
  try {
    const ext = extension.toLowerCase();

    if (ext === 'txt') {
      return buffer.toString('utf-8');
    }

    if (ext === 'docx') {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    if (ext === 'pdf') {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return result.text;
    }

    // Skip unsupported formats
    return null;
  } catch (error) {
    console.error(`  Error extracting text from ${extension}:`, error);
    return null;
  }
}

function getRelevantFiles(details: DraftDetails): DraftFile[] {
  const files: DraftFile[] = [];
  const seenUuids = new Set<string>();

  // Priority order: txt > docx > pdf
  const priorityExtensions = ['txt', 'docx', 'pdf'];

  for (const text of details.texts || []) {
    const file = text.file;
    if (!file || !file._links?.download?.href) continue;
    if (seenUuids.has(file.uuid)) continue;

    const ext = file.fileExtension?.toLowerCase() || '';
    if (!priorityExtensions.includes(ext)) continue;

    seenUuids.add(file.uuid);
    files.push({
      uuid: file.uuid,
      fileName: file.fileName,
      fileExtension: ext,
      fileTitle: file.fileTitle,
      downloadUrl: file._links.download.href,
    });
  }

  // Sort by priority (txt first, then docx, then pdf)
  files.sort((a, b) => {
    return priorityExtensions.indexOf(a.fileExtension) - priorityExtensions.indexOf(b.fileExtension);
  });

  return files;
}

function extractVotingUuids(details: DraftDetails): string[] {
  const votingUuids: string[] = [];

  for (const reading of details.readings || []) {
    for (const voting of reading.votings || []) {
      if (voting.uuid) {
        votingUuids.push(voting.uuid);
      }
    }
  }

  return votingUuids;
}

async function processDraft(draft: Draft): Promise<{
  fullText: string | null;
  votingUuids: string[];
  fileSource: string | null;
}> {
  // Fetch detailed draft info
  const details = await fetchWithRetry<DraftDetails>(
    `${BASE_URL}/volumes/drafts/${draft.uuid}?lang=et`
  );

  if (!details) {
    return { fullText: null, votingUuids: [], fileSource: null };
  }

  // Extract voting UUIDs
  const votingUuids = extractVotingUuids(details);

  // Get downloadable files
  const files = getRelevantFiles(details);

  if (files.length === 0) {
    // Use introduction if available
    if (details.introduction) {
      return {
        fullText: details.introduction,
        votingUuids,
        fileSource: 'introduction'
      };
    }
    return { fullText: null, votingUuids, fileSource: null };
  }

  // Try to download and extract text from first available file
  for (const file of files.slice(0, 2)) { // Try up to 2 files
    console.log(`    Downloading ${file.fileName}...`);
    const buffer = await downloadFile(file.downloadUrl);

    if (!buffer) continue;

    const text = await extractTextFromFile(buffer, file.fileExtension);
    if (text && text.trim().length > 100) {
      return {
        fullText: text.trim(),
        votingUuids,
        fileSource: file.fileName
      };
    }
  }

  // Fallback to introduction
  if (details.introduction) {
    return {
      fullText: details.introduction,
      votingUuids,
      fileSource: 'introduction'
    };
  }

  return { fullText: null, votingUuids, fileSource: null };
}

// Extended Draft type with full text
interface DraftWithText extends Draft {
  fullText?: string;
  fullTextSource?: string;
  relatedVotingUuids?: string[];
}

async function main() {
  const args = process.argv.slice(2);
  let limit = 0;

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.slice(8), 10);
    }
  }

  console.log('=== Draft Text Extraction ===\n');
  console.log('Loading parsers...');
  await loadParsers();

  const collection = await getCollection<DraftWithText>('drafts');

  // Find drafts without full text
  const query: Record<string, unknown> = {
    $or: [
      { fullText: { $exists: false } },
      { fullText: null },
      { fullText: '' },
    ],
  };

  let cursor = collection.find(query).sort({ submitDate: -1 });
  if (limit > 0) {
    cursor = cursor.limit(limit);
  }

  const drafts = await cursor.toArray();
  console.log(`Found ${drafts.length} drafts needing text extraction\n`);

  if (drafts.length === 0) {
    console.log('All drafts already have full text!');
    await closeConnection();
    return;
  }

  let processed = 0;
  let extracted = 0;
  let failed = 0;

  for (const draft of drafts) {
    processed++;
    console.log(`[${processed}/${drafts.length}] ${draft.title.substring(0, 60)}...`);

    try {
      const result = await processDraft(draft);

      const update: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (result.fullText) {
        update.fullText = result.fullText.substring(0, 50000); // Cap at 50KB
        update.fullTextSource = result.fileSource;
        extracted++;
        console.log(`    ✓ Extracted ${result.fullText.length} chars from ${result.fileSource}`);
      } else {
        update.fullText = null;
        failed++;
        console.log(`    ✗ No text found`);
      }

      if (result.votingUuids.length > 0) {
        update.relatedVotingUuids = result.votingUuids;
        console.log(`    + ${result.votingUuids.length} related votings`);
      }

      await collection.updateOne({ uuid: draft.uuid }, { $set: update });

    } catch (error) {
      console.error(`    Error:`, error);
      failed++;
    }

    // Progress update every 20 drafts
    if (processed % 20 === 0) {
      console.log(`\n--- Progress: ${processed}/${drafts.length} (${extracted} extracted, ${failed} failed) ---\n`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total processed: ${processed}`);
  console.log(`Text extracted: ${extracted}`);
  console.log(`Failed/no text: ${failed}`);

  await closeConnection();
}

main().catch(error => {
  console.error('Fatal error:', error);
  closeConnection().finally(() => process.exit(1));
});
