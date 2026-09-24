"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readSSE, type DoneEvent, type MetaEvent } from "@/lib/sse";
import { Composer } from "./Composer";
import { MessageList, type Message } from "./MessageList";
import { Badge } from "./ui/badge";
import { LogoMark } from "./Logo";

const SUGGESTIONS = [
  "Explain semantic caching in one paragraph",
  "Is RAG better than fine-tuning?",
  "Write a haiku about load balancers",
  "Explain KV caching in transformers simply",
];

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [meta, setMeta] = useState<MetaEvent | null>(null);
  const [stats, setStats] = useState<DoneEvent | null>(null);
  const conversationId = useRef(`web-${Math.random().toString(36).slice(2, 10)}`);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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
            content: `Request failed: ${err instanceof Error ? err.message : String(err)}. The free-tier gateway may be waking up - try again.`,
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain py-6">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 animate-fade-up px-2">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="rounded-2xl border border-edge bg-panel p-3.5 shadow-glow">
                <LogoMark className="h-10 w-10" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
                  Easy prompts don't deserve{" "}
                  <span className="text-accent">premium prices.</span>
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-[15px]">
                  TokenRoute is one OpenAI-compatible endpoint that reads every request,
                  sends the easy ones down the cheap lane and the hard ones to the heavy
                  hitters - then answers repeat questions from a semantic cache for $0.
                  Every call reports its lane, latency, and cost. Ask something, then ask
                  it again in different words.
                </p>
              </div>
            </div>
            <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-edge bg-panel px-4 py-3 text-left text-sm text-muted transition-all hover:border-accent/40 hover:bg-panel-2 hover:text-slate-200"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge variant="accent">semantic cache</Badge>
              <Badge variant="muted">cost-aware routing</Badge>
              <Badge variant="muted">rag built in</Badge>
              <Badge variant="muted">live cost per call</Badge>
            </div>
          </div>
        ) : (
          <MessageList messages={messages} streaming={streaming} />
        )}
      </div>

      {(meta || stats) && (
        <div className="flex flex-wrap gap-1.5 pb-2">
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

      <div className="pb-4 pt-1">
        <Composer onSend={send} disabled={streaming} />
        <p className="mt-2 text-center text-[11px] text-faint">
          Free demo on a $5/month cap - Enter to send, Shift+Enter for a newline
        </p>
      </div>
    </div>
  );
}
