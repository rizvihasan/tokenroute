import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "outline" | "accent" | "success" | "warn" | "info" | "error" | "muted";

const VARIANTS: Record<Variant, string> = {
  outline: "border-edge text-muted",
  accent: "border-accent/40 bg-accent/10 text-accent",
  success: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  warn: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  info: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  error: "border-red-400/40 bg-red-400/10 text-red-300",
  muted: "border-edge bg-panel-2 text-muted",
};

export function Badge({
  className,
  variant = "outline",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
