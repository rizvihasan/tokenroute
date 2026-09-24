import { ConsoleDashboard } from "@/components/ConsoleDashboard";

export const dynamic = "force-dynamic";

export default function ConsolePage() {
  return (
    <div className="py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">Analytics</h1>
        <p className="mt-1 text-sm text-muted">
          Routing decisions, cache hits, latency, throughput, and cost for every
          request the gateway serves. Updated live.
        </p>
      </div>
      <ConsoleDashboard />
    </div>
  );
}
