import { CopyButton } from "@/components/CopyButton";

export const dynamic = "force-dynamic";

const GW = "https://tokenroute-gateway.onrender.com";

const PYTHON_SNIPPET = `from openai import OpenAI
client = OpenAI(base_url="${GW}/v1", api_key="tr_...")
client.chat.completions.create(
  model="auto",          # or chat-local / chat-cloud / provider:model
  messages=[{"role": "user", "content": "hello"}],
)`;

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-edge bg-ink">
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-slate-300">{code}</pre>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-edge/60 pt-6 first:border-0 first:pt-0">
      <h2 className="text-base font-semibold text-slate-100">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

const code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded border border-edge bg-panel px-1.5 py-0.5 font-mono text-xs text-accent">{children}</code>
);

export default function DocsPage() {
  return (
    <div className="flex gap-10 py-6 sm:py-8">
      <div className="min-w-0 max-w-2xl flex-1">
        <div className="mb-8">
          <h1 className="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">Docs</h1>
          <p className="mt-1 text-sm text-muted">
            Everything below runs against the hosted gateway, right now. Prefer your own
            metal? TokenRoute is free and open source (Apache 2.0):{" "}
            <a href="https://github.com/rizvihasan/tokenroute" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              github.com/rizvihasan/tokenroute
            </a>
          </p>
        </div>

        <div className="flex flex-col gap-8">
          <Section id="get-a-key" title="1. Get a key">
            <p>
              Sign in with Google on the API Keys page and mint a key in seconds. Add a monthly
              spend cap if you want a hard stop - the gateway answers 402 the moment you hit it,
              never a surprise invoice. Prefer your own provider key? BYOK bills usage straight
              to your provider account.
            </p>
          </Section>

          <Section id="call-it" title="2. Call it">
            <p>Already using the OpenAI SDK? Change one line and keep everything else:</p>
            <CodeBlock code={PYTHON_SNIPPET} />
          </Section>

          <Section id="models" title="3. Model choices">
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>{code({ children: "auto" })} - the router reads the prompt and picks: easy ones take the cheap lane, hard ones get the strong models.</li>
              <li>{code({ children: "chat-local" })} / {code({ children: "chat-cloud" })} - force a lane.</li>
              <li>
                {code({ children: "provider:model" })} - explicit: {code({ children: "groq:openai/gpt-oss-120b" })},{" "}
                {code({ children: "openai:gpt-4o-mini" })}, {code({ children: "anthropic:claude-sonnet-4-5" })},{" "}
                {code({ children: "gemini:gemini-2.5-flash" })}. Explicit targets never fall back across providers.
              </li>
            </ul>
          </Section>

          <Section id="features" title="What you get on every call">
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>Semantic cache: repeat questions - even paraphrased - answered instantly for $0 (similarity threshold 0.92).</li>
              <li>Automatic fallback: if one lane stumbles, the other answers before you ever see an error.</li>
              <li>Live analytics: per-request cost, latency, and cache hits on the Analytics page.</li>
              <li>Function calling: pass {code({ children: "tools" })}/{code({ children: "tool_choice" })}; {code({ children: "tool_calls" })} stream back, tool-result messages work.</li>
              <li>Guardrails: injection filter + card-number redaction (hosted: log mode).</li>
              <li>MCP: POST /mcp with your key - {code({ children: "tokenroute_chat" })}, {code({ children: "tokenroute_usage" })} (metrics scope) for Claude/Cursor.</li>
            </ul>
          </Section>

          <Section id="errors" title="Errors">
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>
                {code({ children: "401" })} missing/revoked key - {code({ children: "402" })} monthly budget cap reached -{" "}
                {code({ children: "403" })} key lacks the scope - {code({ children: "429" })} rate limited.
              </li>
              <li>First call after 15 quiet minutes can take ~30-60s - the free tier naps.</li>
            </ul>
          </Section>
        </div>
      </div>

      <aside className="sticky top-20 hidden h-fit w-44 shrink-0 flex-col gap-2 lg:flex">
        <div className="text-xs font-medium uppercase tracking-wider text-faint">On this page</div>
        {[
          ["get-a-key", "Get a key"],
          ["call-it", "Call it"],
          ["models", "Model choices"],
          ["features", "Every call"],
          ["errors", "Errors"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="text-sm text-muted transition-colors hover:text-accent">
            {label}
          </a>
        ))}
      </aside>
    </div>
  );
}
