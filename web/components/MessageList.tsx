import Markdown from "react-markdown";
import { cn } from "@/lib/utils";

export interface Message {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

const MD_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-slate-100">{children}</strong>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="mb-1">{children}</li>,
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) =>
    className ? (
      <code className="block overflow-x-auto rounded-lg border border-edge bg-ink p-3 font-mono text-xs leading-relaxed">{children}</code>
    ) : (
      <code className="rounded border border-edge bg-ink px-1.5 py-0.5 font-mono text-[13px] text-accent">{children}</code>
    ),
  pre: ({ children }: { children?: React.ReactNode }) => <div className="mb-2 last:mb-0">{children}</div>,
  h1: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 font-semibold text-slate-100">{children}</p>,
  h2: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 font-semibold text-slate-100">{children}</p>,
  h3: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 font-semibold text-slate-100">{children}</p>,
};

export function MessageList({ messages, streaming }: { messages: Message[]; streaming: boolean }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-2" role="log" aria-live="polite" aria-label="Conversation">
      {messages.map((m, i) => {
        const isUser = m.role === "user";
        const isLast = i === messages.length - 1;
        return (
          <div key={i} className={cn("flex animate-fade-up", isUser ? "justify-end" : "justify-start")}>
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
              <span className="sr-only">{isUser ? "You said: " : "TokenRoute said: "}</span>
              {isUser ? (
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
              ) : (
                <div className="break-words">
                  <Markdown components={MD_COMPONENTS}>{m.content}</Markdown>
                  {streaming && isLast && (
                    <span className="ml-0.5 inline-block h-4 w-[7px] translate-y-[3px] animate-pulse-dot rounded-[2px] bg-accent" />
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
