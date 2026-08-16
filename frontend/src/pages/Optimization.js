import { PageHeader } from "@/components/Common";
import { Card } from "@/components/ui/card";
import { Sparkles, TrendingDown, RefreshCw, AlertCircle, Gauge } from "lucide-react";

const FUTURE = [
  { icon: TrendingDown, title: "Premium model overuse", desc: "Detect when premium models handle requests a cheaper model could serve." },
  { icon: RefreshCw, title: "Excessive retries", desc: "Surface retry storms inflating spend and latency." },
  { icon: AlertCircle, title: "Cost anomalies", desc: "Flag unexpected cost spikes and token growth." },
  { icon: Gauge, title: "Reliability degradation", desc: "Correlate rising error rates and latency with models and providers." },
];

export function Optimization() {
  return (
    <div>
      <PageHeader title="Optimization" subtitle="Actionable cost intelligence derived from your real usage data." />
      <Card className="border-2 border-dashed border-slate-300 bg-transparent p-12 flex flex-col items-center text-center" data-testid="optimization-placeholder">
        <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
          <Sparkles className="h-7 w-7 text-indigo-600" strokeWidth={1.75} />
        </div>
        <h3 className="mt-5 text-xl font-bold text-slate-900 font-heading">
          Optimization intelligence is being prepared from your usage data.
        </h3>
        <p className="mt-2 text-sm text-slate-500 max-w-lg">
          As your projects ingest more events, the optimization engine will analyze normalized usage
          to identify concrete savings opportunities — with evidence and confidence, never fake findings.
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-6">
        {FUTURE.map((f) => (
          <Card key={f.title} className="p-5 border-slate-200 opacity-80">
            <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
              <f.icon className="h-5 w-5 text-slate-500" strokeWidth={2} />
            </div>
            <h4 className="mt-3 text-sm font-semibold text-slate-900 font-heading">{f.title}</h4>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">{f.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
