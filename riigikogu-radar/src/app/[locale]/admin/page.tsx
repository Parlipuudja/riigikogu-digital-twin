"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

interface AdminStatus {
  database: {
    healthy: boolean;
    totalSize: string;
    collections: { name: string; count: number; size: string }[];
  };
  embeddings: {
    votings: { total: number; withEmbeddings: number; percentage: number };
    stenograms: { total: number; withEmbeddings: number; percentage: number };
    overall: number;
  };
  ai: {
    activeProvider: string;
    failoverEnabled: boolean;
    availableProviders: string[];
    providerStatus: Record<string, { configured: boolean; active: boolean }>;
  };
  backtests: {
    total: number;
    postCutoff: number;
    recentRuns: Array<{
      mp: string;
      accuracy: number;
      sampleSize: number;
      postCutoff: boolean;
      lastRun: string;
    }>;
  };
  mps: {
    total: number;
    active: number;
    withProfiles: number;
  };
  timestamp: string;
}

interface MPForBacktest {
  slug: string;
  name: string;
  party: string;
  lastBacktest: string | null;
  accuracy: number | null;
  postCutoff: boolean;
}

interface BacktestResult {
  mp: string;
  slug: string;
  accuracy: number;
  sampleSize: number;
  postCutoff: boolean;
  byDecision: {
    for: { precision: number; correct: number; total: number };
    against: { precision: number; correct: number; total: number };
    abstain: { precision: number; correct: number; total: number };
  };
}

