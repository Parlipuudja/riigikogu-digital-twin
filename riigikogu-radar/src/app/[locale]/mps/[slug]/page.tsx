import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getMPBySlug } from "@/lib/data/mps";
import { PartyBadge, getPartyCode } from "@/components/data/party-badge";
import { MPPredictionForm } from "@/components/forms/mp-prediction-form";
import { PoliticalPositionChart } from "@/components/charts/political-position";
import { getPhotoProxyUrl } from "@/lib/utils/photo";

export async function generateMetadata({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}) {
  const mp = await getMPBySlug(slug);
  if (!mp) return { title: "MP Not Found" };

  const name = mp.info?.fullName || mp.slug;
  const party = mp.info?.party?.name || "";

  return {
    title: `${name} | Riigikogu Radar`,
    description: `Voting record and predictions for ${name}${party ? ` (${party})` : ""}`,
  };
}

// ISR: Revalidate every 30 minutes
export const revalidate = 1800;

export default async function MPDetailPage({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}) {
  const t = await getTranslations({ locale, namespace: "mp" });
  const tNav = await getTranslations({ locale, namespace: "nav" });

  const mp = await getMPBySlug(slug);

  if (!mp) {
    notFound();
  }

  // Extract common data from MPProfile
  const name = mp.info?.fullName || mp.slug;
  const party = mp.info?.party?.name || "";
  const partyCode = mp.info?.party?.code || "other";
  const photoUrl = getPhotoProxyUrl(mp.info?.photoUrl);
  const stats = mp.info?.votingStats;

  return (
    <div className="page-container py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-ink-500 mb-6">
        <Link href={`/${locale}/mps`} className="hover:text-rk-700">
          {tNav("mps")}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-900">{name}</span>
      </nav>

      {/* Header */}
      <header className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Photo */}
        <div className="w-32 h-40 bg-ink-100 rounded flex-shrink-0 flex items-center justify-center text-ink-400 overflow-hidden">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              className="w-full h-full object-cover object-top rounded"
              loading="lazy"
            />
          ) : (
            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          )}
        </div>

        {/* Info */}
        <div>
          <h1 className="text-3xl font-semibold mb-2">{name}</h1>
          <div className="flex items-center gap-3 mb-4">
            <PartyBadge party={party} partyCode={getPartyCode(party)} size="lg" />
          </div>

          {mp.backtest && (
            <div className="text-sm text-ink-600">
              Prediction accuracy:{" "}
              <span className="font-mono font-medium text-rk-700">
                {mp.backtest.accuracy?.overall || 0}%
              </span>
              <span className="text-ink-400 ml-1">
                (n={mp.backtest.sampleSize})
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Stats */}
        <div className="lg:col-span-2 space-y-8">
          {/* Voting Summary */}
          {stats && (
            <section className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">{t("votingSummary")}</h2>
              </div>
              <div className="card-content">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <div className="text-2xl font-mono font-bold text-ink-900">
                      {stats.total}
                    </div>
                    <div className="text-xs text-ink-500">{t("totalVotes")}</div>
                  </div>
                  <div>
                    <div className="text-2xl font-mono font-bold text-ink-900">
                      {stats.attendancePercent}%
                    </div>
                    <div className="text-xs text-ink-500">{t("card.attendance")}</div>
                  </div>
                  <div>
                    <div className="text-2xl font-mono font-bold text-vote-for">
                      {stats.distribution.FOR}
                    </div>
                    <div className="text-xs text-ink-500">FOR</div>
                  </div>
                  <div>
                    <div className="text-2xl font-mono font-bold text-vote-against">
                      {stats.distribution.AGAINST}
                    </div>
                    <div className="text-xs text-ink-500">AGAINST</div>
                  </div>
                </div>

                {/* Party loyalty bar */}
                <div className="mt-6 pt-6 border-t border-ink-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-ink-700">{t("partyLoyalty")}</span>
                    <span className="text-sm font-mono text-ink-900">
                      {stats.partyLoyaltyPercent}%
                    </span>
                  </div>
                  <div className="h-3 bg-ink-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rk-500 rounded-full"
                      style={{ width: `${stats.partyLoyaltyPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Political Position */}
          {mp.instruction?.politicalProfile && (
            <section className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">{t("politicalPosition")}</h2>
                <p className="text-xs text-ink-500 mt-1">AI-analyzed from voting patterns and speeches</p>
              </div>
              <div className="card-content">
                <PoliticalPositionChart
                  profile={mp.instruction.politicalProfile}
                  locale={locale as "et" | "en"}
                />
              </div>
            </section>
          )}

          {/* Key Issues */}
          {mp.instruction?.politicalProfile?.keyIssues && mp.instruction.politicalProfile.keyIssues.length > 0 && (
            <section className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">{t("keyIssues")}</h2>
              </div>
              <div className="card-content">
                <ul className="space-y-2">
                  {mp.instruction.politicalProfile.keyIssues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                      <span className="text-rk-500 mt-0.5">•</span>
                      {locale === "et" ? issue.issue : (issue.issueEn || issue.issue)}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>

        {/* Right column - Predict */}
        <div className="space-y-8">
          <section className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">{t("predictVote")}</h2>
            </div>
            <div className="card-content">
              {mp.instruction?.promptTemplate ? (
                <MPPredictionForm mpSlug={mp.slug} mpName={name} locale={locale} />
              ) : (
                <p className="text-sm text-ink-500">
                  Profile not yet generated. Cannot make predictions.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
