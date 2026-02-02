import { getTranslations } from "next-intl/server";
import Link from "next/link";

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: "insights" });
  return {
    title: `${t("title")} | Riigikogu Radar`,
    description: t("subtitle"),
  };
}

// Revalidate every 5 minutes for fresh insights
export const revalidate = 300;

interface InsightData {
  swingVotes: { title: string; description: string; data: Array<{ name: string; party: string; partyLoyalty: number; slug: string }> };
  predictableMPs: { title: string; description: string; data: Array<{ name: string; party: string; accuracy: number; sampleSize: number; slug: string }> };
  unpredictableMPs: { title: string; description: string; data: Array<{ name: string; party: string; accuracy: number; sampleSize: number; slug: string }> };
  lowAttendance: { title: string; description: string; data: Array<{ name: string; party: string; attendance: number; slug: string }> };
  partyBreakdown: { title: string; description: string; data: Array<{ party: string; forPercent: number; againstPercent: number; totalVotes: number }> };
  closeVotes: { title: string; description: string; data: Array<{ title: string; date: string; forVotes: number; againstVotes: number; margin: number }> };
  partyRebels: { title: string; description: string; data: Array<{ name: string; party: string; slug: string; voteTitle: string; voteDate: string; mpDecision: string; partyMajority: string }> };
  crossPartyAlliances: { title: string; description: string; data: Array<{ mp1: { name: string; party: string; slug: string }; mp2: { name: string; party: string; slug: string }; agreementPercent: number; sharedVotes: number }> };
}

