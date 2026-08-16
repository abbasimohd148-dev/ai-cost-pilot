import { PageHeader, Loading, EmptyState } from "@/components/Common";
import { BreakdownCard } from "@/components/BreakdownCard";
import { SpendAreaChart } from "@/components/Charts";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { useScopedData } from "@/hooks/useScopedData";
import { usd, num } from "@/lib/format";
import { DollarSign, Activity, Layers } from "lucide-react";

export function Costs() {
  const { data: ov, loading } = useScopedData("/analytics/overview");
  const { data: byProvider } = useScopedData("/analytics/breakdown", { extraParams: { dimension: "provider" } });
  const { data: byModel } = useScopedData("/analytics/breakdown", { extraParams: { dimension: "model" } });
  const { data: byWorkflow } = useScopedData("/analytics/breakdown", { extraParams: { dimension: "workflow" } });
  const { data: byFeature } = useScopedData("/analytics/breakdown", { extraParams: { dimension: "feature" } });
  const { data: ts } = useScopedData("/analytics/timeseries");

  if (loading && !ov) return <Loading />;
  if (ov && ov.total_requests === 0)
    return (
      <div>
        <PageHeader title="Costs" subtitle="Cost breakdown by provider, model, workflow and feature." />
        <EmptyState testId="costs-empty" title="No cost data" description="Seed demo data or ingest events to see cost breakdowns." />
      </div>
    );

  return (
    <div>
      <PageHeader title="Costs" subtitle="Cost breakdown by provider, model, workflow and feature." />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <StatCard testId="cost-total" label="Total Spend" value={usd(ov?.total_spend, 2)} icon={DollarSign} />
        <StatCard testId="cost-requests" label="Requests" value={num(ov?.total_requests)} icon={Activity} accent="bg-sky-50 text-sky-600" />
        <StatCard testId="cost-avg" label="Avg Cost / Request" value={usd(ov?.avg_cost_per_request, 4)} icon={Layers} accent="bg-amber-50 text-amber-600" />
      </div>

      <Card className="p-5 md:p-6 border-slate-200 mt-6" data-testid="cost-spend-chart">
        <h3 className="text-base font-semibold tracking-tight text-slate-900 font-heading">Spend over time</h3>
        <div className="mt-4">
          <SpendAreaChart data={ts || []} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-6">
        <BreakdownCard testId="breakdown-provider" title="Spend by provider" data={byProvider} />
        <BreakdownCard testId="breakdown-model" title="Spend by model" data={byModel} />
        <BreakdownCard testId="breakdown-workflow" title="Spend by workflow" data={byWorkflow} />
        <BreakdownCard testId="breakdown-feature" title="Spend by feature" data={byFeature} />
      </div>
    </div>
  );
}
