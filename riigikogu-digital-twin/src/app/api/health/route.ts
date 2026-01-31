import { NextResponse } from 'next/server';
import { healthCheck } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const isHealthy = await healthCheck();

    return NextResponse.json({
      status: isHealthy ? 'ok' : 'error',
      mongodb: isHealthy,
      env: {
        hasMongoUri: !!process.env.MONGODB_URI,
        hasVoyageKey: !!process.env.VOYAGE_API_KEY,
        hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
