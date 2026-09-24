export interface Message {
  role: "user" | "assistant";
  content: string;
}

export function MessageList({ messages, streaming }: { messages: Message[]; streaming: boolean }) {
  if (messages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-edge p-8 text-center text-sm text-muted">
        <p className="mb-2 font-medium text-slate-300">TokenRoute demo chat</p>
        <p>
          Answers route between a local quantized model and a cloud fallback, with a
          semantic cache in front. Every request reports its lane, TTFT, token
          throughput, and cost above.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 pb-2">
      {messages.map((m, i) => (
        <div
          key={i}
          className={
            m.role === "user"
              ? "self-end max-w-[80%] rounded-lg bg-accent/10 border border-accent/20 px-3 py-2 text-sm"
              : "self-start max-w-[80%] rounded-lg bg-panel border border-edge px-3 py-2 text-sm"
          }
        >
          <div className="whitespace-pre-wrap leading-relaxed">
            {m.content}
            {streaming && m.role === "assistant" && i === messages.length - 1 && (
              <span className="inline-block w-2 animate-pulse text-accent">▍</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
