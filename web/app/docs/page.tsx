export const dynamic = "force-dynamic";

const GW = "https://tokenroute-gateway.onrender.com";

export default function DocsPage() {
  return (
    <div className="py-8 flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Docs</h1>
        <p className="text-muted text-sm mt-1">
          Everything below works on the hosted gateway. Self-hosting (free, Apache 2.0):
          github.com/rizvihasan/tokenroute.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">1. Get a key</h2>
        <p className="text-sm text-muted">
          Sign in with Google on the Keys page, create a key. Set a monthly budget cap if
          you want a hard stop; the gateway returns 402 when you hit it. Bring your own
          provider key (BYOK) and usage bills to your provider account instead.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">2. Call it</h2>
        <p className="text-sm text-muted">Any OpenAI SDK - change base_url, keep everything else:</p>
        <pre className="rounded-lg border border-edge bg-panel p-4 text-xs overflow-x-auto">{`from openai import OpenAI
client = OpenAI(base_url="${GW}/v1", api_key="tr_...")
client.chat.completions.create(
  model="auto",          # or chat-local / chat-cloud / provider:model
  messages=[{"role": "user", "content": "hello"}],
)`}</pre>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">3. Model choices</h2>
        <ul className="text-sm text-muted list-disc pl-5 flex flex-col gap-1">
          <li><code>auto</code> - router picks: easy prompts to the cheap lane, hard ones to the strong lane.</li>
          <li><code>chat-local</code> / <code>chat-cloud</code> - force a lane.</li>
          <li><code>provider:model</code> - explicit: <code>groq:openai/gpt-oss-120b</code>, <code>openai:gpt-4o-mini</code>, <code>anthropic:claude-sonnet-4-5</code>, <code>gemini:gemini-2.5-flash</code>. Explicit targets never fall back across providers.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">What you get on every call</h2>
        <ul className="text-sm text-muted list-disc pl-5 flex flex-col gap-1">
          <li>Semantic cache: paraphrased repeat questions answered for $0 (similarity threshold 0.92).</li>
          <li>Fallback: a failed lane retries on the other lane before erroring.</li>
          <li>Live analytics: per-request cost, latency, cache hits on the Analytics page.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Errors</h2>
        <ul className="text-sm text-muted list-disc pl-5 flex flex-col gap-1">
          <li><code>401</code> missing/revoked key - <code>402</code> monthly budget cap reached - <code>429</code> rate limited.</li>
          <li>First call after 15 min idle can take ~30-60s (free-tier cold start).</li>
        </ul>
      </section>
    </div>
  );
}
