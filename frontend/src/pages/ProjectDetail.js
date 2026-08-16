import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loading, PageHeader } from "@/components/Common";
import { StatCard } from "@/components/StatCard";
import { BreakdownCard } from "@/components/BreakdownCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import api from "@/lib/api";
import { API } from "@/lib/api";
import { usd, num, dt } from "@/lib/format";
import { toast } from "sonner";
import {
  ChevronLeft,
  Plus,
  Copy,
  Check,
  KeyRound,
  Loader2,
  AlertTriangle,
  Ban,
} from "lucide-react";

function ApiKeysTab({ projectId }) {
  const [keys, setKeys] = useState(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get(`/projects/${projectId}/api-keys`);
    setKeys(res.data);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) return toast.error("Key name is required");
    setCreating(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/api-keys`, { name });
      setNewKey(data);
      setCreateOpen(false);
      setName("");
      load();
    } catch (e) {
      toast.error("Failed to create key", { description: e?.response?.data?.detail || e.message });
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id) => {
    try {
      await api.post(`/api-keys/${id}/revoke`);
      toast.success("Key revoked");
      load();
    } catch (e) {
      toast.error("Failed to revoke", { description: e?.response?.data?.detail || e.message });
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(newKey.api_key);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  if (keys === null) return <Loading />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-slate-500">Keys authenticate event ingestion for this project.</p>
        <Button data-testid="create-key-btn" onClick={() => setCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-1.5" /> Create API Key
        </Button>
      </div>

      <Card className="border-slate-200 overflow-hidden" data-testid="api-keys-table">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-slate-400 py-8">
                  No API keys yet.
                </TableCell>
              </TableRow>
            )}
            {keys.map((k) => (
              <TableRow key={k.id} data-testid="api-key-row">
                <TableCell className="font-medium">{k.name}</TableCell>
                <TableCell className="font-mono text-xs text-slate-500">{k.key_prefix}••••••••</TableCell>
                <TableCell className="text-xs text-slate-500">{k.last_used_at ? dt(k.last_used_at) : "never"}</TableCell>
                <TableCell className="text-xs text-slate-500">{dt(k.created_at)}</TableCell>
                <TableCell>
                  {k.revoked_at ? (
                    <Badge variant="outline" className="bg-slate-100 text-slate-500">revoked</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">active</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {!k.revoked_at && (
                    <Button variant="ghost" size="sm" data-testid={`revoke-key-${k.id}`} onClick={() => revoke(k.id)} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                      <Ban className="h-4 w-4 mr-1" /> Revoke
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Create API key</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>Key name</Label>
            <Input data-testid="key-name-input" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" placeholder="Production server" />
          </div>
          <DialogFooter>
            <Button data-testid="key-create-submit" onClick={create} disabled={creating} className="bg-indigo-600 hover:bg-indigo-700">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal-once dialog */}
      <Dialog open={!!newKey} onOpenChange={(o) => !o && setNewKey(null)}>
        <DialogContent className="rounded-2xl" data-testid="reveal-key-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Your new API key</DialogTitle>
            <DialogDescription className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              Copy and store this key securely now. You won't be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-3">
            <code data-testid="revealed-key" className="flex-1 text-xs text-emerald-300 font-mono break-all">
              {newKey?.api_key}
            </code>
            <Button size="sm" data-testid="copy-key-btn" onClick={copy} variant="secondary" className="shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Send events with header <code className="font-mono">X-API-Key: {newKey?.key_prefix}...</code> to
            <code className="font-mono"> {API}/v1/events</code>
          </p>
          <DialogFooter>
            <Button data-testid="key-done-btn" onClick={() => setNewKey(null)} className="bg-indigo-600 hover:bg-indigo-700">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScopedOverview({ projectId, overview }) {
  const { data: byModel } = useScoped(`/analytics/breakdown`, projectId, { dimension: "model" });
  const { data: byWorkflow } = useScoped(`/analytics/breakdown`, projectId, { dimension: "workflow" });
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard testId="pd-spend" label="Spend" value={usd(overview?.total_spend, 2)} />
        <StatCard testId="pd-requests" label="Requests" value={num(overview?.total_requests)} accent="bg-sky-50 text-sky-600" />
        <StatCard testId="pd-success" label="Success Rate" value={`${overview?.success_rate ?? 0}%`} accent="bg-emerald-50 text-emerald-600" />
        <StatCard testId="pd-latency" label="Avg Latency" value={`${num(overview?.avg_latency_ms)} ms`} accent="bg-amber-50 text-amber-600" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <BreakdownCard testId="pd-model" title="Spend by model" data={byModel} />
        <BreakdownCard testId="pd-workflow" title="Spend by workflow" data={byWorkflow} />
      </div>
    </div>
  );
}

// lightweight project-scoped fetch (7d window)
function useScoped(path, projectId, extra = {}) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let active = true;
    api
      .get(path, { params: { workspace_id: WS_HOLDER.id, project_id: projectId, range: "30d", ...extra } })
      .then((r) => active && setData(r.data))
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, projectId]);
  return { data };
}

// set by ProjectDetail to avoid prop drilling into small helpers
const WS_HOLDER = { id: null };

export function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    api.get(`/projects/${id}`).then((r) => {
      setProject(r.data);
      WS_HOLDER.id = r.data.workspace_id;
      api
        .get(`/analytics/overview`, { params: { workspace_id: r.data.workspace_id, project_id: id, range: "30d" } })
        .then((o) => setOverview(o.data));
    });
  }, [id]);

  if (!project) return <Loading />;

  return (
    <div>
      <button data-testid="back-btn" onClick={() => navigate("/projects")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Projects
      </button>
      <PageHeader title={project.name} subtitle={project.description || "No description"}>
        <Badge variant="outline" className="bg-slate-50">{project.environment}</Badge>
      </PageHeader>

      <Tabs defaultValue="overview">
        <TabsList data-testid="project-tabs">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="keys" data-testid="tab-keys">
            <KeyRound className="h-4 w-4 mr-1.5" /> API Keys
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6">
          <ScopedOverview projectId={id} overview={overview} />
        </TabsContent>
        <TabsContent value="keys" className="mt-6">
          <ApiKeysTab projectId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
