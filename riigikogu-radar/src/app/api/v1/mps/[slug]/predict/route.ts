import { NextResponse } from "next/server";
import { getMPBySlug } from "@/lib/data/mps";
import { predictMPVote } from "@/lib/prediction";
import { PredictRequestSchema } from "@/lib/utils/validation";
import type { ApiResponse, MPPredictResponse } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for prediction

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const requestId = crypto.randomUUID();

  try {
    // Get MP
    const mp = await getMPBySlug(params.slug);

    if (!mp) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `MP with slug "${params.slug}" not found`,
          },
          meta: { requestId, timestamp: new Date().toISOString() },
        },
        { status: 404 }
      );
    }

    // Check MP has instruction template
    if (!mp.instruction?.promptTemplate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `MP "${mp.info?.fullName || mp.slug}" does not have a generated profile yet`,
          },
          meta: { requestId, timestamp: new Date().toISOString() },
        },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = PredictRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.flatten(),
          },
          meta: { requestId, timestamp: new Date().toISOString() },
        },
        { status: 400 }
      );
    }

    // Run prediction
    const result = await predictMPVote(mp, {
      billTitle: validation.data.billTitle,
      billDescription: validation.data.billDescription,
      billFullText: validation.data.billFullText,
    });

    const response: ApiResponse<MPPredictResponse & { ragContext: typeof result.ragContext }> = {
      success: true,
      data: {
        prediction: result.prediction,
        ragContext: result.ragContext,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Prediction error:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PREDICTION_FAILED",
          message: error instanceof Error ? error.message : "Prediction failed",
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      },
      { status: 500 }
    );
  }
}
