import { getTranslations, getLocale } from "next-intl/server";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";

export default async function VotingsPage() {
  const t = await getTranslations("votings");
  const locale = await getLocale();

  let votings: Awaited<ReturnType<typeof api.votings>> = [];
  try {
    votings = await api.votings({ limit: 100 });
  } catch {
    // Service unavailable
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">{t("title")}</h1>

      <div className="space-y-3">
        {votings.map((voting) => (
          <Link key={voting.uuid} href={`/votings/${voting.uuid}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">
                    {locale === "en" && voting.titleEn
                      ? voting.titleEn
                      : voting.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(voting.votingTime).toLocaleDateString(
                      locale === "et" ? "et-EE" : "en-US",
                      { year: "numeric", month: "long", day: "numeric" }
                    )}
                  </p>
                  <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                    <span className="text-green-600">
                      {t("for")}: {voting.forCount}
                    </span>
                    <span className="text-red-600">
                      {t("against")}: {voting.againstCount}
                    </span>
                    <span className="text-amber-600">
                      {t("abstain")}: {voting.abstainCount}
                    </span>
                    <span className="text-slate-400">
                      {t("absent")}: {voting.absentCount}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Badge
                    variant={
                      voting.result === "ACCEPTED" ? "default" : "destructive"
                    }
                    className={
                      voting.result === "ACCEPTED"
                        ? "bg-green-600 text-white"
                        : ""
                    }
                  >
                    {voting.result === "ACCEPTED"
                      ? t("accepted")
                      : t("rejected")}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {votings.length === 0 && (
        <p className="mt-8 text-center text-muted-foreground">
          {t("noVotings")}
        </p>
      )}
    </div>
  );
}
