import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/data/mongodb";

interface Voting {
  uuid: string;
  title: string;
  votingTime: string;
  result: string;
  voters: Array<{
    memberUuid: string;
    fullName: string;
    faction: string;
    decision: string;
  }>;
}

/**
 * Export voting records as CSV or JSON
 * GET /api/v1/export/votings?format=csv|json&limit=100
 */
export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") || "json";
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "100"), 500);

  try {
    const collection = await getCollection<Voting>("votings");
    const votings = await collection
      .find({})
      .sort({ votingTime: -1 })
      .limit(limit)
      .toArray();

    // Transform to flat export format
    const exportData = votings.flatMap((voting) =>
      voting.voters.map((voter) => ({
        votingUuid: voting.uuid,
        votingTitle: voting.title,
        votingDate: voting.votingTime?.split("T")[0] || "",
        votingResult: voting.result,
        mpName: voter.fullName,
        mpFaction: voter.faction,
        decision: voter.decision,
      }))
    );

    if (format === "csv") {
      const headers = ["votingUuid", "votingTitle", "votingDate", "votingResult", "mpName", "mpFaction", "decision"];
      const csvRows = [
        headers.join(","),
        ...exportData.map((row) =>
          headers
            .map((h) => {
              const val = row[h as keyof typeof row] || "";
              if (typeof val === "string" && (val.includes(",") || val.includes('"'))) {
                return `"${val.replace(/"/g, '""')}"`;
              }
              return val;
            })
            .join(",")
        ),
      ];

      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="riigikogu-votings-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      exportedAt: new Date().toISOString(),
      votingsCount: votings.length,
      recordsCount: exportData.length,
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
