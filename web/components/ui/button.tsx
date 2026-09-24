import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-ink font-semibold hover:bg-accent-strong shadow-glow disabled:hover:bg-accent",
  secondary:
    "border border-edge bg-panel-2 text-slate-200 hover:border-edge-strong hover:bg-panel",
  ghost: "text-muted hover:text-slate-200 hover:bg-panel-2",
  destructive: "text-red-400 hover:bg-red-400/10 hover:text-red-300",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-md gap-1.5",
  md: "h-10 px-4 text-sm rounded-lg gap-2",
  lg: "h-11 px-6 text-sm rounded-lg gap-2",
  icon: "h-9 w-9 rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
        "disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
