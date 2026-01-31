import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import type { VoteDecision } from '@/types';

export const dynamic = 'force-dynamic';

const MP_UUID = process.env.MP_UUID || '36a13f33-bfa9-4608-b686-4d7a4d33fdc4';

interface VoteDocument {
  id: string;
  voting_title: string;
  decision: string;
  date: Date | string;
  mp_uuid: string;
}

interface VoteStats {
  _id: string;
  count: number;
}

export async function GET() {
  try {
    const collection = await getCollection<VoteDocument>('votes');

    // Get vote statistics by decision type using aggregation
    const stats = await collection
      .aggregate<VoteStats>([
        { $match: { mp_uuid: MP_UUID } },
        { $group: { _id: '$decision', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    const totalVotes = stats.reduce((sum, s) => sum + s.count, 0);

    // Calculate distribution
    const distribution: Record<VoteDecision, { count: number; percentage: number }> = {
      FOR: { count: 0, percentage: 0 },
      AGAINST: { count: 0, percentage: 0 },
      ABSTAIN: { count: 0, percentage: 0 },
      ABSENT: { count: 0, percentage: 0 },
    };

    for (const stat of stats) {
      const decision = stat._id as VoteDecision;
      if (decision in distribution) {
        distribution[decision] = {
          count: stat.count,
          percentage: totalVotes > 0 ? (stat.count / totalVotes) * 100 : 0,
        };
      }
    }

    // Get recent votes for sample
    const recentVotes = await collection
      .find({ mp_uuid: MP_UUID })
      .sort({ date: -1 })
      .limit(10)
      .toArray();

    // Baseline accuracy (always predicting majority class)
    const majorityClass = stats.length > 0 ? stats[0]._id : 'FOR';
    const majorityCount = stats.length > 0 ? stats[0].count : 0;
    const baselineAccuracy = totalVotes > 0 ? (majorityCount / totalVotes) * 100 : 0;

    return NextResponse.json({
      totalVotes,
      distribution,
      baselineAccuracy,
      majorityClass,
      recentVotes: recentVotes.map((v) => ({
        id: v.id,
        title: v.voting_title,
        decision: v.decision,
        date: v.date,
      })),
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
