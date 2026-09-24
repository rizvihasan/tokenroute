"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConsolePayload, EvalResult, RequestEvent } from "@/lib/api";
import { MetricCard } from "./MetricCard";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

const POLL_MS = 4000;

const LANE_STYLE: Record<string, { bar: string; variant: "success" | "warn" | "info"; label: string }> = {
  local: { bar: "bg-emerald-400", variant: "success", label: "local" },
  cloud: { bar: "bg-amber-400", variant: "warn", label: "cloud" },
  cache: { bar: "bg-sky-400", variant: "info", label: "cache" },
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
  return <Badge variant={st.variant}>{st.label}</Badge>;
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
    <Card>
      <CardHeader title="Lane distribution" description="Requests by serving lane" />
      <CardContent>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink" role="img" aria-label={`Lane split: ${rows.map(({ lane, n }) => `${lane} ${Math.round((n / total) * 100)} percent`).join(", ")}`}>
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
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
          {rows.map(({ lane, n }) => (
            <span key={lane} className="inline-flex items-center">
              <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${LANE_STYLE[lane].bar}`} />
              {lane} <span className="ml-1 font-mono text-slate-300">{n}</span>
              <span className="ml-1 text-faint">({Math.round((n / total) * 100)}%)</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader title="Time to first token" description={`First-token latency across ${ttfts.length} generations`} />
      <CardContent>
        <div className="flex h-28 items-end gap-1.5">
          {counts.map((c, i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div
                className="w-full rounded-t-sm bg-emerald-400/70 transition-all"
                style={{ height: `${Math.max(3, (c / peak) * 88)}px` }}
                title={`${BUCKETS[i].label}: ${c}`}
              />
              <div className="w-full truncate text-center font-mono text-[9px] text-faint">
                {BUCKETS[i].label}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RequestFeed({ events }: { events: RequestEvent[] }) {
  if (!events.length) return null;
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Request feed" description="Most recent requests across all lanes" />
      <div className="max-h-[26rem] overflow-auto">
        <div className="min-w-[640px]">
          {events.slice(0, 25).map((e, i) => (
            <div
              key={`${e.ts}-${i}`}
              className="flex items-center gap-3 border-b border-edge/40 px-5 py-2.5 font-mono text-xs transition-colors last:border-0 hover:bg-panel-2/50"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  e.status === "ok" ? "bg-emerald-400" : "bg-rose-400"
                }`}
              />
              <span className="w-14 shrink-0 text-faint">{timeAgo(e.ts)}</span>
              <span className="min-w-0 flex-1 truncate text-slate-300" title={e.error ?? e.prompt}>
                {e.status === "error" ? `error: ${e.error}` : e.prompt || "(no prompt)"}
              </span>
              {laneBadge(e.lane)}
              {e.lane === "cache" && e.similarity !== undefined && (
                <span className="w-16 text-right text-sky-300">sim {e.similarity.toFixed(2)}</span>
              )}
              {e.lane !== "cache" && <span className="w-20 truncate text-right text-muted">{e.model}</span>}
              <span className="w-16 text-right text-muted">{fmtMs(e.ttft_ms)}</span>
              <span className="w-14 text-right text-muted">
                {e.tokens_per_sec ? `${Math.round(e.tokens_per_sec)} t/s` : "-"}
              </span>
              <span className="w-16 text-right text-muted">{fmtCost(e.cost_usd)}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span className="relative flex h-2 w-2" role="status" aria-label="Live updates on">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="font-medium uppercase tracking-wider text-emerald-300">Live</span>
        <span className="text-faint">polling every {POLL_MS / 1000}s</span>
        {updatedAt && <span className="text-faint">- updated {timeAgo(updatedAt / 1000)}</span>}
        {s !== undefined && <span className="text-faint">- window: last {s.window} requests</span>}
      </div>

      {!s && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] rounded-xl" />
          ))}
        </div>
      )}

      {s && s.window === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted">
              No requests yet. Send a message in the Playground and it appears here in real time.
            </p>
          </CardContent>
        </Card>
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
              hint={`${s.cache_hits} served from cache - avg similarity ${s.avg_similarity_on_hits.toFixed(2)}`}
            />
            <MetricCard label="Avg TTFT" value={fmtMs(s.ttft_avg_ms)} hint={`p50 ${fmtMs(s.ttft_p50_ms)}`} />
            <MetricCard label="p95 TTFT" value={fmtMs(s.ttft_p95_ms)} hint="across generations" />
            <MetricCard
              label="Throughput"
              value={`${Math.round(s.avg_tokens_per_sec)} tok/s`}
              hint={`${s.tokens_out.toLocaleString()} tokens out`}
            />
            <MetricCard
              label="Estimated spend"
              value={`$${s.cost_usd.toFixed(4)}`}
              hint="at Groq list prices"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <LaneSplit payload={payload!} />
            <TtftHistogram events={payload!.requests} />
          </div>

          <RequestFeed events={payload!.requests} />
        </>
      )}

      <Card>
        <CardHeader
          title="Evaluations (Ragas)"
          description="Answer-quality scores for the current model lineup"
          action={
            <div className="flex items-center gap-2">
              {evalStatus && <span className="text-xs text-muted">{evalStatus}</span>}
              <Button variant="secondary" size="sm" onClick={runEvals}>
                Run evals
              </Button>
            </div>
          }
        />
        <CardContent>
          {evals?.scores ? (
            <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-sm text-slate-200">
              <Badge variant="muted">lane: {evals.lane}</Badge>
              {Object.entries(evals.scores).map(([k, v]) => (
                <span key={k} className="inline-flex items-baseline gap-1.5">
                  <span className="text-xs text-muted">{k}</span>
                  <span className="text-accent">{typeof v === "number" ? v.toFixed(3) : String(v)}</span>
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted">No eval runs yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
