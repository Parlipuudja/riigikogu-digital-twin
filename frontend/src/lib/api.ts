import type {
  MP,
  Voting,
  Draft,
  Stats,
  HealthStatus,
} from "@/types/domain";

const SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== ""
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

async function fetchService<T>(
  path: string,
  options?: RequestInit & { revalidate?: number }
): Promise<T> {
  const { revalidate, ...fetchOptions } = options || {};
  const res = await fetch(`${SERVICE_URL}${path}`, {
    ...fetchOptions,
    headers: { "Content-Type": "application/json", ...fetchOptions?.headers },
    next: revalidate !== undefined ? { revalidate } : undefined,
  });
  if (!res.ok) throw new Error(`Service error: ${res.status}`);
  return res.json();
}

export const api = {
  health: () => fetchService<HealthStatus>("/health", { revalidate: 30 }),

  mps: (params?: { party?: string; sort?: string; active?: string }) =>
    fetchService<MP[]>(`/mps${qs(params)}`, { revalidate: 300 }),

  mp: (slug: string) =>
    fetchService<MP>(`/mps/${slug}`, { revalidate: 300 }),

  votings: (params?: { skip?: number; limit?: number }) =>
    fetchService<Voting[]>(`/votings${qs(params)}`, { revalidate: 300 }),

  voting: (uuid: string) =>
    fetchService<Voting>(`/votings/${uuid}`, { revalidate: 300 }),

  drafts: (params?: { skip?: number; limit?: number }) =>
    fetchService<Draft[]>(`/drafts${qs(params)}`, { revalidate: 300 }),

  stats: () => fetchService<Stats>("/stats", { revalidate: 60 }),
};
