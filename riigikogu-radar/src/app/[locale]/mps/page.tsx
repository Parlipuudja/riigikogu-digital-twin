import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getActiveMPs } from "@/lib/data/mps";
import { PartyBadge, getPartyCode } from "@/components/data/party-badge";
import { getPhotoProxyUrl } from "@/lib/utils/photo";
import { normalizeVotingStats, type VotingStatsLegacy } from "@/lib/utils/api-response";
import type { MPProfile } from "@/types";

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: "mps" });
  return {
    title: `${t("title")} | Riigikogu Radar`,
  };
}

// ISR: Revalidate every 30 minutes
export const revalidate = 1800;

export default async function MPsPage({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: "mps" });
  const mps = await getActiveMPs();

  // Group by party
  const byParty = mps.reduce((acc, mp) => {
    const partyName = mp.info?.party?.name || "Unknown";
    if (!acc[partyName]) acc[partyName] = [];
    acc[partyName].push(mp);
    return acc;
  }, {} as Record<string, MPProfile[]>);

  const parties = Object.keys(byParty).sort();

  return (
    <div className="page-container py-8">
      <h1 className="mb-8">{t("title")}</h1>

      {/* Stats summary */}
      <div className="card mb-8">
        <div className="card-content">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-3xl font-mono font-bold text-rk-700">{mps.length}</div>
              <div className="text-sm text-ink-500">{t("stats.totalMPs")}</div>
            </div>
            <div>
              <div className="text-3xl font-mono font-bold text-rk-700">{parties.length}</div>
              <div className="text-sm text-ink-500">{t("stats.parties")}</div>
            </div>
            <div>
              <div className="text-3xl font-mono font-bold text-vote-for">
                {mps.filter(m => m.instruction).length}
              </div>
              <div className="text-sm text-ink-500">{t("stats.withProfiles")}</div>
            </div>
            <div>
              <div className="text-3xl font-mono font-bold text-ink-400">
                {mps.filter(m => !m.instruction).length}
              </div>
              <div className="text-sm text-ink-500">{t("stats.pending")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* MPs by party */}
      {parties.map((partyName) => (
        <section key={partyName} className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <PartyBadge party={partyName} partyCode={getPartyCode(partyName)} size="lg" />
            <span className="text-sm text-ink-500">({byParty[partyName].length} MPs)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {byParty[partyName]
              .sort((a, b) => (a.info?.fullName || a.slug).localeCompare(b.info?.fullName || b.slug))
              .map((mp) => {
                const name = mp.info?.fullName || mp.slug;
                const photoUrl = getPhotoProxyUrl(mp.info?.photoUrl);
                const stats = normalizeVotingStats(mp.info?.votingStats as VotingStatsLegacy | undefined);
                const accuracy = mp.backtest?.accuracy?.overall;

                return (
                  <Link
                    key={mp.slug}
                    href={`/${locale}/mps/${mp.slug}`}
                    className="card hover:shadow-dropdown transition-shadow"
                  >
                    <div className="card-content">
                      <div className="flex items-start gap-4">
                        {/* Photo */}
                        <div className="w-16 h-20 bg-ink-100 rounded flex-shrink-0 flex items-center justify-center text-ink-400 overflow-hidden">
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={name}
                              className="w-full h-full object-cover object-top rounded"
                              loading="lazy"
                            />
                          ) : (
                            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-medium text-ink-900 truncate">
                            {name}
                          </h3>

                          {/* Prediction accuracy badge */}
                          {accuracy !== undefined && (
                            <div className="mt-1 inline-flex items-center gap-1 text-xs bg-rk-50 text-rk-700 px-2 py-0.5 rounded">
                              <span className="font-mono font-medium">{accuracy}%</span>
                              <span className="text-rk-500">{t("card.accuracy")}</span>
                            </div>
                          )}

                          {stats && (
                            <div className="mt-2 space-y-1 text-xs text-ink-500">
                              <div className="flex justify-between">
                                <span>{t("card.votes")}:</span>
                                <span className="font-mono">{stats.totalVotes}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>{t("card.attendance")}:</span>
                                <span className="font-mono">{Math.round(stats.attendance)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>{t("card.partyLoyalty")}:</span>
                                <span className="font-mono">{Math.round(stats.partyAlignmentRate)}%</span>
                              </div>
                            </div>
                          )}

                          {!mp.instruction && (
                            <div className="mt-2 text-xs text-ink-400 italic">
                              {t("profilePending")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
          </div>
        </section>
      ))}

      {mps.length === 0 && (
        <div className="card">
          <div className="card-content text-center py-12">
            <p className="text-ink-500">{t("noMPsFound")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
