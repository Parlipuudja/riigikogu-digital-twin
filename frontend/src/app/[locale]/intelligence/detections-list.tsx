"use client";

import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Detection } from "@/types/domain";

function SeverityBadge({ severity, t }: { severity: string; t: (key: string) => string }) {
  const isHigh = severity === "high";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isHigh
          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      }`}
    >
      {isHigh ? t("high") : t("medium")}
    </span>
  );
}

function DetectionCard({
  detection,
  t,
}: {
  detection: Detection;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <SeverityBadge severity={detection.severity} t={t} />
          <span className="text-xs text-muted-foreground">
            {new Date(detection.detectedAt).toLocaleString()}
          </span>
        </div>
        <p className="text-sm">{detection.description}</p>
      </div>
    </div>
  );
}

interface DetectionsListProps {
  coalitionShifts: Detection[];
  mpShifts: Detection[];
  partySplits: Detection[];
}

export function DetectionsList({
  coalitionShifts,
  mpShifts,
  partySplits,
}: DetectionsListProps) {
  const t = useTranslations("intelligence");

  const sections = [
    { key: "coalitionShifts", label: t("coalitionShifts"), items: coalitionShifts },
    { key: "mpShifts", label: t("mpShifts"), items: mpShifts },
    { key: "partySplits", label: t("partySplits"), items: partySplits },
  ];

  const hasAny = sections.some((s) => s.items.length > 0);

  if (!hasAny) {
    return (
      <p className="text-center text-muted-foreground">{t("noDetections")}</p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-1">
      {sections.map(
        (section) =>
          section.items.length > 0 && (
            <Card key={section.key}>
              <CardHeader>
                <CardTitle>
                  {section.label}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    ({section.items.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {section.items.map((detection, idx) => (
                  <DetectionCard
                    key={`${section.key}-${idx}`}
                    detection={detection}
                    t={t}
                  />
                ))}
              </CardContent>
            </Card>
          )
      )}
    </div>
  );
}
