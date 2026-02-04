import { NextResponse } from "next/server";
import { getActiveMPs } from "@/lib/data/mps";
import { getCollection } from "@/lib/data/mongodb";

// Revalidate every 5 minutes (300 seconds)
export const revalidate = 300;
export const dynamic = "force-dynamic";

// Current government coalition parties (as of XV Riigikogu)
// High agreement between these is expected, not newsworthy
const COALITION_PARTIES = new Set(["RE", "E200", "SDE"]);

function areCoalitionPartners(partyCode1: string | undefined, partyCode2: string | undefined): boolean {
  if (!partyCode1 || !partyCode2) return false;
  return COALITION_PARTIES.has(partyCode1) && COALITION_PARTIES.has(partyCode2);
}

interface Voting {
  uuid: string;
  title: string;
  votingTime: string;
  voters: Array<{
    memberUuid: string;
    fullName: string;
    faction: string;
    decision: string;
  }>;
}

/**
 * Get insights and story leads for journalists
 * Identifies unusual voting patterns, swing votes, and notable MPs
 * GET /api/v1/insights
 */
export async function GET() {
  try {
    const mps = await getActiveMPs();
    const votingsCollection = await getCollection<Voting>("votings");

    // Get recent votings for analysis (100 votings for better loyalty calculation)
    const recentVotings = await votingsCollection
      .find({})
      .sort({ votingTime: -1 })
      .limit(100)
      .toArray();

    // Calculate actual party loyalty for each MP from voting data
    // Party loyalty = how often an MP votes with their party's majority
    const mpPartyLoyalty = new Map<string, { withParty: number; total: number; party: string }>();

    for (const voting of recentVotings) {
      // First, calculate party majorities for this vote
      const partyVotes = new Map<string, { for: number; against: number; abstain: number }>();
      for (const voter of voting.voters) {
        if (voter.decision === "ABSENT") continue;
        const party = voter.faction || "Unknown";
        const stats = partyVotes.get(party) || { for: 0, against: 0, abstain: 0 };
        if (voter.decision === "FOR") stats.for++;
        else if (voter.decision === "AGAINST") stats.against++;
        else if (voter.decision === "ABSTAIN") stats.abstain++;
        partyVotes.set(party, stats);
      }

      // Determine party majority decision
      const partyMajorities = new Map<string, string>();
      const partyVotesEntries = Array.from(partyVotes.entries());
      for (const [party, stats] of partyVotesEntries) {
        const maxVotes = Math.max(stats.for, stats.against, stats.abstain);
        if (maxVotes === stats.for) partyMajorities.set(party, "FOR");
        else if (maxVotes === stats.against) partyMajorities.set(party, "AGAINST");
        else partyMajorities.set(party, "ABSTAIN");
      }

      // Now check each voter against their party majority
      for (const voter of voting.voters) {
        if (voter.decision === "ABSENT") continue;
        const party = voter.faction || "Unknown";
        const partyMajority = partyMajorities.get(party);
        if (!partyMajority) continue;

        const current = mpPartyLoyalty.get(voter.memberUuid) || { withParty: 0, total: 0, party };
        current.total++;
        if (voter.decision === partyMajority) {
          current.withParty++;
        }
        mpPartyLoyalty.set(voter.memberUuid, current);
      }
    }

    // Insight 1: Low party loyalty MPs (potential swing votes)
    // Calculate from actual voting data
    // In Estonian parliament, party discipline is high, so we use 90% as threshold
    const swingVotes = mps
      .filter((mp) => {
        const loyalty = mpPartyLoyalty.get(mp.uuid);
        if (!loyalty || loyalty.total < 20) return false; // Need enough votes
        const loyaltyPercent = Math.round((loyalty.withParty / loyalty.total) * 100);
        return loyaltyPercent < 92; // Below 92% party loyalty (high bar for Estonian parliament)
      })
      .map((mp) => {
        const loyalty = mpPartyLoyalty.get(mp.uuid)!;
        return {
          name: mp.info?.fullName || mp.slug,
          party: mp.info?.party?.name || loyalty.party || "",
          partyLoyalty: Math.round((loyalty.withParty / loyalty.total) * 100),
          totalVotes: loyalty.total,
          slug: mp.slug,
        };
      })
      .sort((a, b) => a.partyLoyalty - b.partyLoyalty)
      .slice(0, 10);

    // Insight 2: High prediction accuracy MPs (most predictable)
    const predictableMPs = mps
      .filter((mp) => mp.backtest?.accuracy?.overall && mp.backtest.sampleSize > 50)
      .map((mp) => ({
        name: mp.info?.fullName || mp.slug,
        party: mp.info?.party?.name || "",
        accuracy: mp.backtest?.accuracy?.overall || 0,
        sampleSize: mp.backtest?.sampleSize || 0,
        slug: mp.slug,
      }))
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 10);

    // Insight 3: Low attendance MPs
    const lowAttendance = mps
      .filter((mp) => {
        const attendance = mp.info?.votingStats?.attendancePercent || 100;
        return attendance < 70 && mp.info?.votingStats?.total && mp.info.votingStats.total > 20;
      })
      .map((mp) => ({
        name: mp.info?.fullName || mp.slug,
        party: mp.info?.party?.name || "",
        attendance: mp.info?.votingStats?.attendancePercent || 0,
        totalVotes: mp.info?.votingStats?.total || 0,
        slug: mp.slug,
      }))
      .sort((a, b) => a.attendance - b.attendance)
      .slice(0, 10);

    // Insight 4: Party voting patterns (excluding non-affiliated MPs who aren't a party)
    const NON_PARTY_NAMES = ["Fraktsioonitud", "Non-affiliated", "Unknown"];
    const partyStats = new Map<string, { total: number; for: number; against: number; abstain: number }>();
    for (const mp of mps) {
      const party = mp.info?.party?.name || "Unknown";
      // Skip non-affiliated MPs in party breakdown - they're individuals, not a party
      if (NON_PARTY_NAMES.some(name => party.toLowerCase() === name.toLowerCase())) {
        continue;
      }
      const stats = partyStats.get(party) || { total: 0, for: 0, against: 0, abstain: 0 };
      const dist = mp.info?.votingStats?.distribution;
      if (dist) {
        stats.total += mp.info?.votingStats?.total || 0;
        stats.for += dist.FOR || 0;
        stats.against += dist.AGAINST || 0;
        stats.abstain += dist.ABSTAIN || 0;
      }
      partyStats.set(party, stats);
    }

    const partyBreakdown = Array.from(partyStats.entries())
      .filter(([, stats]) => stats.total > 0)
      .map(([party, stats]) => ({
        party,
        totalVotes: stats.total,
        forPercent: Math.round((stats.for / stats.total) * 100),
        againstPercent: Math.round((stats.against / stats.total) * 100),
        abstainPercent: Math.round((stats.abstain / stats.total) * 100),
      }))
      .sort((a, b) => b.totalVotes - a.totalVotes);

    // Insight 5: Close/controversial votes (high opposition)
    const closeVotes = recentVotings
      .filter((v) => {
        const votes = v.voters.filter((voter) => voter.decision !== "ABSENT");
        const forVotes = votes.filter((voter) => voter.decision === "FOR").length;
        const againstVotes = votes.filter((voter) => voter.decision === "AGAINST").length;
        const total = forVotes + againstVotes;
        if (total < 50) return false;
        const ratio = Math.min(forVotes, againstVotes) / total;
        return ratio > 0.3; // At least 30% opposition
      })
      .map((v) => {
        const votes = v.voters.filter((voter) => voter.decision !== "ABSENT");
        const forVotes = votes.filter((voter) => voter.decision === "FOR").length;
        const againstVotes = votes.filter((voter) => voter.decision === "AGAINST").length;
        return {
          title: v.title,
          date: v.votingTime?.split("T")[0] || "",
          forVotes,
          againstVotes,
          margin: Math.abs(forVotes - againstVotes),
        };
      })
      .sort((a, b) => a.margin - b.margin)
      .slice(0, 10);

    // Insight 6: Party rebels - MPs who recently voted against their party majority
    const partyRebels: Array<{
      name: string;
      party: string;
      slug: string;
      voteTitle: string;
      voteDate: string;
      mpDecision: string;
      partyMajority: string;
    }> = [];

    for (const voting of recentVotings.slice(0, 20)) {
      // Calculate party majorities for this vote
      const partyVotes = new Map<string, { for: number; against: number }>();
      for (const voter of voting.voters) {
        if (voter.decision === "ABSENT" || voter.decision === "ABSTAIN") continue;
        const party = voter.faction || "Unknown";
        const stats = partyVotes.get(party) || { for: 0, against: 0 };
        if (voter.decision === "FOR") stats.for++;
        else if (voter.decision === "AGAINST") stats.against++;
        partyVotes.set(party, stats);
      }

      // Find rebels (voted opposite to party majority)
      for (const voter of voting.voters) {
        if (voter.decision === "ABSENT" || voter.decision === "ABSTAIN") continue;
        const party = voter.faction || "Unknown";
        const stats = partyVotes.get(party);
        if (!stats) continue;

        const partyMajority = stats.for > stats.against ? "FOR" : "AGAINST";
        const majorityStrength = Math.max(stats.for, stats.against) / (stats.for + stats.against);

        // Rebel if voted opposite AND party had clear majority (>60%)
        if (voter.decision !== partyMajority && majorityStrength > 0.6) {
          const mp = mps.find((m) => m.uuid === voter.memberUuid);
          if (mp) {
            partyRebels.push({
              name: mp.info?.fullName || voter.fullName,
              party,
              slug: mp.slug,
              voteTitle: voting.title,
              voteDate: voting.votingTime?.split("T")[0] || "",
              mpDecision: voter.decision,
              partyMajority,
            });
          }
        }
      }
    }

    // Deduplicate rebels (keep most recent instance per MP)
    const uniqueRebels = Array.from(
      partyRebels.reduce((map, rebel) => {
        if (!map.has(rebel.slug)) map.set(rebel.slug, rebel);
        return map;
      }, new Map<string, typeof partyRebels[0]>())
    ).map(([, rebel]) => rebel).slice(0, 10);

    // Insight 7: Cross-party voting blocs - MPs from different parties who vote together
    const mpVotePatterns = new Map<string, Map<string, string>>();
    for (const voting of recentVotings.slice(0, 30)) {
      for (const voter of voting.voters) {
        if (voter.decision === "ABSENT") continue;
        if (!mpVotePatterns.has(voter.memberUuid)) {
          mpVotePatterns.set(voter.memberUuid, new Map());
        }
        mpVotePatterns.get(voter.memberUuid)!.set(voting.uuid, voter.decision);
      }
    }

    // Calculate voting similarity between MPs of different parties
    const crossPartyAlliances: Array<{
      mp1: { name: string; party: string; slug: string };
      mp2: { name: string; party: string; slug: string };
      agreementPercent: number;
      sharedVotes: number;
    }> = [];

    const mpList = mps.filter((mp) => mpVotePatterns.has(mp.uuid));
    for (let i = 0; i < mpList.length; i++) {
      for (let j = i + 1; j < mpList.length; j++) {
        const mp1 = mpList[i];
        const mp2 = mpList[j];
        // Only compare MPs from different parties
        if (mp1.info?.party?.code === mp2.info?.party?.code) continue;
        // Skip coalition partners - high agreement is expected, not newsworthy
        if (areCoalitionPartners(mp1.info?.party?.code, mp2.info?.party?.code)) continue;

        const votes1 = mpVotePatterns.get(mp1.uuid)!;
        const votes2 = mpVotePatterns.get(mp2.uuid)!;

        let agreements = 0;
        let sharedVotes = 0;
        const votes1Entries = Array.from(votes1.entries());
        for (const [voteId, decision1] of votes1Entries) {
          const decision2 = votes2.get(voteId);
          if (decision2 && decision1 !== "ABSTAIN" && decision2 !== "ABSTAIN") {
            sharedVotes++;
            if (decision1 === decision2) agreements++;
          }
        }

        if (sharedVotes >= 10 && agreements / sharedVotes >= 0.8) {
          crossPartyAlliances.push({
            mp1: { name: mp1.info?.fullName || mp1.slug, party: mp1.info?.party?.name || "", slug: mp1.slug },
            mp2: { name: mp2.info?.fullName || mp2.slug, party: mp2.info?.party?.name || "", slug: mp2.slug },
            agreementPercent: Math.round((agreements / sharedVotes) * 100),
            sharedVotes,
          });
        }
      }
    }

    crossPartyAlliances.sort((a, b) => b.agreementPercent - a.agreementPercent);
    const topAlliances = crossPartyAlliances.slice(0, 10);

    // Insight 8: Unpredictable MPs (low backtest accuracy - hardest to predict)
    const unpredictableMPs = mps
      .filter((mp) => mp.backtest?.accuracy?.overall != null && mp.backtest.sampleSize > 30)
      .map((mp) => ({
        name: mp.info?.fullName || mp.slug,
        party: mp.info?.party?.name || "",
        accuracy: mp.backtest?.accuracy?.overall || 0,
        sampleSize: mp.backtest?.sampleSize || 0,
        slug: mp.slug,
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      insights: {
        swingVotes: {
          title: "Potential Swing Voters",
          description: "MPs with lowest party loyalty - may vote unpredictably",
          data: swingVotes,
        },
        predictableMPs: {
          title: "Most Predictable MPs",
          description: "MPs with highest prediction accuracy based on backtesting",
          data: predictableMPs,
        },
        lowAttendance: {
          title: "Low Attendance MPs",
          description: "MPs with attendance below 70%",
          data: lowAttendance,
        },
        partyBreakdown: {
          title: "Party Voting Patterns",
          description: "Aggregate voting breakdown by party",
          data: partyBreakdown,
        },
        closeVotes: {
          title: "Close/Controversial Votes",
          description: "Recent votes with significant opposition (>30%)",
          data: closeVotes,
        },
        partyRebels: {
          title: "Party Rebels",
          description: "MPs who recently voted against their party's clear majority",
          data: uniqueRebels,
        },
        crossPartyAlliances: {
          title: "Cross-Party Voting Blocs",
          description: "MPs from different parties who vote together >80% (excluding coalition partners)",
          data: topAlliances,
        },
        unpredictableMPs: {
          title: "Most Unpredictable MPs",
          description: "MPs with lowest prediction accuracy - hardest to forecast",
          data: unpredictableMPs,
        },
      },
    });
  } catch (error) {
    console.error("Insights error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate insights" },
      { status: 500 }
    );
  }
}