interface SimulationSummary {
  id: string;
  billTitle: string;
  billDescription?: string;
  draftUuid?: string;
  passageProbability: number;
  totalFor: number;
  totalAgainst: number;
  totalAbstain: number;
  predictionsCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SimulationHistoryData {
  fullParliamentSimulations: {
    total: number;
    simulations: SimulationSummary[];
  };
  individualPredictions: {
    totalCached: number;
    activeCached: number;
    uniqueBills: number;
    recentGroups: Array<{
      billHash: string;
      mpCount: number;
      lastUpdated: string;
      samplePrediction?: {
        mpName: string;
        party: string;
        vote: string;
      };
    }>;
  };
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium rounded-full ${
        ok
          ? "bg-conf-high/10 text-conf-high"
          : "bg-vote-against/10 text-vote-against"
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${ok ? "bg-conf-high" : "bg-vote-against"}`} />
      {label}
    </span>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-ink-600">{label}</span>
        <span className="font-medium">{value}%</span>
      </div>
      <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-rk-500 rounded-full transition-all"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="bg-ink-50 rounded-lg p-4">
      <div className="text-sm text-ink-500">{title}</div>
      <div className="text-2xl font-semibold text-ink-900 mt-1">{value}</div>
      {subtitle && <div className="text-xs text-ink-500 mt-1">{subtitle}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const locale = useLocale();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Backtest state
  const [mpList, setMpList] = useState<MPForBacktest[]>([]);
  const [selectedMp, setSelectedMp] = useState<string>("");
  const [backtestRunning, setBacktestRunning] = useState(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);

  // Simulation history state
  const [simulationHistory, setSimulationHistory] = useState<SimulationHistoryData | null>(null);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push(`/${locale}/login?callbackUrl=/${locale}/admin`);
    }
  }, [sessionStatus, router, locale]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statusRes, mpsRes, simsRes] = await Promise.all([
          fetch("/api/v1/admin/status"),
          fetch("/api/v1/admin/backtest"),
          fetch("/api/v1/admin/simulations"),
        ]);

        if (!statusRes.ok || !mpsRes.ok) {
          if (statusRes.status === 401 || mpsRes.status === 401) {
            router.push(`/${locale}/login?callbackUrl=/${locale}/admin`);
            return;
          }
          throw new Error("Failed to fetch data");
        }

        const [statusData, mpsData, simsData] = await Promise.all([
          statusRes.json(),
          mpsRes.json(),
          simsRes.json(),
        ]);

        setStatus(statusData.data);
        setMpList(mpsData.data || []);
        if (simsData.success) {
          setSimulationHistory(simsData.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    if (sessionStatus === "authenticated") {
      fetchData();
    }
  }, [sessionStatus, router, locale]);

  const runBacktest = async () => {
    if (!selectedMp) return;

    setBacktestRunning(true);
    setBacktestResult(null);
    setBacktestError(null);

    try {
      const res = await fetch("/api/v1/admin/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: selectedMp,
          maxVotes: 30,
          postCutoff: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Backtest failed");
      }

      setBacktestResult(data.data);

      // Refresh status to show updated backtest
      const statusRes = await fetch("/api/v1/admin/status");
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData.data);
      }
    } catch (err) {
      setBacktestError(err instanceof Error ? err.message : "Backtest failed");
    } finally {
      setBacktestRunning(false);
    }
  };

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="page-container py-12">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rk-500" />
          <span className="ml-3 text-ink-600">
            {locale === "et" ? "Laadin..." : "Loading..."}
          </span>
        </div>
      </div>
    );
  }

  if (sessionStatus === "unauthenticated") {
    return null;
  }

  if (error) {
    return (
      <div className="page-container py-12">
        <div className="max-w-xl mx-auto text-center">
          <div className="text-vote-against text-lg mb-2">
            {locale === "et" ? "Viga" : "Error"}
          </div>
          <p className="text-ink-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!status) return null;

  const t = {
    title: locale === "et" ? "Administraatori paneel" : "Admin Dashboard",
    systemStatus: locale === "et" ? "Süsteemi staatus" : "System Status",
    database: locale === "et" ? "Andmebaas" : "Database",
    aiProvider: locale === "et" ? "AI pakkuja" : "AI Provider",
    failover: locale === "et" ? "Varumudel" : "Failover",
    embeddings: locale === "et" ? "Vektormanused" : "Embeddings",
    votings: locale === "et" ? "Hääletused" : "Votings",
    stenograms: locale === "et" ? "Stenogrammid" : "Stenograms",
    overall: locale === "et" ? "Kokku" : "Overall",
    backtests: locale === "et" ? "Tagasitestid" : "Backtests",
    recent: locale === "et" ? "Viimased testid" : "Recent Tests",
    mps: locale === "et" ? "Saadikud" : "MPs",
    active: locale === "et" ? "Aktiivsed" : "Active",
    withProfiles: locale === "et" ? "Profiiliga" : "With profiles",
    collections: locale === "et" ? "Kollektsioonid" : "Collections",
    healthy: locale === "et" ? "Terve" : "Healthy",
    degraded: locale === "et" ? "Häiritud" : "Degraded",
    enabled: locale === "et" ? "Sees" : "Enabled",
    disabled: locale === "et" ? "Väljas" : "Disabled",
    postCutoff: locale === "et" ? "Väljaspool valimit" : "Post-cutoff",
    accuracy: locale === "et" ? "Täpsus" : "Accuracy",
    samples: locale === "et" ? "valimit" : "samples",
    lastUpdated: locale === "et" ? "Viimati uuendatud" : "Last updated",
    configured: locale === "et" ? "Seadistatud" : "Configured",
    notConfigured: locale === "et" ? "Seadistamata" : "Not configured",
    runBacktest: locale === "et" ? "Käivita tagasitest" : "Run Backtest",
    selectMp: locale === "et" ? "Vali saadik" : "Select MP",
    running: locale === "et" ? "Käivitub..." : "Running...",
    dataSync: locale === "et" ? "Andmete sünkroonimine" : "Data Sync",
    syncInstructions: locale === "et" ? "Käsud CLI kaudu" : "CLI Commands",
    simulationHistory: locale === "et" ? "Simulatsioonide ajalugu" : "Simulation History",
    fullParliament: locale === "et" ? "Parlamendi simulatsioonid" : "Parliament Simulations",
    individualPredictions: locale === "et" ? "Üksikud ennustused" : "Individual Predictions",
    totalSimulations: locale === "et" ? "Kokku simulatsioone" : "Total simulations",
    cachedPredictions: locale === "et" ? "Puhverdatud ennustusi" : "Cached predictions",
    uniqueBills: locale === "et" ? "Erinevaid eelnõusid" : "Unique bills",
    passageChance: locale === "et" ? "Läbimise võimalus" : "Passage chance",
    noSimulations: locale === "et" ? "Simulatsioone pole veel tehtud" : "No simulations yet",
    for: locale === "et" ? "Poolt" : "For",
    against: locale === "et" ? "Vastu" : "Against",
  };

  return (
    <div className="page-container py-8">
      <div className="flex items-center justify-between mb-8">
        <h1>{t.title}</h1>
        <span className="text-sm text-ink-500">
          {t.lastUpdated}: {new Date(status.timestamp).toLocaleString(locale)}
        </span>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          title={t.mps}
          value={status.mps.active}
          subtitle={`${status.mps.withProfiles} ${t.withProfiles}`}
        />
        <StatCard
          title={t.backtests}
          value={status.backtests.total}
          subtitle={`${status.backtests.postCutoff} ${t.postCutoff}`}
        />
        <StatCard
          title={t.embeddings}
          value={`${status.embeddings.overall}%`}
          subtitle={t.overall}
        />
        <StatCard
          title={t.database}
          value={status.database.totalSize}
          subtitle={status.database.healthy ? t.healthy : t.degraded}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Backtest Trigger */}
        <section className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">{t.runBacktest}</h2>
          </div>
          <div className="card-content space-y-4">
            <div>
              <label htmlFor="mp-select" className="input-label">
                {t.selectMp}
              </label>
              <select
                id="mp-select"
                value={selectedMp}
                onChange={(e) => setSelectedMp(e.target.value)}
                className="input"
                disabled={backtestRunning}
              >
                <option value="">{locale === "et" ? "-- Vali --" : "-- Select --"}</option>
                {mpList.map((mp) => (
                  <option key={mp.slug} value={mp.slug}>
                    {mp.name} ({mp.party})
                    {mp.accuracy !== null ? ` - ${mp.accuracy}%` : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={runBacktest}
              disabled={!selectedMp || backtestRunning}
              className="btn-primary w-full"
            >
              {backtestRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  {t.running}
                </span>
              ) : (
                t.runBacktest
              )}
            </button>

            {backtestError && (
              <div className="p-3 text-sm text-vote-against bg-vote-against/10 rounded">
                {backtestError}
              </div>
            )}

            {backtestResult && (
              <div className="p-4 bg-conf-high/10 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink-900">{backtestResult.mp}</span>
                  <span className="text-lg font-bold text-conf-high">{backtestResult.accuracy}%</span>
                </div>
                <div className="text-sm text-ink-600">
                  {backtestResult.sampleSize} {t.samples}
                  {backtestResult.postCutoff && (
                    <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-conf-high/20 text-conf-high rounded">
                      OOS
                    </span>
                  )}
                </div>
                <div className="text-xs text-ink-500 pt-2 border-t border-conf-high/20">
                  <div>FOR: {backtestResult.byDecision.for.precision}% ({backtestResult.byDecision.for.correct}/{backtestResult.byDecision.for.total})</div>
                  <div>AGAINST: {backtestResult.byDecision.against.precision}% ({backtestResult.byDecision.against.correct}/{backtestResult.byDecision.against.total})</div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Data Sync */}
        <section className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">{t.dataSync}</h2>
          </div>
          <div className="card-content space-y-4">
            <p className="text-sm text-ink-600">
              {locale === "et"
                ? "Andmete sünkroonimine tuleb käivitada CLI kaudu (Vercel ajaliimiit)."
                : "Data syncs must be run via CLI (Vercel time limit)."}
            </p>

            <div className="bg-ink-50 rounded-lg p-3 space-y-2">
              <div className="text-xs text-ink-500 font-medium uppercase">{t.syncInstructions}</div>
              <div className="font-mono text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-ink-600">Full sync:</span>
                  <code className="text-rk-700">npx tsx scripts/sync-api.ts all</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-600">Members:</span>
                  <code className="text-rk-700">npx tsx scripts/sync-api.ts members</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-600">Votings:</span>
                  <code className="text-rk-700">npx tsx scripts/sync-api.ts votings</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-600">Status:</span>
                  <code className="text-rk-700">npx tsx scripts/sync-api.ts status</code>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-ink-100">
              <div className="text-xs text-ink-500">
                {locale === "et" ? "Embeddings:" : "Embeddings:"}
                <code className="ml-2 text-rk-700">npx tsx scripts/generate-embeddings.ts</code>
              </div>
            </div>
          </div>
        </section>

        {/* System Status */}
        <section className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">{t.systemStatus}</h2>
          </div>
          <div className="card-content space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-ink-600">{t.database}</span>
              <StatusBadge ok={status.database.healthy} label={status.database.healthy ? t.healthy : t.degraded} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-600">{t.aiProvider}</span>
              <span className="font-medium text-ink-900">{status.ai.activeProvider}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-600">{t.failover}</span>
              <StatusBadge ok={status.ai.failoverEnabled} label={status.ai.failoverEnabled ? t.enabled : t.disabled} />
            </div>
            {/* Provider configuration status */}
            {Object.entries(status.ai.providerStatus).map(([provider, info]) => (
              <div key={provider} className="flex items-center justify-between">
                <span className="text-ink-600 capitalize">{provider}</span>
                <StatusBadge ok={info.configured} label={info.configured ? t.configured : t.notConfigured} />
              </div>
            ))}
          </div>
        </section>

        {/* Embeddings */}
        <section className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">{t.embeddings}</h2>
          </div>
          <div className="card-content space-y-4">
            <ProgressBar
              value={status.embeddings.votings.percentage}
              label={`${t.votings} (${status.embeddings.votings.withEmbeddings}/${status.embeddings.votings.total})`}
            />
            <ProgressBar
              value={status.embeddings.stenograms.percentage}
              label={`${t.stenograms} (${status.embeddings.stenograms.withEmbeddings}/${status.embeddings.stenograms.total})`}
            />
            <div className="pt-2 border-t border-ink-100">
              <ProgressBar value={status.embeddings.overall} label={t.overall} />
            </div>
          </div>
        </section>

        {/* Recent Backtests */}
        <section className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">{t.recent}</h2>
          </div>
          <div className="card-content">
            {status.backtests.recentRuns.length === 0 ? (
              <p className="text-ink-500 text-sm">
                {locale === "et" ? "Tagasiteste pole veel tehtud" : "No backtests run yet"}
              </p>
            ) : (
              <div className="space-y-3">
                {status.backtests.recentRuns.map((run, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink-900">{run.mp}</span>
                      {run.postCutoff && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-conf-high/10 text-conf-high rounded">
                          OOS
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-ink-600">
                      <span>
                        {run.accuracy}% ({run.sampleSize} {t.samples})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Database Collections */}
        <section className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">{t.collections}</h2>
          </div>
          <div className="card-content">
            <div className="space-y-2">
              {status.database.collections.map((col) => (
                <div key={col.name} className="flex items-center justify-between text-sm">
                  <span className="text-ink-600 font-mono">{col.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-ink-500">{col.count.toLocaleString()}</span>
                    <span className="text-ink-400 w-16 text-right">{col.size}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Simulation History Section */}
      {simulationHistory && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">{t.simulationHistory}</h2>

          {/* Simulation Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              title={t.fullParliament}
              value={simulationHistory.fullParliamentSimulations.total}
              subtitle={t.totalSimulations}
            />
            <StatCard
              title={t.individualPredictions}
              value={simulationHistory.individualPredictions.activeCached}
              subtitle={`${simulationHistory.individualPredictions.totalCached} ${t.cachedPredictions}`}
            />
            <StatCard
              title={t.uniqueBills}
              value={simulationHistory.individualPredictions.uniqueBills}
              subtitle={t.individualPredictions}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Full Parliament Simulations */}
            <section className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold">{t.fullParliament}</h3>
              </div>
              <div className="card-content">
                {simulationHistory.fullParliamentSimulations.simulations.length === 0 ? (
                  <p className="text-ink-500 text-sm">{t.noSimulations}</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {simulationHistory.fullParliamentSimulations.simulations.map((sim) => (
                      <div key={sim.id} className="p-3 bg-ink-50 rounded-lg">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-ink-900 text-sm truncate" title={sim.billTitle}>
                              {sim.billTitle}
                            </div>
                            <div className="text-xs text-ink-500">
                              {new Date(sim.createdAt).toLocaleString(locale)}
                            </div>
                          </div>
                          <div className={`flex-shrink-0 text-lg font-bold ${
                            sim.passageProbability >= 50 ? 'text-conf-high' : 'text-vote-against'
                          }`}>
                            {sim.passageProbability}%
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-conf-high">{t.for}: {sim.totalFor}</span>
                          <span className="text-vote-against">{t.against}: {sim.totalAgainst}</span>
                          {sim.totalAbstain > 0 && (
                            <span className="text-ink-500">Abstain: {sim.totalAbstain}</span>
                          )}
                          <span className="text-ink-400 ml-auto">{sim.predictionsCount} MPs</span>
                        </div>
                        {sim.draftUuid && (
                          <div className="mt-1 text-[10px] text-ink-400 font-mono">
                            Draft: {sim.draftUuid.substring(0, 8)}...
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Individual Prediction Groups */}
            <section className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold">{t.individualPredictions}</h3>
              </div>
              <div className="card-content">
                {simulationHistory.individualPredictions.recentGroups.length === 0 ? (
                  <p className="text-ink-500 text-sm">{t.noSimulations}</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {simulationHistory.individualPredictions.recentGroups.map((group) => (
                      <div key={group.billHash} className="p-3 bg-ink-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs text-ink-600">
                            {group.billHash.substring(0, 16)}...
                          </span>
                          <span className="text-sm font-medium text-ink-900">
                            {group.mpCount} MPs
                          </span>
                        </div>
                        <div className="text-xs text-ink-500">
                          {new Date(group.lastUpdated).toLocaleString(locale)}
                        </div>
                        {group.samplePrediction && (
                          <div className="mt-2 text-xs text-ink-600">
                            e.g., {group.samplePrediction.mpName} ({group.samplePrediction.party}): {group.samplePrediction.vote}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
