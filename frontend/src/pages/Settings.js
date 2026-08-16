import { useEffect, useState } from "react";
import { PageHeader, Loading } from "@/components/Common";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { usd } from "@/lib/format";
import { Loader2, User, Building2 } from "lucide-react";

export function Settings() {
  const { me, currentWorkspace, refresh } = useAuth();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [pricing, setPricing] = useState(null);

  useEffect(() => {
    setFullName(me?.profile?.full_name || "");
    api.get("/pricing").then((r) => setPricing(r.data)).catch(() => setPricing([]));
  }, [me]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.patch("/profile", { full_name: fullName });
      toast.success("Profile updated");
      refresh();
    } catch (e) {
      toast.error("Failed to update", { description: e?.response?.data?.detail || e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" subtitle="Manage your profile and view model pricing." />

      <Card className="p-6 border-slate-200" data-testid="profile-card">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-indigo-600" />
          <h3 className="text-base font-semibold text-slate-900 font-heading">Profile</h3>
        </div>
        <div className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={me?.user?.email || ""} disabled className="mt-1.5 font-mono text-sm" />
          </div>
          <div>
            <Label>Full name</Label>
            <Input data-testid="profile-name-input" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1.5" />
          </div>
          <Button data-testid="save-profile-btn" onClick={saveProfile} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save profile"}
          </Button>
        </div>
      </Card>

      <Card className="p-6 border-slate-200 mt-6" data-testid="workspace-card">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-indigo-600" />
          <h3 className="text-base font-semibold text-slate-900 font-heading">Current workspace</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-slate-900">{currentWorkspace?.name || "—"}</div>
            <div className="text-xs text-slate-400 font-mono">{currentWorkspace?.id}</div>
          </div>
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
            {currentWorkspace?.role || "member"}
          </Badge>
        </div>
      </Card>

      <Card className="p-6 border-slate-200 mt-6" data-testid="pricing-card">
        <h3 className="text-base font-semibold text-slate-900 font-heading mb-1">Model pricing</h3>
        <p className="text-sm text-slate-500 mb-4">Data-driven pricing used by the deterministic cost engine (per 1M tokens).</p>
        {pricing === null ? (
          <Loading />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Input / 1M</TableHead>
                  <TableHead className="text-right">Output / 1M</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricing.map((p) => (
                  <TableRow key={p.id} data-testid="pricing-row">
                    <TableCell className="font-medium">{p.provider}</TableCell>
                    <TableCell className="font-mono text-xs">{p.model}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{usd(p.input_cost_per_1m_tokens, 3)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{usd(p.output_cost_per_1m_tokens, 3)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
