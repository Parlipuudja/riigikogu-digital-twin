import { getTranslations } from "next-intl/server";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export default async function HomePage() {
  const t = await getTranslations("home");

  let stats = null;
  let health = null;

  try {
    [stats, health] = await Promise.all([api.stats(), api.health()]);
  } catch {
    // Service may be unavailable
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalVotings")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats ? formatNumber(stats.totalVotings) : "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("activeMPs")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats ? formatNumber(stats.activeMPs) : "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalDrafts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats ? formatNumber(stats.totalDrafts) : "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("accuracy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {health?.accuracy ? `${health.accuracy}%` : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System info */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle>{t("systemHealth")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("modelVersion")}
                </p>
                <p className="font-mono text-sm">{health.model_version}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("lastSync")}
                </p>
                <p className="font-mono text-sm">
                  {new Date(health.last_sync).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-mono text-sm">
                  {health.status === "ok" ? "Operational" : health.status}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
