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
