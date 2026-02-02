import { NextRequest, NextResponse } from "next/server";
import { getActiveMPs } from "@/lib/data/mps";

/**
 * Export MP data as CSV or JSON
 * GET /api/v1/export/mps?format=csv|json
 */
export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") || "json";

  try {
    const mps = await getActiveMPs();

    // Transform to export format
    const exportData = mps.map((mp) => ({
      slug: mp.slug,
      name: mp.info?.fullName || mp.slug,
      party: mp.info?.party?.name || "",
      partyCode: mp.info?.party?.code || "",
      totalVotes: mp.info?.votingStats?.total || 0,
      attendance: mp.info?.votingStats?.attendancePercent || 0,
      partyLoyalty: mp.info?.votingStats?.partyLoyaltyPercent || 0,
      votesFor: mp.info?.votingStats?.distribution?.FOR || 0,
      votesAgainst: mp.info?.votingStats?.distribution?.AGAINST || 0,
      votesAbstain: mp.info?.votingStats?.distribution?.ABSTAIN || 0,
      predictionAccuracy: mp.backtest?.accuracy?.overall || null,
      backtestSampleSize: mp.backtest?.sampleSize || 0,
      hasProfile: !!mp.instruction?.promptTemplate,
    }));

    if (format === "csv") {
      // Generate CSV
      const headers = Object.keys(exportData[0] || {});
      const csvRows = [
        headers.join(","),
        ...exportData.map((row) =>
          headers
            .map((h) => {
              const val = row[h as keyof typeof row];
              if (val === null) return "";
              if (typeof val === "string" && val.includes(",")) {
                return `"${val}"`;
              }
              return String(val);
            })
            .join(",")
        ),
      ];

      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="riigikogu-mps-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // Default: JSON
    return NextResponse.json({
      success: true,
      exportedAt: new Date().toISOString(),
      count: exportData.length,
      data: exportData,
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to export data" },
      { status: 500 }
    );
  }
}
