"use client";

import { useState } from "react";
import { VoteBadge } from "@/components/data/vote-badge";
import { ConfidenceBar } from "@/components/data/confidence-bar";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { Prediction, VoteDecision } from "@/types";

interface MPPredictionFormProps {
  mpSlug: string;
  mpName: string;
  locale: string;
}

export function MPPredictionForm({ mpSlug, mpName, locale }: MPPredictionFormProps) {
  const [billTitle, setBillTitle] = useState("");
  const [billDescription, setBillDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billTitle.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/v1/mps/${mpSlug}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billTitle: billTitle.trim(),
          billDescription: billDescription.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Prediction failed");
      }

      setResult(data.data.prediction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="billTitle" className="input-label">
            {locale === "et" ? "Eelnõu pealkiri" : "Bill title"}
          </label>
          <input
            id="billTitle"
            type="text"
            value={billTitle}
            onChange={(e) => setBillTitle(e.target.value)}
            placeholder={locale === "et" ? "Nt: Tulumaksuseaduse muutmine" : "E.g., Tax Reform Act"}
            className="input"
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="billDescription" className="input-label">
            {locale === "et" ? "Kirjeldus (valikuline)" : "Description (optional)"}
          </label>
          <textarea
            id="billDescription"
            value={billDescription}
            onChange={(e) => setBillDescription(e.target.value)}
            placeholder={locale === "et" ? "Lühikirjeldus eelnõust..." : "Brief description of the bill..."}
            rows={3}
            className="input resize-none"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={!billTitle.trim() || isLoading}
          className="btn-primary w-full"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner />
              {locale === "et" ? "Analüüsin..." : "Analyzing..."}
            </span>
          ) : (
            locale === "et" ? "Prognoosi häält" : "Predict vote"
          )}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-vote-against-light text-vote-against rounded text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 pt-6 border-t border-ink-200">
          <div className="text-center mb-4">
            <div className="text-sm text-ink-500 mb-2">
              {locale === "et" ? "Prognoositud hääl" : "Predicted vote"}
            </div>
            <VoteBadge vote={result.vote as VoteDecision} size="lg" locale={locale as "et" | "en"} />
          </div>

          <div className="mb-4">
            <div className="text-sm text-ink-500 mb-2">
              {locale === "et" ? "Kindlus" : "Confidence"}
            </div>
            <ConfidenceBar value={result.confidence} size="lg" />
          </div>

          <div>
            <div className="text-sm text-ink-500 mb-2">
              {locale === "et" ? "Põhjendus" : "Reasoning"}
            </div>
            <p className="text-sm text-ink-700 leading-relaxed">
              {locale === "et" ? result.reasoning.et : result.reasoning.en}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

