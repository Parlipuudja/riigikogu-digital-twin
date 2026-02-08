import { NextResponse } from "next/server";

const SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await fetch(`${SERVICE_URL}/simulate/${id}`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
