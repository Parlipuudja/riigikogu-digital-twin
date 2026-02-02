import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy for Riigikogu API photos to avoid CORS issues
 * and enable caching
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  const { uuid } = params;

  // Validate UUID format
  if (!/^[a-f0-9-]{36}$/i.test(uuid)) {
    return NextResponse.json({ error: "Invalid UUID" }, { status: 400 });
  }

  const photoUrl = `https://api.riigikogu.ee/api/files/${uuid}/download`;

  try {
    const response = await fetch(photoUrl, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: response.status }
      );
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("Photo proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch photo" },
      { status: 500 }
    );
  }
}
