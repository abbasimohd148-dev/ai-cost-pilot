import { useEffect, useState, useCallback } from "react";
import { PageHeader, Loading, EmptyState } from "@/components/Common";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { usd, num, dt } from "@/lib/format";
import { ChevronLeft, ChevronRight } from "lucide-react";

const LIMIT = 25;

function StatusBadge({ status }) {
  const map = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    error: "bg-rose-50 text-rose-700 border-rose-200",
    timeout: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <Badge variant="outline" className={map[status] || "bg-slate-50 text-slate-600"}>
      {status}
    </Badge>
  );
}

export function Usage() {
  const { currentWorkspaceId } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const res = await api.get("/analytics/events", {
        params: { workspace_id: currentWorkspaceId, limit: LIMIT, offset: page * LIMIT },
      });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, page]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <Loading />;

  const events = data?.events || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / LIMIT);

  if (total === 0)
    return (
      <div>
        <PageHeader title="Usage" subtitle="Raw AI usage events ingested from your projects." />
        <EmptyState testId="usage-empty" title="No events" description="Seed demo data or send events to the ingestion API." />
      </div>
    );

  return (
    <div>
      <PageHeader title="Usage" subtitle={`${num(total)} events · newest first`} />
      <Card className="border-slate-200 overflow-hidden" data-testid="usage-table">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Timestamp</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead>Feature</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id} data-testid="usage-row" className="hover:bg-slate-50">
                  <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">{dt(e.timestamp)}</TableCell>
                  <TableCell className="font-medium">{e.provider}</TableCell>
                  <TableCell className="font-mono text-xs">{e.model}</TableCell>
                  <TableCell className="text-slate-600">{e.workflow || "—"}</TableCell>
                  <TableCell className="text-slate-600">{e.feature || "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{num(e.total_tokens)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{e.latency_ms == null ? "—" : `${num(e.latency_ms)}ms`}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold">{e.estimated_cost == null ? "unknown" : usd(e.estimated_cost, 5)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
          <span className="text-xs text-slate-500 font-mono">Page {page + 1} of {pages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" data-testid="usage-prev" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" data-testid="usage-next" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
