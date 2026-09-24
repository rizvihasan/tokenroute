"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // clipboard unavailable (insecure context) - leave the text selectable
        }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-edge bg-panel-2 px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-edge-strong hover:text-slate-200"
    >
      {copied ? (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-accent"><path d="M20 6 9 17l-5-5" /></svg>
          Copied
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
          {label}
        </>
      )}
    </button>
  );
}
