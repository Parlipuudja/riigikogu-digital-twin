import { NextResponse } from "next/server";
import { getActiveMPs } from "@/lib/data/mps";
import { getCollection } from "@/lib/data/mongodb";

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

    // Get recent votings for analysis
    const recentVotings = await votingsCollection
      .find({})
      .sort({ votingTime: -1 })
      .limit(50)
      .toArray();

    // Insight 1: Low party loyalty MPs (potential swing votes)
    const swingVotes = mps
      .filter((mp) => {
        const loyalty = mp.info?.votingStats?.partyLoyaltyPercent || 100;
        return loyalty < 80 && mp.info?.votingStats?.total && mp.info.votingStats.total > 50;
      })
      .map((mp) => ({
        name: mp.info?.fullName || mp.slug,
        party: mp.info?.party?.name || "",
        partyLoyalty: mp.info?.votingStats?.partyLoyaltyPercent || 0,
        totalVotes: mp.info?.votingStats?.total || 0,
        slug: mp.slug,
      }))
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

    // Insight 4: Party voting patterns
    const partyStats = new Map<string, { total: number; for: number; against: number; abstain: number }>();
    for (const mp of mps) {
      const party = mp.info?.party?.name || "Unknown";
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
