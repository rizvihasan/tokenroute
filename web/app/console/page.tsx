import { ConsoleDashboard } from "@/components/ConsoleDashboard";

export const dynamic = "force-dynamic";

export default function ConsolePage() {
  return (
    <div className="py-6">
      <h1 className="mb-1 text-lg font-semibold">Analytics</h1>
      <p className="mb-6 text-sm text-muted">
        Everything the gateway has done lately: routing decisions, cache hits,
        latency, throughput, and cost - live.
      </p>
      <ConsoleDashboard />
    </div>
  );
}
