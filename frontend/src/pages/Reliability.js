import { PageHeader, Loading, EmptyState } from "@/components/Common";
import { StatCard } from "@/components/StatCard";
import { ErrorTrendChart } from "@/components/Charts";
import { Card } from "@/components/ui/card";
import { useScopedData } from "@/hooks/useScopedData";
import { pct, num } from "@/lib/format";
import { ShieldCheck, AlertTriangle, Timer, Gauge } from "lucide-react";

function FailTable({ title, rows, testId }) {
  return (
    <Card className="p-5 md:p-6 border-slate-200" data-testid={testId}>
      <h3 className="text-base font-semibold tracking-tight text-slate-900 font-heading">{title}</h3>
      <div className="mt-4 space-y-2">
        {(!rows || rows.length === 0) && <p className="text-sm text-slate-400">No failures.</p>}
        {(rows || []).map((r) => (
          <div key={r.key} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 last:border-0">
            <span className="font-mono text-slate-700">{r.key}</span>
            <span className="font-semibold text-rose-600">{num(r.failures)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Reliability() {
  const { data, loading } = useScopedData("/reliability/overview");

  if (loading && !data) return <Loading />;
  if (data && data.total_requests === 0)
    return (
      <div>
        <PageHeader title="Reliability" subtitle="Success, errors and latency across your AI requests." />
        <EmptyState testId="reliability-empty" title="No reliability data" description="Seed demo data or ingest events to see reliability analytics." />
      </div>
    );

  return (
    <div>
      <PageHeader title="Reliability" subtitle="Success, errors and latency across your AI requests." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard testId="rel-success" label="Success Rate" value={pct(data?.success_rate)} icon={ShieldCheck} accent="bg-emerald-50 text-emerald-600" />
        <StatCard testId="rel-error" label="Error Rate" value={pct(data?.error_rate)} icon={AlertTriangle} accent="bg-rose-50 text-rose-600" sub={`${num(data?.error_count)} errors`} />
        <StatCard testId="rel-timeouts" label="Timeouts" value={num(data?.timeout_count)} icon={Timer} accent="bg-amber-50 text-amber-600" />
        <StatCard testId="rel-avglat" label="Avg Latency" value={`${num(data?.avg_latency_ms)} ms`} icon={Gauge} accent="bg-sky-50 text-sky-600" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-6">
        <StatCard testId="rel-p50" label="p50 Latency" value={`${num(data?.p50_latency_ms)} ms`} />
        <StatCard testId="rel-p95" label="p95 Latency" value={`${num(data?.p95_latency_ms)} ms`} accent="bg-amber-50 text-amber-600" />
        <StatCard testId="rel-p99" label="p99 Latency" value={data?.p99_latency_ms == null ? "n/a" : `${num(data?.p99_latency_ms)} ms`} accent="bg-rose-50 text-rose-600" sub={data?.p99_latency_ms == null ? "Need ≥100 requests" : undefined} />
        <StatCard testId="rel-ratelimit" label="Rate-limit Errors" value={num(data?.rate_limit_count)} />
      </div>

      <Card className="p-5 md:p-6 border-slate-200 mt-6" data-testid="rel-trend">
        <h3 className="text-base font-semibold tracking-tight text-slate-900 font-heading">Error trend</h3>
        <div className="mt-4">
          <ErrorTrendChart data={data?.error_trend || []} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mt-6">
        <FailTable testId="fail-provider" title="Failures by provider" rows={data?.failures_by_provider} />
        <FailTable testId="fail-model" title="Failures by model" rows={data?.failures_by_model} />
        <FailTable testId="fail-workflow" title="Failures by workflow" rows={data?.failures_by_workflow} />
      </div>
    </div>
  );
}
