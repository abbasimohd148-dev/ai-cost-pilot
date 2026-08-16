import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";
import api from "@/lib/api";
import {
  LayoutDashboard,
  FolderKanban,
  Activity,
  DollarSign,
  ShieldCheck,
  Sparkles,
  Settings,
  LogOut,
  Gauge,
  CalendarRange,
  Loader2,
  Database,
  ChevronDown,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/usage", label: "Usage", icon: Activity },
  { to: "/costs", label: "Costs", icon: DollarSign },
  { to: "/reliability", label: "Reliability", icon: ShieldCheck },
  { to: "/optimization", label: "Optimization", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
];

const RANGES = [
  { v: "24h", l: "Last 24 hours" },
  { v: "7d", l: "Last 7 days" },
  { v: "30d", l: "Last 30 days" },
  { v: "custom", l: "Custom range" },
];

function DateRangeControl() {
  const { range, setRange, customRange, setCustomRange } = useAuth();
  return (
    <div className="flex items-center gap-2">
      <Select value={range} onValueChange={setRange}>
        <SelectTrigger data-testid="range-select" className="w-[168px] h-9 text-sm">
          <CalendarRange className="h-4 w-4 mr-1.5 text-slate-500" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGES.map((r) => (
            <SelectItem key={r.v} value={r.v} data-testid={`range-${r.v}`}>
              {r.l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {range === "custom" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" data-testid="custom-range-btn" className="h-9">
              {customRange.start && customRange.end ? "Edit dates" : "Pick dates"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500">Start</label>
              <Input
                type="date"
                data-testid="custom-start"
                value={customRange.start || ""}
                onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">End</label>
              <Input
                type="date"
                data-testid="custom-end"
                value={customRange.end || ""}
                onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
              />
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export function Layout({ children }) {
  const {
    me,
    signOut,
    workspaces,
    currentWorkspaceId,
    setCurrentWorkspaceId,
    currentWorkspace,
    refresh,
  } = useAuth();
  const navigate = useNavigate();
  const [seeding, setSeeding] = useState(false);

  const email = me?.user?.email || "";
  const initials = (me?.profile?.full_name || email || "U").slice(0, 2).toUpperCase();

  const handleSeed = async () => {
    if (!currentWorkspaceId) return;
    setSeeding(true);
    try {
      const { data } = await api.post(`/seed/demo?workspace_id=${currentWorkspaceId}`);
      toast.success(`Seeded ${data.events_created} demo events`, {
        description: "Refresh your dashboards to see the data.",
      });
      refresh();
    } catch (e) {
      toast.error("Failed to seed demo data", { description: e?.response?.data?.detail || e.message });
    } finally {
      setSeeding(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-200 bg-white fixed inset-y-0 left-0 z-30">
        <div className="h-16 flex items-center gap-2.5 px-6 border-b border-slate-200">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Gauge className="h-5 w-5 text-white" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-slate-900 font-heading">Autopilot</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Cost & Reliability</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
            >
              <item.icon className="h-4 w-4" strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="h-8 w-8 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-900 truncate">{email}</div>
              <div className="text-[10px] text-slate-400">{currentWorkspace?.role || "member"}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 h-16 flex items-center justify-between gap-3 px-4 md:px-8 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Select value={currentWorkspaceId || ""} onValueChange={setCurrentWorkspaceId}>
              <SelectTrigger data-testid="workspace-select" className="w-[200px] h-9 text-sm font-medium">
                <Database className="h-4 w-4 mr-1.5 text-slate-500" />
                <SelectValue placeholder="Workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id} data-testid={`workspace-${w.id}`}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <DateRangeControl />
            <Button
              data-testid="seed-demo-data-btn"
              onClick={handleSeed}
              disabled={seeding || !currentWorkspaceId}
              className="h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              <span className="hidden sm:inline ml-1.5">Seed Demo Data</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="user-menu-btn" className="h-9 px-2">
                  <div className="h-7 w-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                    {initials}
                  </div>
                  <ChevronDown className="h-4 w-4 ml-1 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")} data-testid="menu-settings">
                  <Settings className="h-4 w-4 mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} data-testid="menu-logout">
                  <LogOut className="h-4 w-4 mr-2" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
