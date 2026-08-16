import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Loader2 } from "lucide-react";

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 font-heading">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ title, description, action, testId }) {
  return (
    <Card
      data-testid={testId}
      className="border-2 border-dashed border-slate-300 bg-transparent p-12 flex flex-col items-center text-center"
    >
      <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center">
        <Database className="h-6 w-6 text-slate-400" strokeWidth={1.75} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900 font-heading">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-500 max-w-md">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
    </div>
  );
}

export function SeedButton({ onClick, loading }) {
  return (
    <Button
      data-testid="empty-seed-btn"
      onClick={onClick}
      disabled={loading}
      className="bg-indigo-600 hover:bg-indigo-700"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Database className="h-4 w-4 mr-1.5" />}
      Seed Demo Data
    </Button>
  );
}
