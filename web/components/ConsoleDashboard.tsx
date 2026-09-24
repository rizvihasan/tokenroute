"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConsolePayload, EvalResult, RequestEvent } from "@/lib/api";
import { MetricCard } from "./MetricCard";

const POLL_MS = 4000;

const LANE_STYLE: Record<string, { bar: string; badge: string; label: string }> = {
  local: { bar: "bg-emerald-400", badge: "border-emerald-400/40 text-emerald-300", label: "local" },
  cloud: { bar: "bg-amber-400", badge: "border-amber-400/40 text-amber-300", label: "cloud" },
  cache: { bar: "bg-sky-400", badge: "border-sky-400/40 text-sky-300", label: "cache" },
};

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round(Date.now() / 1000 - ts));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const fmtMs = (ms?: number | null) =>
  ms === null || ms === undefined ? "-" : ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;

const fmtCost = (c?: number) => (c === undefined ? "-" : `$${c.toFixed(5)}`);

function laneBadge(lane: string) {
  const st = LANE_STYLE[lane] ?? LANE_STYLE.local;
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${st.badge}`}>
      {st.label}
    </span>
  );
}

function LaneSplit({ payload }: { payload: ConsolePayload }) {
  const { lane_local, lane_cloud, lane_cache } = payload.summary;
  const total = lane_local + lane_cloud + lane_cache;
  if (!total) return null;
  const rows = [
    { lane: "local", n: lane_local },
    { lane: "cloud", n: lane_cloud },
    { lane: "cache", n: lane_cache },
  ];
  return (
    <div className="rounded-lg border border-edge bg-panel p-4">
      <div className="mb-2 text-xs uppercase tracking-wide text-muted">Lane distribution</div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-black/40">
        {rows.map(({ lane, n }) =>
          n ? (
            <div
              key={lane}
              className={LANE_STYLE[lane].bar}
              style={{ width: `${(n / total) * 100}%` }}
              title={`${lane}: ${n}`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-muted">
        {rows.map(({ lane, n }) => (
          <span key={lane}>
            <span className={`mr-1 inline-block h-2 w-2 rounded-full ${LANE_STYLE[lane].bar}`} />
            {lane} {n} ({Math.round((n / total) * 100)}%)
          </span>
        ))}
      </div>
    </div>
  );
}

const BUCKETS = [
  { label: "<0.5s", max: 500 },
  { label: "0.5-1s", max: 1000 },
  { label: "1-2s", max: 2000 },
  { label: "2-3.5s", max: 3500 },
  { label: "3.5-5s", max: 5000 },
  { label: "5-8s", max: 8000 },
  { label: "8-13s", max: 13000 },
  { label: "13s+", max: Infinity },
];

function TtftHistogram({ events }: { events: RequestEvent[] }) {
  const ttfts = events
    .filter((e) => e.status === "ok" && e.lane !== "cache" && e.ttft_ms)
    .map((e) => e.ttft_ms as number);
  if (!ttfts.length) return null;
  const counts = BUCKETS.map(
    (b, i) => ttfts.filter((t) => t < b.max && (i === 0 || t >= BUCKETS[i - 1].max)).length,
  );
  const peak = Math.max(...counts, 1);
  return (
    <div className="rounded-lg border border-edge bg-panel p-4">
      <div className="mb-2 text-xs uppercase tracking-wide text-muted">
        Time to first token ({ttfts.length} generations)
      </div>
      <div className="flex h-24 items-end gap-1">
        {counts.map((c, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-sm bg-emerald-400/70"
              style={{ height: `${Math.max(2, (c / peak) * 80)}px` }}
              title={`${BUCKETS[i].label}: ${c}`}
            />
            <div className="whitespace-nowrap font-mono text-[9px] text-muted">{BUCKETS[i].label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestFeed({ events }: { events: RequestEvent[] }) {
  if (!events.length) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-edge bg-panel">
      <div className="border-b border-edge px-4 py-2 text-xs uppercase tracking-wide text-muted">
        Live request feed
      </div>
      <div className="max-h-96 overflow-y-auto">
        {events.slice(0, 25).map((e, i) => (
          <div
            key={`${e.ts}-${i}`}
            className="flex items-center gap-3 border-b border-edge/50 px-4 py-2 font-mono text-xs last:border-0"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                e.status === "ok" ? "bg-emerald-400" : "bg-rose-400"
              }`}
            />
            <span className="w-14 shrink-0 text-muted">{timeAgo(e.ts)}</span>
            <span className="min-w-0 flex-1 truncate text-slate-300" title={e.error ?? e.prompt}>
              {e.status === "error" ? `error: ${e.error}` : e.prompt || "(no prompt)"}
            </span>
            {laneBadge(e.lane)}
            {e.lane === "cache" && e.similarity !== undefined && (
              <span className="w-16 text-right text-sky-300">sim {e.similarity.toFixed(2)}</span>
            )}
            {e.lane !== "cache" && <span className="w-16 text-right text-slate-400">{e.model}</span>}
            <span className="w-16 text-right text-slate-400">{fmtMs(e.ttft_ms)}</span>
            <span className="w-16 text-right text-slate-400">
              {e.tokens_per_sec ? `${Math.round(e.tokens_per_sec)} t/s` : "-"}
            </span>
            <span className="w-16 text-right text-slate-400">{fmtCost(e.cost_usd)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConsoleDashboard() {
  const [payload, setPayload] = useState<ConsolePayload | null>(null);
  const [evals, setEvals] = useState<EvalResult>({});
  const [evalStatus, setEvalStatus] = useState<string>("");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [c, e] = await Promise.all([
        fetch("/api/metrics/console?limit=200", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/evals", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setPayload(c);
      setEvals(e);
      setUpdatedAt(Date.now());
    } catch {
      // gateway may still be starting; next poll recovers
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const runEvals = async () => {
    setEvalStatus("queued");
    try {
      const resp = await fetch("/api/evals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lane: "local" }),
      });
      const body = await resp.json();
      setEvalStatus(`queued job ${body.job_id?.slice(0, 8) ?? ""}`);
    } catch {
      setEvalStatus("failed to queue");
    }
  };

  const s = payload?.summary;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        LIVE - polling the gateway every {POLL_MS / 1000}s
        {updatedAt && <span>- updated {timeAgo(updatedAt / 1000)}</span>}
        {s !== undefined && <span>- window: last {s.window} requests</span>}
      </div>

      {s && s.window === 0 && (
        <div className="rounded-lg border border-edge bg-panel p-6 text-sm text-muted">
          No requests recorded yet. Send a message in Chat and watch it land here in real time.
        </div>
      )}

      {s && s.window > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              label="Requests"
              value={String(s.window)}
              hint={`${s.requests_last_hour} in the last hour${s.errors ? ` - ${s.errors} errors` : ""}`}
            />
            <MetricCard
              label="Cache hit rate"
              value={`${Math.round(s.cache_hit_rate * 100)}%`}
              hint={`${s.cache_hits} instant answers - avg sim ${s.avg_similarity_on_hits.toFixed(2)}`}
            />
            <MetricCard label="Avg TTFT" value={fmtMs(s.ttft_avg_ms)} hint={`p50 ${fmtMs(s.ttft_p50_ms)}`} />
            <MetricCard label="p95 TTFT" value={fmtMs(s.ttft_p95_ms)} hint="across generations" />
            <MetricCard
              label="Throughput"
              value={`${Math.round(s.avg_tokens_per_sec)} tok/s`}
              hint={`${s.tokens_out.toLocaleString()} tokens out`}
            />
            <MetricCard
              label="Notional spend"
              value={`$${s.cost_usd.toFixed(4)}`}
              hint="Groq list prices (free tier)"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <LaneSplit payload={payload!} />
            <TtftHistogram events={payload!.requests} />
          </div>

          <RequestFeed events={payload!.requests} />
        </>
      )}

      <div className="rounded-lg border border-edge bg-panel p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-muted">Evaluations (Ragas)</div>
        {evals?.scores ? (
          <div className="flex flex-wrap gap-4 font-mono text-sm text-slate-200">
            <span>lane: {evals.lane}</span>
            {Object.entries(evals.scores).map(([k, v]) => (
              <span key={k}>
                {k}: {typeof v === "number" ? v.toFixed(3) : String(v)}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted">No eval results yet.</div>
        )}
        <button
          onClick={runEvals}
          className="mt-3 rounded-md border border-edge bg-black/30 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500"
        >
          Run evals
        </button>
        {evalStatus && <span className="ml-2 text-xs text-muted">{evalStatus}</span>}
      </div>
    </div>
  );
}
