import { NextRequest, NextResponse } from "next/server";

const SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slug, bill } = body;

  const res = await fetch(`${SERVICE_URL}/predict/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bill),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
