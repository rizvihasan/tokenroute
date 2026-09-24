"use client";

import { useEffect, useRef, useState } from "react";

export function Composer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    setValue("");
    onSend(text);
  };

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-edge bg-panel p-2 shadow-card transition-colors focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/20">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        autoFocus
        placeholder="Ask something. Paraphrase an earlier question to watch the semantic cache hit."
        className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed text-slate-200 placeholder:text-faint focus:outline-none"
      />
      <button
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-ink shadow-glow transition-all hover:bg-accent-strong disabled:opacity-30 disabled:shadow-none"
      >
        {disabled ? (
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <path d="M12 19V5m-6 6 6-6 6 6" />
          </svg>
        )}
      </button>
    </div>
  );
}
