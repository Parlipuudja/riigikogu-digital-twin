import { getTranslations } from "next-intl/server";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Detection } from "@/types/domain";
import { DetectionsList } from "./detections-list";

export default async function IntelligencePage() {
  const t = await getTranslations("intelligence");

  let detections = null;
  let modelStatus = null;

  try {
    [detections, modelStatus] = await Promise.all([
      api.detections(),
      api.modelStatus(),
    ]);
  } catch {
    // Service unavailable — individual sections handle null gracefully
  }

  const detectionsList: Detection[] = detections?.detections ?? [];
  const coalitionShifts = detectionsList.filter(
    (d) => d.type === "coalition_shift"
  );
  const mpShifts = detectionsList.filter((d) => d.type === "mp_shift");
  const partySplits = detectionsList.filter((d) => d.type === "party_split");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">{t("title")}</h1>
      <p className="mb-8 text-muted-foreground">{t("subtitle")}</p>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalDetections")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{detectionsList.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("coalitionShifts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{coalitionShifts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("mpShifts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{mpShifts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("lastDetection")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {detections?.lastDetectionAt
                ? new Date(detections.lastDetectionAt).toLocaleDateString()
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detections by type */}
      <div className="mb-8 grid gap-6 lg:grid-cols-1">
        <DetectionsList
          coalitionShifts={coalitionShifts}
          mpShifts={mpShifts}
          partySplits={partySplits}
        />
      </div>

      {/* Model diagnostics section */}
      {modelStatus && (
        <>
          <h2 className="mb-4 text-2xl font-bold">{t("modelDiagnostics")}</h2>

          {/* Model version */}
          <div className="mb-6">
            <span className="text-sm text-muted-foreground">
              {t("modelVersion")}:{" "}
            </span>
            <span className="font-mono text-sm">{modelStatus.version}</span>
          </div>

          {/* Error categories + Improvement priorities */}
          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            {/* Error categories */}
            {modelStatus.errorCategories &&
              Object.keys(modelStatus.errorCategories).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("errorCategories")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(modelStatus.errorCategories).map(
                        ([category, count]) => {
                          const labelMap: Record<string, string> = {
                            free_vote: t("freeVote"),
                            party_split: t("partySplit"),
                            stale_profile: t("staleProfile"),
                            feature_gap: t("featureGap"),
                          };
                          return (
                            <div
                              key={category}
                              className="flex items-center justify-between"
                            >
                              <span className="text-sm font-medium">
                                {labelMap[category] ?? category}
                              </span>
                              <span className="font-mono text-sm">
                                {count}
                              </span>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Improvement priorities */}
            {modelStatus.improvementPriorities &&
              modelStatus.improvementPriorities.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("improvementPriorities")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="list-inside list-decimal space-y-2">
                      {modelStatus.improvementPriorities.map(
                        (priority, idx) => (
                          <li key={idx} className="text-sm">
                            {priority}
                          </li>
                        )
                      )}
                    </ol>
                  </CardContent>
                </Card>
              )}
          </div>

          {/* Weakest MPs table */}
          {modelStatus.weakestMPs && modelStatus.weakestMPs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("weakestMPs")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium text-muted-foreground">
                          {t("mpName")}
                        </th>
                        <th className="pb-2 text-right font-medium text-muted-foreground">
                          {t("accuracy")}
                        </th>
                        <th className="pb-2 text-right font-medium text-muted-foreground">
                          {t("count")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelStatus.weakestMPs.map((mp) => (
                        <tr
                          key={mp.slug}
                          className="border-b last:border-0"
                        >
                          <td className="py-2 font-medium">{mp.name}</td>
                          <td className="py-2 text-right font-mono">
                            {(mp.accuracy * 100).toFixed(1)}%
                          </td>
                          <td className="py-2 text-right text-muted-foreground">
                            {mp.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* No data state */}
      {!detections && !modelStatus && (
        <p className="text-center text-muted-foreground">
          {t("noDetections")}
        </p>
      )}
    </div>
  );
}
