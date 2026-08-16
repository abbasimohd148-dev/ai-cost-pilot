import { Card } from "@/components/ui/card";

export function StatCard({ label, value, sub, icon: Icon, accent, testId }) {
  return (
    <Card
      data-testid={testId}
      className="p-5 md:p-6 border-slate-200 hover:shadow-sm hover:-translate-y-px transition-[box-shadow,transform] duration-200"
    >
      <div className="flex items-start justify-between">
        <span className="text-xs uppercase tracking-[0.15em] font-bold text-slate-500">
          {label}
        </span>
        {Icon && (
          <span className={`rounded-md p-1.5 ${accent || "bg-indigo-50 text-indigo-600"}`}>
            <Icon className="h-4 w-4" strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900 font-heading">
        {value}
      </div>
      {sub && <div className="mt-1 text-sm text-slate-500">{sub}</div>}
    </Card>
  );
}
