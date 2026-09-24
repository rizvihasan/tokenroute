import { ConsoleDashboard } from "@/components/ConsoleDashboard";

export const dynamic = "force-dynamic";

export default function ConsolePage() {
  return (
    <div className="py-6">
      <h1 className="mb-1 text-lg font-semibold">Ops console</h1>
      <p className="mb-6 text-sm text-muted">
        Live view of the inference gateway: latency, throughput, cost, cache, and routing.
      </p>
      <ConsoleDashboard />
    </div>
  );
}
