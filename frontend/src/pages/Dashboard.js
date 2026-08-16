import { useState } from "react";
import { StatCard } from "@/components/StatCard";
import { PageHeader, EmptyState, Loading, SeedButton } from "@/components/Common";
import { SpendAreaChart, RequestsErrorsChart } from "@/components/Charts";
import { Card } from "@/components/ui/card";
import { useScopedData } from "@/hooks/useScopedData";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";
import { usd, num, compact, pct } from "@/lib/format";
import { DollarSign, Activity, Layers, Receipt, CheckCircle2, Sparkles } from "lucide-react";

export function Dashboard() {
  const { currentWorkspaceId, refresh } = useAuth();
  const { data: ov, loading, reload } = useScopedData("/analytics/overview");
  const { data: ts, reload: reloadTs } = useScopedData("/analytics/timeseries");
  const [seeding, setSeeding] = useState(false);

  const seed = async () => {
    setSeeding(true);
    try {
      const { data } = await api.post(`/seed/demo?workspace_id=${currentWorkspaceId}`);
      toast.success(`Seeded ${data.events_created} demo events`);
      refresh();
      reload();
      reloadTs();
    } catch (e) {
      toast.error("Seed failed", { description: e?.response?.data?.detail || e.message });
    } finally {
      setSeeding(false);
    }
  };

  if (loading && !ov) return <Loading />;

  const empty = ov && ov.total_requests === 0;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Real-time overview of your AI spend and reliability." />
      {empty ? (
        <EmptyState
          testId="dashboard-empty"
          title="No usage events yet"
          description="Send events to the ingestion API from your app, or seed realistic demo data to explore the dashboards."
          action={<SeedButton onClick={seed} loading={seeding} />}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <StatCard testId="kpi-spend" label="Total AI Spend" value={usd(ov.total_spend, 2)} icon={DollarSign} sub={`${ov.currency}`} />
            <StatCard testId="kpi-requests" label="Requests" value={num(ov.total_requests)} icon={Activity} accent="bg-sky-50 text-sky-600" />
            <StatCard testId="kpi-tokens" label="Total Tokens" value={compact(ov.total_tokens)} icon={Layers} accent="bg-emerald-50 text-emerald-600" sub={`${compact(ov.total_input_tokens)} in · ${compact(ov.total_output_tokens)} out`} />
            <StatCard testId="kpi-avg-cost" label="Avg Cost / Request" value={usd(ov.avg_cost_per_request, 4)} icon={Receipt} accent="bg-amber-50 text-amber-600" />
            <StatCard testId="kpi-success" label="Success Rate" value={pct(ov.success_rate)} icon={CheckCircle2} accent="bg-emerald-50 text-emerald-600" sub={`${pct(ov.error_rate)} errors`} />
            <StatCard testId="kpi-savings" label="Potential Savings" value="—" icon={Sparkles} accent="bg-indigo-50 text-indigo-600" sub="Being prepared from your usage data" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-6">
            <Card className="p-5 md:p-6 border-slate-200" data-testid="chart-spend">
              <h3 className="text-base font-semibold tracking-tight text-slate-900 font-heading">Spend over time</h3>
              <div className="mt-4">
                <SpendAreaChart data={ts || []} />
              </div>
            </Card>
            <Card className="p-5 md:p-6 border-slate-200" data-testid="chart-requests">
              <h3 className="text-base font-semibold tracking-tight text-slate-900 font-heading">Requests & errors over time</h3>
              <div className="mt-4">
                <RequestsErrorsChart data={ts || []} />
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
