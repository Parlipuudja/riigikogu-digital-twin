"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { VoteBadge } from "@/components/data/vote-badge";
import { PartyBadge } from "@/components/data/party-badge";
import { ConfidenceBar } from "@/components/data/confidence-bar";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { SimulationResult, VoteDecision, PartyCode, SimulationJobStatusResponse } from "@/types";

interface SimulationFormProps {
  initialQuery?: string;
  locale: string;
}

type ProgressStage = "submitting" | "loading" | "analyzing" | "predicting" | "calculating";

const POLL_INTERVAL_MS = 2000;
const STALE_TIMEOUT_MS = 45000; // 45 seconds without progress = stale

export function SimulationForm({ initialQuery, locale }: SimulationFormProps) {
  const t = useTranslations("simulation");
  const [billTitle, setBillTitle] = useState(initialQuery || "");
  const [billDescription, setBillDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progressStage, setProgressStage] = useState<ProgressStage>("submitting");
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const lastProgressUpdate = useRef<number>(Date.now());
  const lastCompletedMPs = useRef<number>(0);

  // Auto-submit if initialQuery provided
  useEffect(() => {
    if (initialQuery) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  const getStageFromProgress = (completedMPs: number, totalMPs: number): ProgressStage => {
    const percent = (completedMPs / totalMPs) * 100;
    if (percent < 10) return "loading";
    if (percent < 30) return "analyzing";
    if (percent < 95) return "predicting";
    return "calculating";
  };

  const pollJobStatus = useCallback(async (id: string) => {
    try {
      abortController.current = new AbortController();
      const response = await fetch(`/api/v1/simulate/${id}`, {
        signal: abortController.current.signal,
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch job status");
      }

      const jobData: SimulationJobStatusResponse = data.data;

      // Update progress
      const completed = jobData.progress.completedMPs;
      const total = jobData.progress.totalMPs;
      const percent = Math.round((completed / total) * 100);

      // Check for stale job (no progress for too long)
      if (completed > lastCompletedMPs.current) {
        lastProgressUpdate.current = Date.now();
        lastCompletedMPs.current = completed;
      } else if (Date.now() - lastProgressUpdate.current > STALE_TIMEOUT_MS) {
        throw new Error("Simulation appears stuck. Please try again.");
      }

      setProgressPercent(percent);
      setProgressStage(getStageFromProgress(completed, total));
      setProgressText(`${completed}/${total} ${t("mpsProcessed")}`);

      // Check if done
      if (jobData.status === "completed" && jobData.result) {
        // Stop polling
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
          pollInterval.current = null;
        }
        setProgressPercent(100);
        setResult(jobData.result as SimulationResult);
        setIsLoading(false);
        setJobId(null);
      } else if (jobData.status === "failed") {
        // Stop polling
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
          pollInterval.current = null;
        }
        throw new Error(jobData.error || "Simulation failed");
      }
      // If still processing, polling continues
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // Ignore abort errors
      }
      // Stop polling on error
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
      setJobId(null);
    }
  }, [t]);

  const handleCancel = useCallback(() => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
    if (abortController.current) {
      abortController.current.abort();
    }
    setIsLoading(false);
    setJobId(null);
    setProgressPercent(0);
    setProgressText("");
    setError("Simulation cancelled");
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!billTitle.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setProgressStage("submitting");
    setProgressPercent(0);
    setProgressText("");

    // Reset stale tracking
    lastProgressUpdate.current = Date.now();
    lastCompletedMPs.current = 0;

    try {
      // Submit simulation request
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

      // Start polling for results
      const newJobId = data.data.jobId;
      setJobId(newJobId);
      setProgressStage("loading");
      setProgressPercent(5);

      // Initial poll immediately
      await pollJobStatus(newJobId);

      // Start polling interval
      pollInterval.current = setInterval(() => {
        pollJobStatus(newJobId);
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
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
              {t("billTitle")}
            </label>
            <input
              id="billTitle"
              type="text"
              value={billTitle}
              onChange={(e) => setBillTitle(e.target.value)}
              placeholder={t("billTitlePlaceholder")}
              className="input"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="billDescription" className="input-label">
              {t("description")}
            </label>
            <textarea
              id="billDescription"
              value={billDescription}
              onChange={(e) => setBillDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={3}
              className="input resize-none"
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!billTitle.trim() || isLoading}
              className="btn-primary"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner />
                  {t("simulating")}
                </span>
              ) : (
                t("simulateButton")
              )}
            </button>
            {isLoading && (
              <button
                type="button"
                onClick={handleCancel}
                className="btn-secondary"
              >
                {t("cancel")}
              </button>
            )}
          </div>
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

      {/* Loading state with real progress */}
      {isLoading && (
        <div className="card mb-8">
          <div className="card-content py-8">
            {/* Progress bar */}
            <div className="mb-6">
              <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rk-500 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-ink-500">{progressText}</span>
                <span className="text-xs text-ink-400 font-mono">{progressPercent}%</span>
              </div>
            </div>

            {/* Progress stages */}
            <div className="space-y-3">
              <ProgressStep
                active={progressStage === "submitting"}
                completed={progressStage !== "submitting"}
                label={t("progressSubmitting")}
              />
              <ProgressStep
                active={progressStage === "loading"}
                completed={["analyzing", "predicting", "calculating"].includes(progressStage)}
                label={t("progressLoading")}
              />
              <ProgressStep
                active={progressStage === "analyzing"}
                completed={["predicting", "calculating"].includes(progressStage)}
                label={t("progressAnalyzing")}
              />
              <ProgressStep
                active={progressStage === "predicting"}
                completed={progressStage === "calculating"}
                label={t("progressPredicting")}
              />
              <ProgressStep
                active={progressStage === "calculating"}
                completed={progressPercent >= 100}
                label={t("progressCalculating")}
              />
            </div>

            {jobId && (
              <div className="mt-4 pt-4 border-t border-ink-100">
                <p className="text-xs text-ink-400">
                  Job ID: <code className="font-mono">{jobId}</code>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {result && <SimulationResults result={result} locale={locale} />}
    </div>
  );
}

function SimulationResults({ result, locale }: { result: SimulationResult; locale: string }) {
  const t = useTranslations("simulation");
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
            {isLikelyToPass ? t("likelyToPass") : t("likelyToFail")}
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
            <div className="text-xs text-ink-400 mt-1">{t("votesNeeded")}</div>
          </div>
        </div>
      </div>

      {/* Party breakdown */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">{t("breakdown")}</h2>
        </div>
        <div className="card-content">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("party")}</th>
                <th className="text-center">FOR</th>
                <th className="text-center">AGAINST</th>
                <th className="text-center">ABSTAIN</th>
                <th className="text-right">{t("stance")}</th>
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
                    <StanceBadge stance={party.stance} />
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
            <h2 className="text-lg font-semibold">{t("swingVotes")}</h2>
            <p className="text-xs text-ink-500 mt-1">{t("swingVotesDesc")}</p>
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
          <h2 className="text-lg font-semibold">{t("confidence")}</h2>
        </div>
        <div className="card-content">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-mono font-bold text-conf-high">
                {result.confidenceDistribution.high}
              </div>
              <div className="text-xs text-ink-500">
                {t("high")} (&gt;80%)
              </div>
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-conf-medium">
                {result.confidenceDistribution.medium}
              </div>
              <div className="text-xs text-ink-500">
                {t("medium")} (50-80%)
              </div>
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-conf-low">
                {result.confidenceDistribution.low}
              </div>
              <div className="text-xs text-ink-500">
                {t("low")} (&lt;50%)
              </div>
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-ink-400">
                {result.confidenceDistribution.unknown}
              </div>
              <div className="text-xs text-ink-500">{t("unknown")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StanceBadge({ stance }: { stance: string }) {
  const t = useTranslations("simulation");

  const config: Record<string, { key: string; color: string }> = {
    SUPPORTS: { key: "supports", color: "text-vote-for bg-vote-for-light" },
    OPPOSES: { key: "opposes", color: "text-vote-against bg-vote-against-light" },
    SPLIT: { key: "split", color: "text-vote-abstain bg-vote-abstain-light" },
    UNKNOWN: { key: "unknown", color: "text-ink-500 bg-ink-100" },
  };

  const stanceConfig = config[stance] || config.UNKNOWN;

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${stanceConfig.color}`}>
      {t(stanceConfig.key)}
    </span>
  );
}

function ProgressStep({
  active,
  completed,
  label,
}: {
  active: boolean;
  completed: boolean;
  label: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${completed ? "text-rk-600" : active ? "text-ink-900" : "text-ink-400"}`}>
      <div className="w-5 h-5 flex items-center justify-center">
        {completed ? (
          <svg className="w-5 h-5 text-vote-for" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : active ? (
          <LoadingSpinner className="w-4 h-4" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-ink-200" />
        )}
      </div>
      <span className={`text-sm ${active ? "font-medium" : ""}`}>{label}</span>
    </div>
  );
}
