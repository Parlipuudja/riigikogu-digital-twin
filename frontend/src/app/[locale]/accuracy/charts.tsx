"use client";

import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PartyAccuracyChart } from "@/components/charts/party-accuracy-chart";
import { AccuracyChart } from "@/components/charts/accuracy-chart";
import type { AccuracyData } from "@/types/domain";

interface AccuracyChartsProps {
  accuracy: AccuracyData;
}

export function AccuracyCharts({ accuracy }: AccuracyChartsProps) {
  const t = useTranslations("accuracy");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {accuracy.byParty && Object.keys(accuracy.byParty).length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("byParty")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PartyAccuracyChart data={accuracy.byParty} />
          </CardContent>
        </Card>
      )}

      {accuracy.trend && accuracy.trend.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("trend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AccuracyChart data={accuracy.trend} />
          </CardContent>
        </Card>
      )}

      {accuracy.byVoteType &&
        Object.keys(accuracy.byVoteType).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("byVoteType")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(accuracy.byVoteType).map(
                  ([type, { accuracy: acc, count }]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{type}</span>
                      <div className="text-right">
                        <span className="font-mono text-sm">
                          {(acc * 100).toFixed(1)}%
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({count} {t("count").toLowerCase()})
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
