import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(110deg,#151b26_30%,#1d2534_50%,#151b26_70%)] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}
