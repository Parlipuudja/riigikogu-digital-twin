"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PredictionResponse, BillInput } from "@/types/domain";

interface PredictFormProps {
  slug: string;
}

const DECISION_COLORS: Record<string, string> = {
  FOR: "#22c55e",
  AGAINST: "#ef4444",
  ABSTAIN: "#f59e0b",
  ABSENT: "#94a3b8",
};

export function PredictForm({ slug }: PredictFormProps) {
  const t = useTranslations("mps");
  const locale = useLocale();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePredict() {
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const bill: BillInput = { title, description: description || undefined };
    try {
      const res = await fetch(`/api/v1/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, bill }),
      });
      if (!res.ok) throw new Error(`Error: ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("predict")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder={t("billTitle")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Textarea
          placeholder={t("billDescription")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        <Button onClick={handlePredict} disabled={loading || !title.trim()}>
          {loading ? "..." : t("predict")}
        </Button>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {result && (
          <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <Badge
                className="text-white text-base px-3 py-1"
                style={{
                  backgroundColor: DECISION_COLORS[result.prediction] || "#999",
                }}
              >
                {result.prediction}
              </Badge>
              <span className="text-lg font-semibold">
                {(result.confidence * 100).toFixed(1)}%
              </span>
            </div>
            {(result.explanation || result.explanationEn) && (
              <p className="text-sm text-muted-foreground">
                {locale === "en" && result.explanationEn
                  ? result.explanationEn
                  : result.explanation || result.explanationEn}
              </p>
            )}
            {result.features && result.features.length > 0 && (
              <div className="space-y-1">
                {result.features.map((f) => (
                  <div
                    key={f.name}
                    className="flex justify-between text-xs text-muted-foreground"
                  >
                    <span>{f.description}</span>
                    <span className="font-mono">
                      {typeof f.value === "number"
                        ? f.value.toFixed(3)
                        : String(f.value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Model: {result.modelVersion}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
