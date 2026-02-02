"use client";

import { useState, useEffect } from "react";
import { VoteBadge } from "@/components/data/vote-badge";
import { PartyBadge, getPartyCode } from "@/components/data/party-badge";
import { ConfidenceBar } from "@/components/data/confidence-bar";
import type { SimulationResult, VoteDecision, PartyCode } from "@/types";

interface SimulationFormProps {
  initialQuery?: string;
  locale: string;
}

export function SimulationForm({ initialQuery, locale }: SimulationFormProps) {
  const [billTitle, setBillTitle] = useState(initialQuery || "");
  const [billDescription, setBillDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-submit if initialQuery provided
  useEffect(() => {
    if (initialQuery && !result && !isLoading) {
      handleSubmit();
    }
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!billTitle.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/v1/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billTitle: billTitle.trim(),
          billDescription: billDescription.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Simulation failed");
      }

      setResult(data.data.simulation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Form */}
      <form onSubmit={handleSubmit} className="card mb-8">
        <div className="card-content space-y-4">
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
            className="btn-primary"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner />
                {locale === "et" ? "Simuleerin parlamendi hääletust..." : "Simulating parliament vote..."}
              </span>
            ) : (
              locale === "et" ? "Simuleeri hääletust" : "Simulate vote"
            )}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="card mb-8">
          <div className="card-content">
            <div className="p-4 bg-vote-against-light text-vote-against rounded">
              {error}
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="card mb-8">
          <div className="card-content text-center py-12">
            <LoadingSpinner className="w-8 h-8 mx-auto mb-4 text-rk-500" />
            <p className="text-ink-600">
              {locale === "et"
                ? "Analüüsin kõiki Riigikogu liikmeid... See võib võtta mõni minut."
                : "Analyzing all MPs... This may take a few minutes."}
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && <SimulationResults result={result} locale={locale} />}
    </div>
  );
}

