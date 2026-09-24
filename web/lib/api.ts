export interface Metrics {
  requests?: number;
  cache_hits?: number;
  cache_misses?: number;
  cache_hit_rate?: number;
  lane_local?: number;
  lane_cloud?: number;
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
  ttft_avg_ms?: number;
  generation_avg_ms?: number;
  eval_runs?: number;
}

export interface EvalResult {
  lane?: string;
  n?: number;
  scores?: Record<string, number>;
  status?: string;
}

export interface RequestEvent {
  ts: number;
  conversation_id: string;
  prompt?: string;
  lane: "local" | "cloud" | "cache";
  model: string;
  cached?: boolean;
  similarity?: number;
  status: "ok" | "error";
  error?: string;
  ttft_ms?: number | null;
  elapsed_s?: number;
  tokens_in?: number;
  tokens_out?: number;
  tokens_per_sec?: number;
  cost_usd?: number;
  contexts_used?: number;
}

export interface ConsoleSummary {
  window: number;
  requests_last_hour: number;
  errors: number;
  cache_hits: number;
  cache_hit_rate: number;
  lane_local: number;
  lane_cloud: number;
  lane_cache: number;
  ttft_avg_ms: number;
  ttft_p50_ms: number;
  ttft_p95_ms: number;
  avg_tokens_per_sec: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  avg_similarity_on_hits: number;
  generated_requests: number;
  non_cache_requests: number;
}

export interface ConsolePayload {
  summary: ConsoleSummary;
  requests: RequestEvent[];
}
