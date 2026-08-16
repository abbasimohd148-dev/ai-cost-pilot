import { Card } from "@/components/ui/card";
import { usd, num } from "@/lib/format";

const BAR_COLORS = ["#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#F43F5E", "#8B5CF6", "#14B8A6"];

export function BreakdownCard({ title, data, testId }) {
  const max = Math.max(...(data || []).map((d) => d.spend), 0.0000001);
  return (
    <Card data-testid={testId} className="p-5 md:p-6 border-slate-200">
      <h3 className="text-base font-semibold tracking-tight text-slate-900 font-heading">{title}</h3>
      <div className="mt-4 space-y-3">
        {(!data || data.length === 0) && (
          <p className="text-sm text-slate-400">No data in this range.</p>
        )}
        {(data || []).map((row, i) => (
          <div key={row.key} data-testid={`${testId}-row`}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono text-slate-700 truncate max-w-[60%]">{row.key}</span>
              <span className="font-semibold text-slate-900">{usd(row.spend, 2)}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${(row.spend / max) * 100}%`,
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                }}
              />
            </div>
            <div className="mt-1 text-xs text-slate-400 font-mono">
              {num(row.requests)} req · {num(row.tokens)} tokens
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