async function getInsights(): Promise<InsightData | null> {
  try {
    // Use absolute URL for server-side fetch
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/v1/insights`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.insights;
  } catch {
    return null;
  }
}

export default async function InsightsPage({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: "insights" });
  const insights = await getInsights();

  if (!insights) {
    return (
      <div className="page-container py-8">
        <h1 className="mb-4">{t("title")}</h1>
        <p className="text-ink-500">{t("failedToLoad")}</p>
      </div>
    );
  }

  return (
    <div className="page-container py-8">
      <div className="mb-8">
        <h1 className="mb-2">{t("title")}</h1>
        <p className="text-ink-500">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Party Rebels - Hot story lead */}
        {insights.partyRebels.data.length > 0 && (
          <div className="card lg:col-span-2 border-l-4 border-l-vote-against">
            <div className="card-header">
              <h2 className="card-title">{t("partyRebels.title")}</h2>
              <p className="text-sm text-ink-500">{t("partyRebels.description")}</p>
            </div>
            <div className="card-content">
              <div className="space-y-3">
                {insights.partyRebels.data.map((rebel, i) => (
                  <div key={i} className="flex items-start justify-between p-3 bg-paper-100 rounded-lg">
                    <div>
                      <Link href={`/${locale}/mps/${rebel.slug}`} className="font-medium hover:text-rk-600">
                        {rebel.name}
                      </Link>
                      <span className="text-ink-500 text-sm ml-2">({rebel.party})</span>
                      <p className="text-sm text-ink-600 mt-1">
                        {t("partyRebels.voted")} <span className={rebel.mpDecision === "FOR" ? "text-vote-for font-medium" : "text-vote-against font-medium"}>{rebel.mpDecision}</span> {t("partyRebels.whilePartyVoted")} {rebel.partyMajority}
                      </p>
                      <p className="text-xs text-ink-400 mt-1">{rebel.voteTitle} • {rebel.voteDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Cross-Party Alliances */}
        {insights.crossPartyAlliances.data.length > 0 && (
          <div className="card border-l-4 border-l-rk-500">
            <div className="card-header">
              <h2 className="card-title">{t("crossPartyAlliances.title")}</h2>
              <p className="text-sm text-ink-500">{t("crossPartyAlliances.description")}</p>
            </div>
            <div className="card-content">
              <div className="space-y-3">
                {insights.crossPartyAlliances.data.slice(0, 5).map((alliance, i) => (
                  <div key={i} className="p-3 bg-paper-100 rounded-lg">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/${locale}/mps/${alliance.mp1.slug}`} className="font-medium hover:text-rk-600">
                        {alliance.mp1.name}
                      </Link>
                      <span className="text-ink-400">×</span>
                      <Link href={`/${locale}/mps/${alliance.mp2.slug}`} className="font-medium hover:text-rk-600">
                        {alliance.mp2.name}
                      </Link>
                    </div>
                    <p className="text-sm text-ink-500 mt-1">
                      <span className="text-rk-600 font-mono font-bold">{alliance.agreementPercent}%</span> {t("agreement")} • {alliance.sharedVotes} {t("votes")}
                    </p>
                    <p className="text-xs text-ink-400">{alliance.mp1.party} + {alliance.mp2.party}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Close/Controversial Votes */}
        {insights.closeVotes.data.length > 0 && (
          <div className="card border-l-4 border-l-vote-abstain">
            <div className="card-header">
              <h2 className="card-title">{t("closeVotes.title")}</h2>
              <p className="text-sm text-ink-500">{t("closeVotes.description")}</p>
            </div>
            <div className="card-content">
              <div className="space-y-2">
                {insights.closeVotes.data.slice(0, 6).map((vote, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-paper-100 rounded">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{vote.title}</p>
                      <p className="text-xs text-ink-400">{vote.date}</p>
                    </div>
                    <div className="text-right ml-4">
                      <span className="text-vote-for font-mono">{vote.forVotes}</span>
                      <span className="text-ink-400 mx-1">-</span>
                      <span className="text-vote-against font-mono">{vote.againstVotes}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Unpredictable MPs */}
        {insights.unpredictableMPs.data.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">{t("unpredictableMPs.title")}</h2>
              <p className="text-sm text-ink-500">{t("unpredictableMPs.description")}</p>
            </div>
            <div className="card-content">
              <div className="space-y-2">
                {insights.unpredictableMPs.data.slice(0, 6).map((mp, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-paper-100 rounded">
                    <div>
                      <Link href={`/${locale}/mps/${mp.slug}`} className="font-medium hover:text-rk-600">
                        {mp.name}
                      </Link>
                      <span className="text-ink-400 text-sm ml-2">{mp.party}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-vote-against">{mp.accuracy}%</span>
                      <span className="text-ink-400 text-xs ml-1">{t("accuracy")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Predictable MPs */}
        {insights.predictableMPs.data.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">{t("predictableMPs.title")}</h2>
              <p className="text-sm text-ink-500">{t("predictableMPs.description")}</p>
            </div>
            <div className="card-content">
              <div className="space-y-2">
                {insights.predictableMPs.data.slice(0, 6).map((mp, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-paper-100 rounded">
                    <div>
                      <Link href={`/${locale}/mps/${mp.slug}`} className="font-medium hover:text-rk-600">
                        {mp.name}
                      </Link>
                      <span className="text-ink-400 text-sm ml-2">{mp.party}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-vote-for">{mp.accuracy}%</span>
                      <span className="text-ink-400 text-xs ml-1">{t("accuracy")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Low Attendance */}
        {insights.lowAttendance.data.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">{t("lowAttendance.title")}</h2>
              <p className="text-sm text-ink-500">{t("lowAttendance.description")}</p>
            </div>
            <div className="card-content">
              <div className="space-y-2">
                {insights.lowAttendance.data.slice(0, 6).map((mp, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-paper-100 rounded">
                    <div>
                      <Link href={`/${locale}/mps/${mp.slug}`} className="font-medium hover:text-rk-600">
                        {mp.name}
                      </Link>
                      <span className="text-ink-400 text-sm ml-2">{mp.party}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-vote-against">{mp.attendance}%</span>
                      <span className="text-ink-400 text-xs ml-1">{t("attendance")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Party Breakdown */}
        {insights.partyBreakdown.data.length > 0 && (
          <div className="card lg:col-span-2">
            <div className="card-header">
              <h2 className="card-title">{t("partyBreakdown.title")}</h2>
              <p className="text-sm text-ink-500">{t("partyBreakdown.description")}</p>
            </div>
            <div className="card-content">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {insights.partyBreakdown.data.map((party, i) => (
                  <div key={i} className="p-3 bg-paper-100 rounded-lg">
                    <p className="font-medium mb-2">{party.party}</p>
                    <div className="flex gap-4 text-sm">
                      <span><span className="text-vote-for font-mono">{party.forPercent}%</span> {t("votes")}</span>
                      <span><span className="text-vote-against font-mono">{party.againstPercent}%</span> {t("votes")}</span>
                    </div>
                    <p className="text-xs text-ink-400 mt-1">{party.totalVotes.toLocaleString()} {t("totalVotes")}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export section */}
      <div className="mt-8 p-4 bg-paper-100 rounded-lg">
        <h3 className="font-medium mb-2">{t("exportData")}</h3>
        <div className="flex gap-4">
          <a href="/api/v1/export/mps?format=csv" className="btn btn-secondary text-sm">
            {t("exportMPs")}
          </a>
          <a href="/api/v1/export/votings?format=csv&limit=500" className="btn btn-secondary text-sm">
            {t("exportVotings")}
          </a>
          <a href="/api/v1/insights" target="_blank" className="btn btn-secondary text-sm">
            {t("rawJsonApi")}
          </a>
        </div>
      </div>
    </div>
  );
}
