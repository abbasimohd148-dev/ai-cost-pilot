import { PageHeader, Loading } from "@/components/Common";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useScopedData } from "@/hooks/useScopedData";
import { usd, num, pct } from "@/lib/format";
import {
  Sparkles,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  Coins,
  Gauge,
} from "lucide-react";

const SEVERITY = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-sky-50 text-sky-700 border-sky-200",
};

function ConfidenceBar({ value }) {
  const p = Math.round((value || 0) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-indigo-600" style={{ width: `${p}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-600">{p}%</span>
    </div>
  );
}

function EvidenceRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-800">{value}</span>
    </div>
  );
}

function FindingCard({ f }) {
  return (
    <Card className="p-5 md:p-6 border-slate-200" data-testid="finding-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={SEVERITY[f.severity] || "bg-slate-50"} data-testid="finding-severity">
            {f.severity} severity
          </Badge>
          <span className="text-xs uppercase tracking-[0.15em] font-bold text-slate-400">
            Premium model overuse
          </span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-600 font-heading" data-testid="finding-savings">
            {usd(f.potential_savings, 2)}
          </div>
          <div className="text-xs text-slate-500">est. savings · {pct(f.savings_percent)}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-slate-900">{f.workflow || "unknown"}</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-600">{f.feature || "unknown"}</span>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 p-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Currently using</div>
          <div className="font-mono text-sm text-slate-900 truncate" data-testid="finding-expensive-model">
            {f.expensive_model.provider}/{f.expensive_model.model}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-indigo-500 shrink-0" />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Recommended</div>
          <div className="font-mono text-sm text-indigo-700 truncate" data-testid="finding-recommended-model">
            {f.recommended_model.provider}/{f.recommended_model.model}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Affected</div>
          <div className="text-sm font-semibold text-slate-900 font-mono">{num(f.affected_requests)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Current cost</div>
          <div className="text-sm font-semibold text-slate-900 font-mono">{usd(f.current_cost, 2)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Replacement</div>
          <div className="text-sm font-semibold text-slate-900 font-mono">{usd(f.estimated_replacement_cost, 2)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Confidence</div>
          <ConfidenceBar value={f.confidence} />
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-slate-400" /> Evidence
        </div>
        <p className="text-xs text-slate-500 mb-2 leading-relaxed">{f.evidence.reason}</p>
        <div className="rounded-lg border border-slate-200 px-3">
          <EvidenceRow label="Affected requests" value={num(f.evidence.affected_request_count)} />
          <EvidenceRow label="Expensive model success" value={pct(f.evidence.expensive_model_success_rate)} />
          <EvidenceRow label="Cheaper model success" value={pct(f.evidence.cheaper_model_success_rate)} />
          <EvidenceRow label="Cheaper model observed reqs" value={num(f.evidence.cheaper_model_observed_requests)} />
          <EvidenceRow label="Avg input / output tokens" value={`${num(f.evidence.avg_input_tokens)} / ${num(f.evidence.avg_output_tokens)}`} />
        </div>
      </div>
    </Card>
  );
}

export function Optimization() {
  const { data, loading } = useScopedData("/optimization/findings");

  if (loading && !data) return <Loading />;

  const findings = data?.findings || [];
  const count = data?.finding_count || 0;

  return (
    <div>
      <PageHeader
        title="Optimization"
        subtitle="Deterministic, evidence-backed cost intelligence from your real usage data."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6">
        <Card className="p-5 md:p-6 border-slate-200" data-testid="opt-total-savings">
          <div className="flex items-start justify-between">
            <span className="text-xs uppercase tracking-[0.15em] font-bold text-slate-500">
              Potential Savings (range)
            </span>
            <span className="rounded-md p-1.5 bg-emerald-50 text-emerald-600">
              <Coins className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-emerald-600 font-heading">
            {usd(data?.potential_savings, 2)}
          </div>
        </Card>
        <Card className="p-5 md:p-6 border-slate-200" data-testid="opt-finding-count">
          <div className="flex items-start justify-between">
            <span className="text-xs uppercase tracking-[0.15em] font-bold text-slate-500">Findings</span>
            <span className="rounded-md p-1.5 bg-indigo-50 text-indigo-600">
              <TrendingDown className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900 font-heading">{num(count)}</div>
        </Card>
        <Card className="p-5 md:p-6 border-slate-200" data-testid="opt-detector">
          <div className="flex items-start justify-between">
            <span className="text-xs uppercase tracking-[0.15em] font-bold text-slate-500">Detector</span>
            <span className="rounded-md p-1.5 bg-slate-100 text-slate-500">
              <Gauge className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 text-base font-semibold text-slate-900 font-heading">Premium Model Overuse v1</div>
          <div className="mt-1 text-xs text-slate-500">Uses production pricing only · never demo</div>
        </Card>
      </div>

      {count === 0 ? (
        <Card
          className="border-2 border-dashed border-slate-300 bg-transparent p-12 flex flex-col items-center text-center"
          data-testid="optimization-empty"
        >
          <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Sparkles className="h-7 w-7 text-slate-400" strokeWidth={1.75} />
          </div>
          <h3 className="mt-5 text-lg font-bold text-slate-900 font-heading">
            No evidence-backed optimization opportunities found for this period.
          </h3>
          <p className="mt-2 text-sm text-slate-500 max-w-lg">
            {data && data.has_production_pricing === false
              ? "Findings require verified production pricing (is_demo=false). The current pricing table contains only illustrative demo pricing, which is intentionally never used to calculate savings."
              : "As more usage accumulates, the detector will surface premium-model overuse with affected requests, estimated savings, confidence and supporting evidence — never fabricated."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6" data-testid="findings-list">
          {findings.map((f) => (
            <FindingCard key={f.id} f={f} />
          ))}
        </div>
      )}
    </div>
  );
}
