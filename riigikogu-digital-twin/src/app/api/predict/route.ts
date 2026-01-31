import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { makePrediction } from '@/lib/prediction';

export const dynamic = 'force-dynamic';

const PredictionRequestSchema = z.object({
  billTitle: z.string().min(1, 'Bill title is required'),
  billDescription: z.string().min(1, 'Bill description is required'),
  billFullText: z.string().optional(),
  category: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validationResult = PredictionRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const predictionRequest = validationResult.data;

    // Make prediction
    const prediction = await makePrediction(predictionRequest);

    return NextResponse.json(prediction);
  } catch (error) {
    console.error('Prediction error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
