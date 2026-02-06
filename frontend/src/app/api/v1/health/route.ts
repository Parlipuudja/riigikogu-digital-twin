import { NextResponse } from "next/server";

const SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

export async function GET() {
  const res = await fetch(`${SERVICE_URL}/health`);
  const data = await res.json();
  return NextResponse.json(data);
}
