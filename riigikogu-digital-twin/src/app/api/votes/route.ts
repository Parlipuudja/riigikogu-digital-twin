import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const MP_UUID = process.env.MP_UUID || '36a13f33-bfa9-4608-b686-4d7a4d33fdc4';

interface VoteRow {
  id: string;
  voting_id: string;
  voting_title: string;
  decision: string;
  party: string;
  date: Date;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const decision = searchParams.get('decision');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let whereClause = 'WHERE mp_uuid = $1';
    const params: unknown[] = [MP_UUID];
    let paramIndex = 2;

    if (decision && decision !== 'all') {
      whereClause += ` AND decision = $${paramIndex}`;
      params.push(decision.toUpperCase());
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND voting_title ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM votes ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0].count);

    // Get votes with pagination
    params.push(limit, offset);
    const votes = await query<VoteRow>(
      `SELECT id, voting_id, voting_title, decision, party, date
       FROM votes
       ${whereClause}
       ORDER BY date DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return NextResponse.json({
      votes: votes.map(v => ({
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
