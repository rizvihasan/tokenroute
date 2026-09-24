import { cn } from "@/lib/utils";

export interface Message {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

export function MessageList({ messages, streaming }: { messages: Message[]; streaming: boolean }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-2" role="log" aria-live="polite" aria-label="Conversation">
      {messages.map((m, i) => {
        const isUser = m.role === "user";
        const isLast = i === messages.length - 1;
        return (
          <div
            key={i}
            className={cn("flex animate-fade-up", isUser ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed sm:max-w-[75%]",
                isUser
                  ? "rounded-br-md border border-accent/25 bg-accent/10 text-slate-100"
                  : m.error
                    ? "rounded-bl-md border border-red-400/30 bg-red-400/5 text-red-200"
                    : "rounded-bl-md border border-edge bg-panel text-slate-200",
              )}
            >
              <div className="whitespace-pre-wrap break-words">
                {m.content}
                {streaming && !isUser && isLast && (
                  <span className="ml-0.5 inline-block h-4 w-[7px] translate-y-[3px] animate-pulse-dot rounded-[2px] bg-accent" />
                )}
              </div>
              <span className="sr-only">{isUser ? "You said: " : "TokenRoute said: "}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
