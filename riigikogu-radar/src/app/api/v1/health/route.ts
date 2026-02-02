import { NextResponse } from "next/server";
import { healthCheck } from "@/lib/data/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbHealthy = await healthCheck();

  const status = dbHealthy ? "healthy" : "degraded";

  return NextResponse.json({
    success: true,
    data: {
      status,
      database: dbHealthy,
      timestamp: new Date().toISOString(),
    },
    meta: {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
}
