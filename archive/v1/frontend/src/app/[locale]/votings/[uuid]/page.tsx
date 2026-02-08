import { getTranslations, getLocale } from "next-intl/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PARTY_COLORS, PARTY_NAMES } from "@/types/domain";
import type { Voter } from "@/types/domain";
import { notFound } from "next/navigation";

const SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

async function getVoting(uuid: string) {
  const res = await fetch(`${SERVICE_URL}/votings/${uuid}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  return res.json();
}

function decisionBgColor(decision: string): string {
  switch (decision) {
    case "FOR":
      return "bg-green-100 text-green-800";
    case "AGAINST":
      return "bg-red-100 text-red-800";
    case "ABSTAIN":
      return "bg-amber-100 text-amber-800";
    case "ABSENT":
      return "bg-slate-100 text-slate-500";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

export default async function VotingDetailPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  const t = await getTranslations("votings");
  const locale = await getLocale();

  const voting = await getVoting(uuid);
  if (!voting) notFound();

  const title =
    locale === "en" && voting.titleEn ? voting.titleEn : voting.title;

  // Group voters by faction
  const voters: Voter[] = voting.voters || [];
  const grouped: Record<string, Voter[]> = {};
  for (const voter of voters) {
    const faction = voter.faction || "?";
    if (!grouped[faction]) grouped[faction] = [];
    grouped[faction].push(voter);
  }

  // Sort factions by count descending
  const sortedFactions = Object.entries(grouped).sort(
    (a, b) => b[1].length - a[1].length
  );

  const total =
    voting.forCount + voting.againstCount + voting.abstainCount + voting.absentCount;
  const forPct = total > 0 ? (voting.forCount / total) * 100 : 0;
  const againstPct = total > 0 ? (voting.againstCount / total) * 100 : 0;
  const abstainPct = total > 0 ? (voting.abstainCount / total) * 100 : 0;
  const absentPct = total > 0 ? (voting.absentCount / total) * 100 : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{title}</CardTitle>
              {voting.titleEn && locale !== "en" && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {voting.titleEn}
                </p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                {t("votingTime")}:{" "}
                {new Date(voting.votingTime).toLocaleDateString(
                  locale === "et" ? "et-EE" : "en-US",
                  {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}
              </p>
            </div>
            <Badge
              variant={
                voting.result === "ACCEPTED" ? "default" : "destructive"
              }
              className={
                voting.result === "ACCEPTED"
                  ? "bg-green-600 text-white shrink-0"
                  : "shrink-0"
              }
            >
              {voting.result === "ACCEPTED" ? t("accepted") : t("rejected")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Vote count summary */}
          <div className="grid grid-cols-4 gap-2 text-center text-sm mb-4">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {voting.forCount}
              </div>
              <div className="text-xs text-muted-foreground">{t("for")}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {voting.againstCount}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("against")}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">
                {voting.abstainCount}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("abstain")}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-400">
                {voting.absentCount}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("absent")}
              </div>
            </div>
          </div>

          {/* Vote bar */}
          {total > 0 && (
            <div className="flex h-4 w-full overflow-hidden rounded-full">
              {forPct > 0 && (
                <div
                  className="bg-green-500"
                  style={{ width: `${forPct}%` }}
                  title={`${t("for")}: ${voting.forCount}`}
                />
              )}
              {againstPct > 0 && (
                <div
                  className="bg-red-500"
                  style={{ width: `${againstPct}%` }}
                  title={`${t("against")}: ${voting.againstCount}`}
                />
              )}
              {abstainPct > 0 && (
                <div
                  className="bg-amber-400"
                  style={{ width: `${abstainPct}%` }}
                  title={`${t("abstain")}: ${voting.abstainCount}`}
                />
              )}
              {absentPct > 0 && (
                <div
                  className="bg-slate-300"
                  style={{ width: `${absentPct}%` }}
                  title={`${t("absent")}: ${voting.absentCount}`}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Voters by faction */}
      {voters.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-4 text-xl font-bold">{t("voters")}</h2>

          <div className="space-y-4">
            {sortedFactions.map(([faction, factionVoters]) => {
              const partyName =
                PARTY_NAMES[faction]?.[locale as "et" | "en"] || faction;
              const partyColor = PARTY_COLORS[faction] || "#999";

              // Sort voters within faction by decision, then name
              const sorted = [...factionVoters].sort((a, b) => {
                const order = { FOR: 0, AGAINST: 1, ABSTAIN: 2, ABSENT: 3 };
                const aOrder =
                  order[a.decision as keyof typeof order] ?? 4;
                const bOrder =
                  order[b.decision as keyof typeof order] ?? 4;
                if (aOrder !== bOrder) return aOrder - bOrder;
                return (a.fullName || "").localeCompare(b.fullName || "");
              });

              return (
                <Card key={faction}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: partyColor }}
                      />
                      <CardTitle className="text-base">
                        {partyName}
                      </CardTitle>
                      <span className="text-sm text-muted-foreground">
                        ({factionVoters.length})
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">
                              {locale === "et" ? "Nimi" : "Name"}
                            </th>
                            <th className="pb-2 font-medium">
                              {t("result")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map((voter, i) => (
                            <tr
                              key={`${voter.memberUuid || voter.fullName}-${i}`}
                              className="border-b last:border-0"
                            >
                              <td className="py-2 pr-4">
                                {voter.fullName || "—"}
                              </td>
                              <td className="py-2">
                                <Badge
                                  className={`${decisionBgColor(voter.decision)} border-0 text-xs`}
                                >
                                  {t(
                                    voter.decision === "FOR"
                                      ? "for"
                                      : voter.decision === "AGAINST"
                                        ? "against"
                                        : voter.decision === "ABSTAIN"
                                          ? "abstain"
                                          : "absent"
                                  )}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
