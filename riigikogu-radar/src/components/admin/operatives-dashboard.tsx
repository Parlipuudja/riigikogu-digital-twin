"use client";

import { useState, useEffect } from "react";

interface OperativeStatus {
  id: string;
  name: string;
  pillar: string;
  lastRun: string | null;
  status: "success" | "error" | "running" | "never";
  nextRun: string | null;
}

interface SupervisorStatus {
  running: boolean;
  started: string | null;
  pid: number | null;
  totalRuns: number;
  lastPMRun: string | null;
}

interface LogEntry {
  file: string;
  timestamp: string;
  operative: string;
}

interface OperativesData {
  supervisor: SupervisorStatus;
  operatives: OperativeStatus[];
  recentLogs: LogEntry[];
  timestamp: string;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: "bg-conf-high/10 text-conf-high",
    error: "bg-vote-against/10 text-vote-against",
    running: "bg-rk-500/10 text-rk-600",
    never: "bg-ink-100 text-ink-500",
  };

  const labels: Record<string, string> = {
    success: "✓ Success",
    error: "✗ Error",
    running: "⟳ Running",
    never: "○ Never Run",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] || styles.never}`}>
      {labels[status] || labels.never}
    </span>
  );
}

function PillarBadge({ pillar }: { pillar: string }) {
  const colors: Record<string, string> = {
    ALL: "bg-purple-100 text-purple-800",
    COLLECT: "bg-blue-100 text-blue-800",
    ANALYZE: "bg-green-100 text-green-800",
    PREDICT: "bg-orange-100 text-orange-800",
    HEALTH: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${colors[pillar] || "bg-ink-100 text-ink-600"}`}>
      {pillar}
    </span>
  );
}

function formatTimeAgo(timestamp: string | null): string {
  if (!timestamp) return "Never";
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function LogViewer({ file, onClose }: { file: string; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/admin/operatives?action=log&file=${encodeURIComponent(file)}`)
      .then((res) => res.json())
      .then((data) => {
        setContent(data.content);
        setLoading(false);
      })
      .catch(() => {
        setContent("Failed to load log");
        setLoading(false);
      });
  }, [file]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">{file}</h3>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-700">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-rk-500" />
            </div>
          ) : (
            <pre className="text-xs whitespace-pre-wrap font-mono bg-ink-50 p-4 rounded">
              {content || "No content"}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

export function OperativesDashboard() {
  const [data, setData] = useState<OperativesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/v1/admin/operatives");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to fetch operative data:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-rk-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-ink-500">
        Failed to load operative data
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Supervisor Status */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-lg font-semibold">Operative Supervisor</h3>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary text-sm"
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>
        <div className="card-content">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-ink-500">Status</p>
              <p className="text-lg font-semibold">
                {data.supervisor.running ? (
                  <span className="text-conf-high">● Running</span>
                ) : (
                  <span className="text-vote-against">● Stopped</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-ink-500">Started</p>
              <p className="text-lg font-semibold">
                {formatTimeAgo(data.supervisor.started)}
              </p>
            </div>
            <div>
              <p className="text-sm text-ink-500">Total Runs</p>
              <p className="text-lg font-semibold">{data.supervisor.totalRuns}</p>
            </div>
            <div>
              <p className="text-sm text-ink-500">Last PM Run</p>
              <p className="text-lg font-semibold">
                {formatTimeAgo(data.supervisor.lastPMRun)}
              </p>
            </div>
          </div>

          {!data.supervisor.running && (
            <div className="mt-4 p-3 bg-vote-against/10 text-vote-against rounded text-sm">
              Supervisor is not running. Start it with: <code className="bg-ink-100 px-1 rounded">sudo systemctl start riigikogu-operatives</code>
            </div>
          )}
        </div>
      </div>

      {/* Operatives Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.operatives.map((op) => (
          <div key={op.id} className="card">
            <div className="card-content">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-ink-900">{op.name}</span>
                <PillarBadge pillar={op.pillar} />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">Status</span>
                  <StatusBadge status={op.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">Last Run</span>
                  <span className="text-ink-700">{formatTimeAgo(op.lastRun)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Logs */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">Recent Logs</h3>
        </div>
        <div className="card-content">
          {data.recentLogs.length === 0 ? (
            <p className="text-ink-500 text-sm py-4 text-center">No logs yet</p>
          ) : (
            <div className="space-y-1">
              {data.recentLogs.map((log, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedLog(log.file)}
                  className="w-full flex items-center justify-between p-2 hover:bg-ink-50 rounded text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-ink-400">📄</span>
                    <span className="font-mono text-sm text-ink-700">{log.operative}</span>
                  </div>
                  <span className="text-sm text-ink-500">
                    {formatTimeAgo(log.timestamp)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Log Viewer Modal */}
      {selectedLog && (
        <LogViewer file={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
