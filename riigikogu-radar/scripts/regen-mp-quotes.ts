#!/usr/bin/env npx tsx
/**
 * Regenerate MP profiles with direct speech quotes
 * Usage: npx tsx scripts/regen-mp-quotes.ts [slug]
 *   - With slug: Regenerate specific MP
 *   - Without: Regenerate all active MPs
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
}

async function regenerateMP(mp: MPProfile) {
  console.log(`\nRegenerating ${mp.info?.fullName || mp.slug}...`);

  if (!mp.info?.fullName || !mp.info?.party) {
    console.log(`  - Skipping: missing basic info`);
    return { success: false, reason: "missing info" };
  }

  try {
    // Collect data
    const data = await collectMPData(mp.uuid);
    console.log(`  - ${data.votes.length} votes, ${data.speeches.length} speeches`);

    if (data.speeches.length === 0) {
      console.log(`  - Skipping: no speech data`);
      return { success: false, reason: "no speeches" };
    }

    // Build member details from existing info
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

    // Generate instruction with quotes
    const result = await generateMPInstruction(memberDetails, data);

    // Check for quotes
    const quotesFound = result.instruction.politicalProfile.keyIssues.filter(
      (i) => i.quote
    ).length;
    console.log(`  - ${quotesFound}/${result.instruction.politicalProfile.keyIssues.length} key issues have quotes`);

    // Update database
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
  const slug = process.argv[2];
  const mpsCol = await getCollection<MPProfile>("mps");

  if (slug) {
    // Regenerate specific MP
    const mp = await mpsCol.findOne({ slug });
    if (!mp) {
      console.error(`MP not found: ${slug}`);
      process.exit(1);
    }
    await regenerateMP(mp);
  } else {
    // Regenerate all active MPs
    const mps = await mpsCol.find({ status: "active" }).toArray();
    console.log(`Regenerating ${mps.length} active MPs...`);

    let success = 0;
    let failed = 0;
    let totalQuotes = 0;

    for (const mp of mps) {
      const result = await regenerateMP(mp);
      if (result.success) {
        success++;
        totalQuotes += result.quotesFound || 0;
      } else {
        failed++;
      }

      // Rate limit to avoid API issues
      await new Promise((r) => setTimeout(r, 1000));
    }

    console.log(`\nDone! ${success} succeeded, ${failed} failed, ${totalQuotes} total quotes added`);
  }

  await closeConnection();
}

main().catch(console.error);
