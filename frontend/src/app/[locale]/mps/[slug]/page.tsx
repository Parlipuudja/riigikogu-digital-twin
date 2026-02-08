import { getTranslations, getLocale } from "next-intl/server";
import Image from "next/image";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PARTY_COLORS, PARTY_NAMES } from "@/types/domain";
import { notFound } from "next/navigation";

export default async function MPDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("mps");
  const locale = await getLocale();

  let mp;
  try {
    mp = await api.mp(slug);
  } catch {
    notFound();
  }

  const partyName =
    PARTY_NAMES[mp.partyCode]?.[locale as "et" | "en"] || mp.partyCode;
  const partyColor = PARTY_COLORS[mp.partyCode] || "#999";
  const profile =
    locale === "en" && mp.politicalProfileEn
      ? mp.politicalProfileEn
      : mp.politicalProfile;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-full bg-muted">
          {mp.photoUrl ? (
            <Image
              src={mp.photoUrl}
              alt={`${mp.firstName} ${mp.lastName}`}
              fill
              className="object-cover"
              sizes="128px"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-muted-foreground">
              {mp.firstName[0]}
              {mp.lastName[0]}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold">
            {mp.firstName} {mp.lastName}
          </h1>
          <Badge
            className="mt-2 text-white"
            style={{ backgroundColor: partyColor }}
          >
            {partyName}
          </Badge>
          {mp.committees && mp.committees.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-muted-foreground">
                {t("committees")}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {mp.committees.map((c) => (
                  <Badge key={c} variant="outline" className="text-xs">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stats */}
        {mp.stats && (
          <Card>
            <CardHeader>
              <CardTitle>{t("statistics")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("votes")}
                  </p>
                  <p className="text-2xl font-bold">{mp.stats.totalVotes}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("attendance")}
                  </p>
                  <p className="text-2xl font-bold">
                    {(mp.stats.attendanceRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("loyalty")}
                  </p>
                  <p className="text-2xl font-bold">
                    {(mp.stats.partyAlignmentRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("recentLoyalty")}
                  </p>
                  <p className="text-2xl font-bold">
                    {(mp.stats.recentAlignmentRate * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div>
                  <div className="font-bold text-green-500">
                    {mp.stats.forVotes}
                  </div>
                  <div className="text-xs text-muted-foreground">{t("for")}</div>
                </div>
                <div>
                  <div className="font-bold text-red-500">
                    {mp.stats.againstVotes}
                  </div>
                  <div className="text-xs text-muted-foreground">{t("against")}</div>
                </div>
                <div>
                  <div className="font-bold text-amber-500">
                    {mp.stats.abstainVotes}
                  </div>
                  <div className="text-xs text-muted-foreground">{t("abstain")}</div>
                </div>
                <div>
                  <div className="font-bold text-slate-400">
                    {mp.stats.absentVotes}
                  </div>
                  <div className="text-xs text-muted-foreground">{t("absent")}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile */}
        {profile && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("profile")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {profile}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Key issues */}
        {mp.keyIssues && mp.keyIssues.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("keyIssues")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {mp.keyIssues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Behavioral patterns */}
        {mp.behavioralPatterns && mp.behavioralPatterns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("behavioralPatterns")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {mp.behavioralPatterns.map((pattern, i) => (
                  <li key={i}>{pattern}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
