"use client";

import { useCallback, useRef, useState } from "react";
import { readSSE, type DoneEvent, type MetaEvent } from "@/lib/sse";
import { Composer } from "./Composer";
import { MessageList, type Message } from "./MessageList";

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [meta, setMeta] = useState<MetaEvent | null>(null);
  const [stats, setStats] = useState<DoneEvent | null>(null);
  const conversationId = useRef(`web-${Math.random().toString(36).slice(2, 10)}`);

  const send = useCallback(async (text: string) => {
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
            next[next.length - 1] = { role: "assistant", content: `Error: ${event.data.message}` };
            return next;
          });
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: `Request failed: ${err instanceof Error ? err.message : String(err)}`,
        };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }, [messages]);

  return (
    <div className="flex flex-col gap-4">
      {(meta || stats) && (
        <div className="flex flex-wrap gap-2 text-xs font-mono text-muted">
          {meta && (
            <span className="rounded border border-edge bg-panel px-2 py-1">
              lane: <span className="text-accent">{meta.lane}</span> · {meta.model}
              {meta.similarity ? ` · sim ${meta.similarity}` : ""}
            </span>
          )}
          {meta?.contexts && meta.contexts.length > 0 && (
            <span className="rounded border border-edge bg-panel px-2 py-1">
              rag: {meta.contexts.map((c) => c.doc_id).join(", ")}
            </span>
          )}
          {stats && (
            <span className="rounded border border-edge bg-panel px-2 py-1">
              {stats.ttft_ms != null ? `ttft ${stats.ttft_ms}ms · ` : ""}
              {stats.tokens_out} tok{stats.tokens_per_sec ? ` · ${stats.tokens_per_sec} tok/s` : ""}
              {` · $${stats.cost_usd.toFixed(6)}`}
            </span>
          )}
        </div>
      )}
      <MessageList messages={messages} streaming={streaming} />
      <Composer onSend={send} disabled={streaming} />
    </div>
  );
}
