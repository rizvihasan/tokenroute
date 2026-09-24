"use client";

import { useState } from "react";

export function Composer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    setValue("");
    onSend(text);
  };

  return (
    <div className="sticky bottom-4 flex gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={2}
        placeholder="Ask something. Paraphrase an earlier question to watch the semantic cache hit."
        className="flex-1 resize-none rounded-lg border border-edge bg-panel px-3 py-2 text-sm outline-none focus:border-accent/60"
      />
      <button
        onClick={submit}
        disabled={disabled}
        className="self-end rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
      >
        Send
      </button>
    </div>
  );
}
