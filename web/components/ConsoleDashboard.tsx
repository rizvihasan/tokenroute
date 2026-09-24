"use client";

import { useCallback, useEffect, useState } from "react";
import type { EvalResult, Metrics } from "@/lib/api";
import { MetricCard } from "./MetricCard";

const POLL_MS = 3000;

export function ConsoleDashboard() {
  const [metrics, setMetrics] = useState<Metrics>({});
  const [evals, setEvals] = useState<EvalResult>({});
  const [evalStatus, setEvalStatus] = useState<string>("");

  const refresh = useCallback(async () => {
    try {
      const [m, e] = await Promise.all([
        fetch("/api/metrics", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/evals", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setMetrics(m);
      setEvals(e);
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

  const local = metrics.lane_local ?? 0;
  const cloud = metrics.lane_cloud ?? 0;
  const laneTotal = local + cloud;
  const localPct = laneTotal ? Math.round((local / laneTotal) * 100) : 0;
  const tps =
    metrics.generation_avg_ms && metrics.tokens_out
      ? (metrics.tokens_out / Math.max(metrics.requests ?? 1, 1) / (metrics.generation_avg_ms / 1000)).toFixed(1)
      : "-";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Avg TTFT" value={`${(metrics.ttft_avg_ms ?? 0).toFixed(0)} ms`} hint="time to first token" />
        <MetricCard label="Throughput" value={`${tps} tok/s`} hint="avg per request" />
        <MetricCard
          label="Cache hit rate"
          value={`${((metrics.cache_hit_rate ?? 0) * 100).toFixed(1)}%`}
          hint={`${metrics.cache_hits ?? 0} hits / ${metrics.cache_misses ?? 0} misses`}
        />
        <MetricCard label="Total cost" value={`$${(metrics.cost_usd ?? 0).toFixed(4)}`} hint="cloud lane only; local is $0" />
      </div>

      <div className="rounded-lg border border-edge bg-panel p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted">Model routing</span>
          <span className="font-mono text-xs text-muted">{metrics.requests ?? 0} requests</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded bg-ink">
          <div className="bg-accent transition-all" style={{ width: `${localPct}%` }} />
          <div className="bg-indigo-400 transition-all" style={{ width: `${100 - localPct}%` }} />
        </div>
        <div className="mt-2 flex justify-between font-mono text-xs text-muted">
          <span>local {local}</span>
          <span>cloud {cloud}</span>
        </div>
      </div>

      <div className="rounded-lg border border-edge bg-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted">Evals (golden set, Ragas)</span>
          <button
            onClick={runEvals}
            className="rounded bg-accent px-3 py-1 text-xs font-medium text-ink"
          >
            Run evals
          </button>
        </div>
        {evalStatus && <div className="mb-2 font-mono text-xs text-muted">{evalStatus}</div>}
        {evals.scores ? (
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(evals.scores).map(([name, score]) => (
              <MetricCard key={name} label={name} value={Number(score).toFixed(3)} hint={`lane: ${evals.lane}, n=${evals.n}`} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">{evals.status ?? "No results yet."}</p>
        )}
      </div>
    </div>
  );
}