function SimulationResults({ result, locale }: { result: SimulationResult; locale: string }) {
  const isLikelyToPass = result.passageProbability >= 50;

  return (
    <div className="space-y-8">
      {/* Main result */}
      <div className="card">
        <div className="card-content text-center py-8">
          <div
            className={`text-2xl font-semibold mb-2 ${
              isLikelyToPass ? "text-vote-for" : "text-vote-against"
            }`}
          >
            {isLikelyToPass
              ? locale === "et" ? "TÕENÄOLISELT LÄBIB" : "LIKELY TO PASS"
              : locale === "et" ? "TÕENÄOLISELT EI LÄBI" : "LIKELY TO FAIL"}
          </div>

          <div className="text-5xl font-mono font-bold text-ink-900 mb-4">
            {result.passageProbability}%
          </div>

          <div className="flex justify-center gap-8 text-sm">
            <div>
              <span className="font-mono text-lg font-bold text-vote-for">{result.totalFor}</span>
              <span className="text-ink-500 ml-1">FOR</span>
            </div>
            <div>
              <span className="font-mono text-lg font-bold text-vote-against">{result.totalAgainst}</span>
              <span className="text-ink-500 ml-1">AGAINST</span>
            </div>
            <div>
              <span className="font-mono text-lg font-bold text-vote-abstain">{result.totalAbstain}</span>
              <span className="text-ink-500 ml-1">ABSTAIN</span>
            </div>
            {result.totalUnknown > 0 && (
              <div>
                <span className="font-mono text-lg font-bold text-ink-400">{result.totalUnknown}</span>
                <span className="text-ink-500 ml-1">UNKNOWN</span>
              </div>
            )}
          </div>

          {/* Visual bar */}
          <div className="mt-6 max-w-md mx-auto">
            <div className="h-4 bg-ink-100 rounded-full overflow-hidden flex">
              <div
                className="bg-vote-for h-full"
                style={{ width: `${(result.totalFor / 101) * 100}%` }}
              />
              <div
                className="bg-vote-against h-full"
                style={{ width: `${(result.totalAgainst / 101) * 100}%` }}
              />
              <div
                className="bg-vote-abstain h-full"
                style={{ width: `${(result.totalAbstain / 101) * 100}%` }}
              />
            </div>
            <div className="text-xs text-ink-400 mt-1">
              {locale === "et" ? "51 häält vajalik läbimiseks" : "51 votes needed to pass"}
            </div>
          </div>
        </div>
      </div>

      {/* Party breakdown */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">
            {locale === "et" ? "Erakondade lõikes" : "Breakdown by party"}
          </h2>
        </div>
        <div className="card-content">
          <table className="data-table">
            <thead>
              <tr>
                <th>{locale === "et" ? "Erakond" : "Party"}</th>
                <th className="text-center">FOR</th>
                <th className="text-center">AGAINST</th>
                <th className="text-center">ABSTAIN</th>
                <th className="text-right">{locale === "et" ? "Seisukoht" : "Stance"}</th>
              </tr>
            </thead>
            <tbody>
              {result.partyBreakdown.map((party) => (
                <tr key={party.party}>
                  <td>
                    <PartyBadge
                      party={party.party}
                      partyCode={party.partyCode as PartyCode}
                    />
                    <span className="ml-2 text-ink-400">({party.totalMembers})</span>
                  </td>
                  <td className="text-center font-mono text-vote-for">{party.predictedFor}</td>
                  <td className="text-center font-mono text-vote-against">{party.predictedAgainst}</td>
                  <td className="text-center font-mono text-vote-abstain">{party.predictedAbstain}</td>
                  <td className="text-right">
                    <StanceBadge stance={party.stance} locale={locale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Swing votes */}
      {result.swingVotes.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">
              {locale === "et" ? "Kõikuvad hääled" : "Swing votes"}
            </h2>
            <p className="text-xs text-ink-500 mt-1">
              {locale === "et"
                ? "Madala kindlusega ennustused, mis võivad tulemust muuta"
                : "Low-confidence predictions that could change the outcome"}
            </p>
          </div>
          <div className="card-content">
            <div className="space-y-3">
              {result.swingVotes.map((sv) => (
                <div key={sv.mpSlug} className="flex items-center justify-between py-2 border-b border-ink-100 last:border-0">
                  <div>
                    <div className="font-medium text-ink-900">{sv.mpName}</div>
                    <div className="text-sm text-ink-500">{sv.party}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <VoteBadge vote={sv.predictedVote as VoteDecision} locale={locale as "et" | "en"} />
                    <div className="w-24">
                      <ConfidenceBar value={sv.confidence} size="sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confidence distribution */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">
            {locale === "et" ? "Kindluse jaotus" : "Confidence distribution"}
          </h2>
        </div>
        <div className="card-content">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-mono font-bold text-conf-high">
                {result.confidenceDistribution.high}
              </div>
              <div className="text-xs text-ink-500">
                {locale === "et" ? "Kõrge" : "High"} (&gt;80%)
              </div>
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-conf-medium">
                {result.confidenceDistribution.medium}
              </div>
              <div className="text-xs text-ink-500">
                {locale === "et" ? "Keskmine" : "Medium"} (50-80%)
              </div>
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-conf-low">
                {result.confidenceDistribution.low}
              </div>
              <div className="text-xs text-ink-500">
                {locale === "et" ? "Madal" : "Low"} (&lt;50%)
              </div>
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-ink-400">
                {result.confidenceDistribution.unknown}
              </div>
              <div className="text-xs text-ink-500">
                {locale === "et" ? "Teadmata" : "Unknown"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StanceBadge({ stance, locale }: { stance: string; locale: string }) {
  const labels: Record<string, { et: string; en: string; color: string }> = {
    SUPPORTS: { et: "TOETAB", en: "SUPPORTS", color: "text-vote-for bg-vote-for-light" },
    OPPOSES: { et: "VASTU", en: "OPPOSES", color: "text-vote-against bg-vote-against-light" },
    SPLIT: { et: "LÕHESTUNUD", en: "SPLIT", color: "text-vote-abstain bg-vote-abstain-light" },
    UNKNOWN: { et: "TEADMATA", en: "UNKNOWN", color: "text-ink-500 bg-ink-100" },
  };

  const config = labels[stance] || labels.UNKNOWN;

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${config.color}`}>
      {locale === "et" ? config.et : config.en}
    </span>
  );
}

function LoadingSpinner({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
