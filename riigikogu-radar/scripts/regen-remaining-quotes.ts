#!/usr/bin/env npx tsx
/**
 * Continue regenerating MP quotes from where we left off
 * Skips MPs that already have quotes
 */

import { config } from "dotenv";
config({ path: ".env" });

import { getCollection, closeConnection } from "../src/lib/data/mongodb";
import { generateMPInstruction, collectMPData } from "../src/lib/ai/instruction-generator";
import type { MPParty } from "../src/types";

interface MPProfile {
  uuid: string;
  slug: string;
  status: string;
  info?: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    party?: MPParty;
    photoUrl?: string | null;
    committees?: { name: string; role: string }[];
  };
  instruction?: {
    politicalProfile?: {
      keyIssues?: { quote?: string }[];
    };
  };
}

// Timeout helper
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${message}`)), ms)
    ),
  ]);
}

async function regenerateMP(mp: MPProfile) {
  console.log(`\nRegenerating ${mp.info?.fullName || mp.slug}...`);

  if (!mp.info?.fullName || !mp.info?.party) {
    console.log(`  - Skipping: missing basic info`);
    return { success: false, reason: "missing info" };
  }

  try {
    const data = await collectMPData(mp.uuid);
    console.log(`  - ${data.votes.length} votes, ${data.speeches.length} speeches`);

    if (data.speeches.length === 0) {
      console.log(`  - Skipping: no speech data`);
      return { success: false, reason: "no speeches" };
    }

    // Skip MPs with too many speeches (would timeout)
    if (data.speeches.length > 1500) {
      console.log(`  - Skipping: too many speeches (${data.speeches.length})`);
      return { success: false, reason: "too many speeches" };
    }

    const names = mp.info.fullName.split(" ");
    const memberDetails = {
      uuid: mp.uuid,
      firstName: mp.info.firstName || names[0] || "",
      lastName: mp.info.lastName || names.slice(1).join(" ") || "",
      fullName: mp.info.fullName,
      party: mp.info.party,
      photoUrl: mp.info.photoUrl || null,
      committees: mp.info.committees || [],
      previousTerms: [] as number[],
    };

    // Add 3-minute timeout for AI generation
    const result = await withTimeout(
      generateMPInstruction(memberDetails, data),
      180000,
      `generating quotes for ${mp.info.fullName}`
    );

    const quotesFound = result.instruction.politicalProfile.keyIssues.filter(
      (i) => i.quote
    ).length;
    console.log(`  - ${quotesFound}/${result.instruction.politicalProfile.keyIssues.length} key issues have quotes`);

    const mpsCol = await getCollection("mps");
    await mpsCol.updateOne(
      { uuid: mp.uuid },
      {
        $set: {
          info: result.info,
          instruction: result.instruction,
          updatedAt: new Date(),
        },
      }
    );

    console.log(`  - Saved`);
    return { success: true, quotesFound };
  } catch (error) {
    console.error(`  - Error: ${error instanceof Error ? error.message : error}`);
    return { success: false, reason: String(error) };
  }
}

async function main() {
  const mpsCol = await getCollection<MPProfile>("mps");

  // Find MPs without quotes (keyIssues without quote field or empty quotes)
  const allMps = await mpsCol
    .find({ status: "active" })
    .sort({ "info.fullName": 1 })
    .toArray();

  const mpsNeedingQuotes = allMps.filter((mp) => {
    const keyIssues = mp.instruction?.politicalProfile?.keyIssues || [];
    // Check if any keyIssue has a quote object with an excerpt
    const hasQuotes = keyIssues.some((i: any) => i.quote?.excerpt && i.quote.excerpt.length > 0);
    return !hasQuotes;
  });

  console.log(`Found ${mpsNeedingQuotes.length} MPs without quotes (skipping ${allMps.length - mpsNeedingQuotes.length} already done)\n`);

  let success = 0;
  let failed = 0;

  for (const mp of mpsNeedingQuotes) {
    const result = await regenerateMP(mp);
    if (result.success) {
      success++;
    } else {
      failed++;
    }
  }

  console.log(`\nComplete: ${success} success, ${failed} failed`);
  await closeConnection();
}

main().catch(console.error);
