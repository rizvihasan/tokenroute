# TokenRoute - Architecture

## Components

| Component | Tech | Job |
| --- | --- | --- |
| web | Next.js 14, TS, Tailwind | Chat UI (true SSE streaming) + analytics console |
| gateway | FastAPI, Python 3.11 | The product: routing, cache, RAG, metering, evals, OpenAI-compatible API |
| Redis | any Redis | Semantic cache entries, metrics counters, request log, RQ queues, rate limits |
| Postgres | pgvector | Document chunks + embeddings for RAG |
| providers | Ollama (local) or Groq/Jina (hosted) | Chat completions + embeddings, OpenAI-compatible |

There is no proxy container in the deployed stack: the gateway's `llm` service
resolves lane aliases to provider (base URL, key, model) from env and streams
directly. An earlier version deployed a LiteLLM proxy; it OOMed repeatedly on a
512MB host (its docs recommend 4Gi/worker), and everything it did - alias
resolution, one fallback hop, retries - is ~100 lines here. Local dev still
runs LiteLLM in compose for the Ollama path; same code, different env.

## Request lifecycle (POST /chat or /v1/chat/completions)

```
rate limit (per-IP token bucket, Redis)
  -> semantic cache lookup: embed prompt, cosine over cached entries (threshold 0.92)
       HIT  -> replay cached answer, log a $0 cache event, done
       MISS -> RAG retrieval (pgvector top-k over ingested docs)
            -> lane heuristic: local vs cloud (length, reasoning/code markers, context size)
            -> streamed completion, one cross-lane fallback hop on pre-token failure
            -> meter: TTFT, tokens/sec, cost (price table per lane), lane
            -> save response into the semantic cache
```

Every event lands in a capped Redis list (`requests:global`); the console reads
`GET /metrics/console` for aggregates (hit rate, TTFT p50/p95, lane split,
notional spend) plus the raw feed. No analytics database.

## Key design decisions

- **One OpenAI-compatible client, env-swappable providers.** Lane aliases
  (`chat-local`/`chat-cloud`) resolve to (base URL, key, model). Swapping a
  provider is an env edit; local dev points at LiteLLM/Ollama, the hosted demo
  at Groq/Jina.
- **Cache in front of everything.** The cache is the cost feature; the console
  is how you prove it. Threshold is a config knob (0.92 default).
- **Cheap lane by default.** The heuristic only escalates; fallback at the
  client covers failure. Both are deliberately simple and inspectable.
- **Degrade, don't die.** Cache lookup/save failures, RAG outages, and provider
  downtime all degrade to a plain completion or a clean error event - never a
  bare 500.
- **Heavy work off the request path.** Ingestion and eval runs are RQ jobs.

## Providers

- Local (compose): Ollama `llama3.1:8b-instruct-q4_K_M` chat lane,
  `nomic-embed-text` embeddings, fronted by the LiteLLM container.
- Hosted demo ($0): Groq `openai/gpt-oss-20b` (cheap lane) and
  `openai/gpt-oss-120b` (escalation); Jina `jina-embeddings-v3` at 1024 dims
  (must match `EMBEDDING_DIM`).

## Scaling story

Single-node compose today. The seams are deliberate: cache lookup is an
interface (linear scan now, pgvector/Redis vector search later), metrics are
Redis counters (swap for ClickHouse behind `/metrics/console`), and the gateway
is stateless - replicas sit behind any load balancer, with Redis as the shared
state.
