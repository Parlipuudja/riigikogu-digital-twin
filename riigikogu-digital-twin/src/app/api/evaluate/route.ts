import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { VoteDecision } from '@/types';

export const dynamic = 'force-dynamic';

const MP_UUID = process.env.MP_UUID || '36a13f33-bfa9-4608-b686-4d7a4d33fdc4';

interface VoteStats {
  decision: string;
  count: string;
}

export async function GET() {
  try {
    // Get vote statistics by decision type
    const stats = await query<VoteStats>(
      `SELECT decision, COUNT(*) as count
       FROM votes
       WHERE mp_uuid = $1
       GROUP BY decision
       ORDER BY count DESC`,
      [MP_UUID]
    );

    const totalVotes = stats.reduce((sum, s) => sum + parseInt(s.count), 0);

    // Calculate distribution
    const distribution: Record<VoteDecision, { count: number; percentage: number }> = {
      FOR: { count: 0, percentage: 0 },
      AGAINST: { count: 0, percentage: 0 },
      ABSTAIN: { count: 0, percentage: 0 },
      ABSENT: { count: 0, percentage: 0 },
    };

    for (const stat of stats) {
      const decision = stat.decision as VoteDecision;
      const count = parseInt(stat.count);
      distribution[decision] = {
        count,
        percentage: totalVotes > 0 ? (count / totalVotes) * 100 : 0,
      };
    }

    // Get recent votes for sample
    const recentVotes = await query<{
      id: string;
      voting_title: string;
      decision: string;
      date: Date;
    }>(
      `SELECT id, voting_title, decision, date
       FROM votes
       WHERE mp_uuid = $1
       ORDER BY date DESC
       LIMIT 10`,
      [MP_UUID]
    );

    // Baseline accuracy (always predicting majority class)
    const majorityClass = stats.length > 0 ? stats[0].decision : 'FOR';
    const majorityCount = stats.length > 0 ? parseInt(stats[0].count) : 0;
    const baselineAccuracy = totalVotes > 0 ? (majorityCount / totalVotes) * 100 : 0;

    return NextResponse.json({
      totalVotes,
      distribution,
      baselineAccuracy,
      majorityClass,
      recentVotes: recentVotes.map(v => ({
        id: v.id,
        title: v.voting_title,
        decision: v.decision,
        date: v.date,
      })),
      // Note: Full evaluation with actual predictions would require running Claude
      // which is expensive. This endpoint provides statistics instead.
      note: 'For full prediction evaluation, use the /api/evaluate/run endpoint',
    });
  } catch (error) {
    console.error('Error in evaluation:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
