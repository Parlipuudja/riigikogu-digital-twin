"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { VoteBar } from "@/components/charts/vote-bar";
import type { SimulationResult, BillInput } from "@/types/domain";

export function SimulationForm() {
  const t = useTranslations("simulate");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSimulate() {
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const bill: BillInput = { title, description: description || undefined };
    try {
      const res = await fetch("/api/v1/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bill),
      });
      if (!res.ok) throw new Error(`Error: ${res.status}`);
      const data: SimulationResult = await res.json();

      if (data.status === "pending" || data.status === "running") {
        // Poll for completion
        let attempts = 0;
        while (attempts < 30) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const pollRes = await fetch(`/api/v1/simulate/${data.id}`);
          if (!pollRes.ok) break;
          const pollData: SimulationResult = await pollRes.json();
          if (pollData.status === "complete" || pollData.status === "error") {
            setResult(pollData);
            setLoading(false);
            return;
          }
          attempts++;
        }
        // Polling timed out
        setError(t("timeout"));
        setLoading(false);
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          <Input
            placeholder={t("billTitle")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder={t("billDescription")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
          <Button
            onClick={handleSimulate}
            disabled={loading || !title.trim()}
            className="w-full"
          >
            {loading ? t("running") : t("run")}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result?.summary && (
        <Card>
          <CardHeader>
            <CardTitle>{t("result")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <VoteBar
              forCount={result.summary.for}
              againstCount={result.summary.against}
              abstainCount={result.summary.abstain}
              absentCount={result.summary.absent}
            />
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-500">
                  {result.summary.for}
                </div>
                <div className="text-xs text-muted-foreground">{t("for")}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-500">
                  {result.summary.against}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("against")}
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-500">
                  {result.summary.abstain}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("abstain")}
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-400">
                  {result.summary.absent}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("absent")}
                </div>
              </div>
            </div>
            <div className="text-center">
              <span className="text-lg font-semibold">
                {t("outcome")}: {result.summary.predictedOutcome}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
