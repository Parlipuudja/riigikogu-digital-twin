#!/usr/bin/env npx tsx
/**
 * Fix MPs with 100% party loyalty that was incorrectly rounded up
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
  voters: Voter[];
}

interface MPProfile {
  uuid: string;
  slug: string;
  info?: {
    fullName?: string;
    votingStats?: {
      partyLoyaltyPercent: number;
    };
  };
}

async function main() {
  const votingsCol = await getCollection<Voting>("votings");
  const mpsCol = await getCollection<MPProfile>("mps");

  // Find MPs with 100% loyalty
  const mps = await mpsCol.find({
    status: "active",
    "info.votingStats.partyLoyaltyPercent": 100
  }).toArray();

  console.log(`Checking ${mps.length} MPs with 100% loyalty...\n`);

  let fixed = 0;

  for (const mp of mps) {
    const votings = await votingsCol.find({ "voters.memberUuid": mp.uuid }).toArray();

    let totalWithPartyData = 0;
    let votesWithParty = 0;

    for (const voting of votings) {
      const mpVote = voting.voters.find(v => v.memberUuid === mp.uuid);
      if (!mpVote || mpVote.decision === "ABSENT" || !mpVote.faction) continue;

      const partyVotes: Record<string, { for: number; against: number; abstain: number }> = {};
      for (const voter of voting.voters) {
        if (voter.decision === "ABSENT" || !voter.faction) continue;
        if (!partyVotes[voter.faction]) partyVotes[voter.faction] = { for: 0, against: 0, abstain: 0 };
        if (voter.decision === "FOR") partyVotes[voter.faction].for++;
        else if (voter.decision === "AGAINST") partyVotes[voter.faction].against++;
        else if (voter.decision === "ABSTAIN") partyVotes[voter.faction].abstain++;
      }

      const mpPartyStats = partyVotes[mpVote.faction];
      if (!mpPartyStats) continue;

      const maxVotes = Math.max(mpPartyStats.for, mpPartyStats.against, mpPartyStats.abstain);
      let partyMajority: string;
      if (maxVotes === mpPartyStats.for) partyMajority = "FOR";
      else if (maxVotes === mpPartyStats.against) partyMajority = "AGAINST";
      else partyMajority = "ABSTAIN";

      totalWithPartyData++;
      if (mpVote.decision === partyMajority) votesWithParty++;
    }

    // Use Math.floor - never round up
    const correctLoyalty = totalWithPartyData > 0 ? Math.floor((votesWithParty / totalWithPartyData) * 100) : 0;

    if (correctLoyalty !== 100) {
      await mpsCol.updateOne({ uuid: mp.uuid }, { $set: { "info.votingStats.partyLoyaltyPercent": correctLoyalty } });
      console.log(`Fixed: ${mp.info?.fullName || mp.slug}: 100% → ${correctLoyalty}% (${votesWithParty}/${totalWithPartyData})`);
      fixed++;
    } else {
      console.log(`OK: ${mp.info?.fullName || mp.slug} is truly 100% (${votesWithParty}/${totalWithPartyData})`);
    }
  }

  console.log(`\nDone! Fixed ${fixed} MPs.`);
  await closeConnection();
}

main().catch(console.error);
