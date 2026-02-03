#!/usr/bin/env npx tsx
/**
 * Fix party loyalty calculation for all MPs
 *
 * This script recalculates party loyalty from actual voting data
 * without regenerating the full AI instruction.
 */

import { config } from "dotenv";
config({ path: ".env" });

import { getCollection, closeConnection } from "../src/lib/data/mongodb";

interface Voter {
  memberUuid: string;
  fullName: string;
  faction: string;
  decision: string;
}

interface Voting {
  uuid: string;
  title: string;
  votingTime: string;
  voters: Voter[];
}

interface MPProfile {
  uuid: string;
  slug: string;
  status: string;
  info?: {
    fullName?: string;
    party?: { code: string; name: string };
    votingStats?: {
      total: number;
      distribution: { FOR: number; AGAINST: number; ABSTAIN: number; ABSENT: number };
      partyLoyaltyPercent: number;
      attendancePercent: number;
    };
  };
}

async function calculatePartyLoyalty(mpUuid: string): Promise<{
  loyalty: number;
  totalVotes: number;
  votesWithParty: number;
  totalWithPartyData: number;
}> {
  const votingsCollection = await getCollection<Voting>("votings");

  // Get all votings where this MP voted
  const votingDocs = await votingsCollection.find({
    "voters.memberUuid": mpUuid
  }).toArray();

  let totalVotesWithPartyData = 0;
  let votesWithParty = 0;

  for (const voting of votingDocs) {
    // Find the MP's vote
    const mpVote = voting.voters.find(v => v.memberUuid === mpUuid);
    if (!mpVote || mpVote.decision === "ABSENT" || !mpVote.faction) continue;

    // Calculate party majority for this vote
    const partyVotes: Record<string, { for: number; against: number; abstain: number }> = {};

    for (const voter of voting.voters) {
      if (voter.decision === "ABSENT" || !voter.faction) continue;

      if (!partyVotes[voter.faction]) {
        partyVotes[voter.faction] = { for: 0, against: 0, abstain: 0 };
      }

      if (voter.decision === "FOR") partyVotes[voter.faction].for++;
      else if (voter.decision === "AGAINST") partyVotes[voter.faction].against++;
      else if (voter.decision === "ABSTAIN") partyVotes[voter.faction].abstain++;
    }

    // Determine party majority for MP's party
    const mpPartyStats = partyVotes[mpVote.faction];
    if (!mpPartyStats) continue;

    const maxVotes = Math.max(mpPartyStats.for, mpPartyStats.against, mpPartyStats.abstain);
    let partyMajority: string;
    if (maxVotes === mpPartyStats.for) partyMajority = "FOR";
    else if (maxVotes === mpPartyStats.against) partyMajority = "AGAINST";
    else partyMajority = "ABSTAIN";

    // Check if MP voted with party
    totalVotesWithPartyData++;
    if (mpVote.decision === partyMajority) {
      votesWithParty++;
    }
  }

  const loyalty = totalVotesWithPartyData > 0
    ? Math.floor((votesWithParty / totalVotesWithPartyData) * 100)
    : 0;

  return {
    loyalty,
    totalVotes: votingDocs.length,
    votesWithParty,
    totalWithPartyData: totalVotesWithPartyData,
  };
}

async function main() {
  console.log("Fixing party loyalty for all MPs...\n");

  const mpsCollection = await getCollection<MPProfile>("mps");
  const mps = await mpsCollection.find({ status: "active" }).toArray();

  console.log(`Found ${mps.length} active MPs\n`);

  let updated = 0;
  let errors = 0;

  for (const mp of mps) {
    try {
      const { loyalty, totalVotes, votesWithParty, totalWithPartyData } = await calculatePartyLoyalty(mp.uuid);

      const currentLoyalty = mp.info?.votingStats?.partyLoyaltyPercent;
      const changed = currentLoyalty !== loyalty;

      if (changed) {
        // Update the MP's party loyalty
        await mpsCollection.updateOne(
          { uuid: mp.uuid },
          {
            $set: {
              "info.votingStats.partyLoyaltyPercent": loyalty,
              updatedAt: new Date()
            }
          }
        );
        updated++;
        console.log(`✓ ${mp.info?.fullName || mp.slug}: ${currentLoyalty}% → ${loyalty}% (${votesWithParty}/${totalWithPartyData} votes with party)`);
      } else {
        console.log(`- ${mp.info?.fullName || mp.slug}: ${loyalty}% (unchanged)`);
      }
    } catch (error) {
      errors++;
      console.error(`✗ ${mp.info?.fullName || mp.slug}: Error - ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`\nDone! Updated ${updated} MPs, ${errors} errors.`);
  await closeConnection();
}

main().catch(console.error);
