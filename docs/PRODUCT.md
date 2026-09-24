# TokenRoute - Product

## The problem

Any team shipping an AI feature hits three walls within a month:

1. **Cost variance is ~100x between models.** "What's your refund policy?" and
   "analyze this contract" do not need the same brain, but most teams send
   everything to the expensive model because routing is work.
2. **Providers fail in production.** Rate limits, outages, deprecations. A
   hardcoded model string is a single point of failure.
3. **Nobody can answer "what did our AI cost this week, and why?"** The data
   exists only on the provider's invoice.

## What TokenRoute is

A self-hostable LLM gateway: one OpenAI-compatible endpoint in front of all
your providers, with routing, fallback, a semantic cache, and a live analytics
console. Drop-in: change your SDK's `base_url`, keep everything else.

The differentiator is the **semantic cache**. Exact-match caches miss on every
paraphrase; TokenRoute embeds the prompt and matches on cosine similarity, so
"what is the cache threshold?" and "how high is the cache cutoff?" are the same
question - answered instantly, for $0. Observability tells you what you spent;
the cache is why you spend less.

## Where it sits in the market (September 2026)

The category consolidated this year: Helicone was acquired by Mintlify and
frozen (March 2026), Portkey was absorbed into Palo Alto's Prisma AIRS,
Langfuse went to ClickHouse. What's left, honestly:

| Alternative | Model | Gap TokenRoute fills |
| --- | --- | --- |
| Portkey (Prisma AIRS) | Free routing; observability is the $49/mo upsell | Full console free, self-hosted |
| LiteLLM | OSS router, no UI; Enterprise for governance | Built-in console; per-request metering that does not drift under concurrency |
| Langfuse | Observability, no gateway; 4-service self-host | Gateway + console, one compose file |
| Bifrost (Maxim) | Fast Go gateway; observability via paid Maxim | Console included, not split across products |
| Cloudflare AI Gateway | Free but shallow, hosted-only | Semantic cache, RAG, evals, self-host anywhere |
| Helicone | Frozen product | A living one |

## Who it is for

- Solo devs and small teams shipping LLM features who want cost control and
  visibility without an enterprise sales call.
- Teams who want to self-host for data control and not get a gutted free tier.

## Business model (planned)

The gateway, console, cache, and evals stay Apache 2.0 - self-host the full
product, free, forever. A future hosted control plane (team management, long
retention, SSO) is the paid layer. The free tier is the product, not the funnel.

## Roadmap

1. Multi-tenancy: per-user API keys, per-key budgets and rate limits (BYOK)
2. Provider breadth: first-class Anthropic, Gemini, Bedrock configs
3. Learned lane router (today: inspectable heuristic)
4. Hosted control plane beta
