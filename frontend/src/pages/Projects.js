import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, Loading, EmptyState } from "@/components/Common";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { num, dt } from "@/lib/format";
import { toast } from "sonner";
import { Plus, FolderKanban, Loader2, ArrowUpRight } from "lucide-react";

const ENV_COLORS = {
  production: "bg-rose-50 text-rose-700 border-rose-200",
  staging: "bg-amber-50 text-amber-700 border-amber-200",
  development: "bg-sky-50 text-sky-700 border-sky-200",
};

export function Projects() {
  const { currentWorkspaceId } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", environment: "development" });

  const load = useCallback(async () => {
    if (!currentWorkspaceId) return;
    try {
      const res = await api.get("/projects", { params: { workspace_id: currentWorkspaceId } });
      setProjects(res.data);
    } catch (e) {
      setProjects([]);
      toast.error("Failed to load projects", { description: e?.response?.data?.detail || e.message });
    }
  }, [currentWorkspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!form.name.trim()) return toast.error("Project name is required");
    setSaving(true);
    try {
      await api.post("/projects", { workspace_id: currentWorkspaceId, ...form });
      toast.success("Project created");
      setOpen(false);
      setForm({ name: "", description: "", environment: "development" });
      load();
    } catch (e) {
      toast.error("Failed to create project", { description: e?.response?.data?.detail || e.message });
    } finally {
      setSaving(false);
    }
  };

  if (projects === null) return <Loading />;

  const CreateDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="new-project-btn" className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-1.5" /> New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading">Create project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Name</Label>
            <Input data-testid="project-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" placeholder="Customer Support API" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea data-testid="project-desc-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5" placeholder="Optional" />
          </div>
          <div>
            <Label>Environment</Label>
            <Select value={form.environment} onValueChange={(v) => setForm({ ...form, environment: v })}>
              <SelectTrigger data-testid="project-env-select" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="development">development</SelectItem>
                <SelectItem value="staging">staging</SelectItem>
                <SelectItem value="production">production</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button data-testid="project-create-submit" onClick={create} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div>
      <PageHeader title="Projects" subtitle="Each project has its own API keys and usage stream.">
        {CreateDialog}
      </PageHeader>

      {projects.length === 0 ? (
        <EmptyState
          testId="projects-empty"
          title="No projects yet"
          description="Create a project to generate an API key and start ingesting AI usage events."
          action={CreateDialog}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {projects.map((p) => (
            <Card
              key={p.id}
              data-testid="project-card"
              onClick={() => navigate(`/projects/${p.id}`)}
              className="p-5 border-slate-200 cursor-pointer hover:shadow-sm hover:-translate-y-px transition-[box-shadow,transform] duration-200 group"
            >
              <div className="flex items-start justify-between">
                <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <FolderKanban className="h-5 w-5 text-indigo-600" strokeWidth={2} />
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900 font-heading">{p.name}</h3>
              <p className="text-sm text-slate-500 line-clamp-1">{p.description || "No description"}</p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline" className={ENV_COLORS[p.environment] || ""}>{p.environment}</Badge>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-500">
                <span>{num(p.event_count)} events</span>
                <span>{p.latest_activity ? dt(p.latest_activity) : "no activity"}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
