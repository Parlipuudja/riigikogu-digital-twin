import { NextResponse } from "next/server";
import { getMPBySlug } from "@/lib/data/mps";
import type { ApiResponse, MPDetailResponse } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const mp = await getMPBySlug(params.slug);

    if (!mp) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `MP with slug "${params.slug}" not found`,
          },
          meta: {
            requestId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        },
        { status: 404 }
      );
    }

    const response: ApiResponse<MPDetailResponse> = {
      success: true,
      data: {
        mp,
        // TODO: Add recent votes
      },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching MP:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch MP",
        },
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
