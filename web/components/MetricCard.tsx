import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-edge bg-panel p-4 shadow-card transition-colors hover:border-edge-strong", className)}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-faint">{label}</div>
      <div className="mt-1.5 truncate font-mono text-xl font-medium text-slate-100 sm:text-2xl">{value}</div>
      {hint && <div className="mt-1 truncate text-xs text-muted" title={hint}>{hint}</div>}
    </div>
  );
}
