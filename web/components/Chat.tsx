"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readSSE, type DoneEvent, type MetaEvent } from "@/lib/sse";
import { Composer } from "./Composer";
import { MessageList, type Message } from "./MessageList";
import { Badge } from "./ui/badge";
import { LogoMark } from "./Logo";

const EXAMPLES = [
  "Explain semantic caching in one paragraph",
  "Is RAG better than fine-tuning?",
  "Explain KV caching in transformers simply",
];

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [meta, setMeta] = useState<MetaEvent | null>(null);
  const [stats, setStats] = useState<DoneEvent | null>(null);
  const conversationId = useRef(`web-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      const userMsg: Message = { role: "user", content: text };
      const history = [...messages, userMsg];
      setMessages([...history, { role: "assistant", content: "" }]);
      setStreaming(true);
      setMeta(null);
      setStats(null);

      try {
        const resp = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversationId.current,
            messages: history.map(({ role, content }) => ({ role, content })),
          }),
        });
        if (!resp.ok || !resp.body) {
          throw new Error(`gateway returned ${resp.status}`);
        }

        for await (const event of readSSE(resp.body)) {
          if (event.type === "meta") setMeta(event.data);
          else if (event.type === "done") setStats(event.data);
          else if (event.type === "token") {
            const token = event.data.token;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = { ...last, content: last.content + token };
              return next;
            });
          } else if (event.type === "error") {
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = {
                role: "assistant",
                content: `Error: ${event.data.message}`,
                error: true,
              };
              return next;
            });
          }
        }
      } catch (err) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: `Couldn't reach the gateway (${err instanceof Error ? err.message : String(err)}). The hosted demo sleeps after 15 minutes idle - retry in a few seconds.`,
            error: true,
          };
          return next;
        });
      } finally {
        setStreaming(false);
      }
    },
    [messages],
  );

  const empty = messages.length === 0;

  return (
    <div className="flex flex-1 flex-col">
      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-2 py-10">
          <div className="flex max-w-2xl flex-col items-center gap-5 text-center">
            <LogoMark className="h-10 w-10" />
            <h1 className="text-2xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
              The gateway between your app{" "}
              <span className="text-accent">and every LLM.</span>
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              One endpoint for every provider. TokenRoute routes each prompt to the
              cheapest lane that can answer it well, serves repeats from a semantic
              cache, and reports lane, latency, and cost on every call.
            </p>
          </div>
          <div className="w-full max-w-xl">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-faint">
              Try an example
            </div>
            <div className="flex flex-col gap-2">
              {EXAMPLES.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-edge bg-panel px-4 py-3 text-left text-sm text-slate-300 transition-colors hover:border-edge-strong hover:bg-panel-2"
                >
                  {s}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-accent"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14m-6-6 6 6-6 6" />
                  </svg>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-faint">
              Ask one, then rephrase it and ask again - the second answer comes back
              from the semantic cache, free.
            </p>
          </div>
        </div>
      ) : (
        <div className="py-6">
          <MessageList messages={messages} streaming={streaming} />
        </div>
      )}

      <div className="sticky bottom-0 mt-auto border-t border-edge/60 bg-ink/95 pb-4 pt-3 backdrop-blur-sm">
        {(meta || stats) && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {meta && (
              <Badge variant={meta.lane === "cache" ? "info" : meta.lane === "cloud" ? "warn" : "success"}>
                {meta.lane}
                <span className="font-sans normal-case tracking-normal opacity-80">
                  {meta.model}
                  {meta.similarity ? ` - sim ${meta.similarity.toFixed(2)}` : ""}
                </span>
              </Badge>
            )}
            {meta?.contexts && meta.contexts.length > 0 && (
              <Badge variant="accent">rag: {meta.contexts.map((c) => c.doc_id).join(", ")}</Badge>
            )}
            {stats &&
              (meta?.lane === "cache" || stats.tokens_out === 0 ? (
                <Badge variant="info">served from cache - $0</Badge>
              ) : (
                <Badge variant="outline">
                  <span className="font-sans normal-case tracking-normal">
                    {stats.ttft_ms != null ? `ttft ${Math.round(stats.ttft_ms)}ms - ` : ""}
                    {stats.tokens_out} tok
                    {stats.tokens_per_sec ? ` - ${Math.round(stats.tokens_per_sec)} tok/s` : ""}
                    {` - $${stats.cost_usd.toFixed(6)}`}
                  </span>
                </Badge>
              ))}
          </div>
        )}
        <Composer onSend={send} disabled={streaming} />
        <p className="mt-2 text-center text-[11px] text-faint">
          Hosted demo - $5/month cap
        </p>
      </div>
    </div>
  );
}
