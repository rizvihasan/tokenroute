# Contributing

Issues and PRs welcome. The bar is the same one the repo holds itself to:

- `make test` passes (gateway unit tests need no services)
- `cd web && npm run typecheck && npm run build` passes
- No new dependency without a reason in the PR description
- Degrade, don't die: a failing dependency must never become a bare 500

Good first contributions: provider configs (Anthropic, Gemini, Bedrock),
a learned lane router, cache backends (pgvector / Redis vector search).
