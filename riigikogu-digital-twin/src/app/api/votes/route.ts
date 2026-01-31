import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

const MP_UUID = process.env.MP_UUID || '36a13f33-bfa9-4608-b686-4d7a4d33fdc4';

interface VoteDocument {
  id: string;
  voting_id: string;
  voting_title: string;
  decision: string;
  party: string;
  date: Date | string;
  mp_uuid: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const decision = searchParams.get('decision');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const collection = await getCollection<VoteDocument>('votes');

    // Build filter
    const filter: Record<string, unknown> = { mp_uuid: MP_UUID };

    if (decision && decision !== 'all') {
      filter.decision = decision.toUpperCase();
    }

    if (search) {
      filter.voting_title = { $regex: search, $options: 'i' };
    }

    // Get total count
    const total = await collection.countDocuments(filter);

    // Get votes with pagination
    const votes = await collection
      .find(filter)
      .sort({ date: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      votes: votes.map((v) => ({
        id: v.id,
        votingId: v.voting_id,
        title: v.voting_title,
        decision: v.decision,
        party: v.party,
        date: v.date,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching votes:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
