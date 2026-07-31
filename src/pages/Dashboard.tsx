import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Logo } from "@/components/Logo";
import { Link, useNavigate, useLocation, Routes, Route } from "react-router-dom";
import {
  LayoutDashboard, Search, Bell, Sun, Moon, Globe,
  Users, FileText, BarChart3, Search as SearchIcon, PenLine,
  Scissors, Send, Library, Calendar, AtSign, Shield, Settings, LogOut,
  X, ChevronRight, Flame, Film, Mic, MessageCircle, Target, Mail, Gift,
  Menu, Database, HardDrive, BrainCircuit, Radio,
  type LucideIcon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/providers/workspace";

// Dashboard pages
import ScriptGenerator from "./dashboard/ScriptGenerator";
import VideoAnalyzer from "./dashboard/VideoAnalyzer";
import EditorPage from "./dashboard/EditorPage";
import PublisherPage from "./dashboard/PublisherPage";
import AnalyticsPage from "./dashboard/AnalyticsPage";
import ContentLibrary from "./dashboard/ContentLibrary";
import ClientsPage from "./dashboard/ClientsPage";
import CalendarPage from "./dashboard/CalendarPage";
import SocialHub from "./dashboard/SocialHub";
import SettingsPage from "./dashboard/SettingsPage";
import TrendsPage from "./dashboard/TrendsPage";
import VideoGenerator from "./dashboard/VideoGenerator";
import VoiceNotes from "./dashboard/VoiceNotes";
import InterviewMe from "./dashboard/InterviewMe";
import GoalTracker from "./dashboard/GoalTracker";
import CoachingPage from "./dashboard/CoachingPage";
import ReferralPage from "./dashboard/ReferralPage";

// ── Dashboard Home ──
function DashboardHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { workspace, capabilities, loading, saving, error } = useWorkspace();
  const [now] = useState(() => Date.now());
  const [hour] = useState(() => new Date().getHours());
  const greetKey = hour < 12 ? "dash.greet_morning" : hour < 18 ? "dash.greet_afternoon" : "dash.greet_evening";

  const publishedThisWeek = workspace.posts.filter((post) => {
    if (!post.publishedAt) return false;
    return now - new Date(post.publishedAt).getTime() <= 7 * 24 * 60 * 60 * 1000;
  }).length;
  const stats = [
    { label: "Editing projects", value: workspace.projects.length, sub: `${workspace.projects.filter((project) => project.status === "editing").length} currently in edit`, icon: Scissors },
    { label: "Media assets", value: workspace.assets.length, sub: "Stored in your private library", icon: Library },
    { label: t("dash.post_settimana"), value: publishedThisWeek, sub: "Published in the last 7 days", icon: FileText },
    { label: "Connected accounts", value: workspace.accounts.filter((account) => account.status === "connected").length, sub: capabilities.publishing ? "Publishing provider configured" : "Publishing setup required", icon: AtSign },
  ];

  const quickStart = [
    { title: "Open editing studio", desc: "Upload, trim, split, caption, review AI changes, and version your short.", icon: Scissors, to: "/dashboard/edit" },
    { title: t("dash.analizza_video"), desc: t("dash.analizza_video_desc"), icon: SearchIcon, to: "/dashboard/analyze" },
    { title: t("dash.scrivi_script"), desc: t("dash.scrivi_script_desc"), icon: PenLine, to: "/dashboard/script" },
    { title: "Generate a controlled shot", desc: "Direct a Kling v3 Standard clip with timed beats and native audio.", icon: Film, to: "/dashboard/video" },
    { title: t("dash.pubblica_bozza"), desc: t("dash.pubblica_bozza_desc"), icon: Send, to: "/dashboard/publish" },
  ];

  const recentActivity = workspace.activity.slice(0, 6);
  const onboarding = [
    {
      done: Boolean(workspace.brandKit.voice && workspace.brandKit.audience),
      title: "Define Brand DNA",
      detail: "Add voice, audience, colors, and caption behavior in Settings.",
    },
    {
      done: workspace.assets.length > 0,
      title: "Upload real footage",
      detail: "Build a reusable, private media library.",
    },
    {
      done: workspace.projects.length > 0,
      title: "Create your first edit",
      detail: "Manual and AI changes share one reviewable timeline.",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-[55vh] flex items-center justify-center">
        <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <p className="mono-eyebrow text-primary mb-2">Dashboard</p>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold">{t(greetKey)}, {user?.name || "Creator"}.</h1>
          <p className="text-sm text-foreground/50 mt-2">What will you make impossible to scroll past today?</p>
        </div>
        <span className="text-xs text-foreground/45">
          {saving
            ? "Saving workspace…"
            : error
              ? "Changes need attention"
              : "Everything saved"}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface border border-border rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <span className="mono-eyebrow text-foreground/50 text-[10px]">{s.label}</span>
              <s.icon className="h-4 w-4 text-foreground/40" />
            </div>
            <div className="text-2xl font-semibold tabular">{s.value}</div>
            <p className="text-xs text-foreground/50 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick start */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">{t("dash.inizia_da_qui")}</h2>
        <Link to="/dashboard/edit" className="text-sm text-primary hover:text-primary-hover flex items-center gap-1">Open Studio <ChevronRight className="h-3.5 w-3.5" /></Link>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        {quickStart.map((qs) => (
          <Link key={qs.title} to={qs.to} className="bg-surface border border-border rounded-xl p-5 hover:shadow-card-hover transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-lg bg-primary-wash flex items-center justify-center"><qs.icon className="h-4 w-4 text-primary" /></div>
              <ChevronRight className="h-4 w-4 text-foreground/30 group-hover:text-primary transition-colors" />
            </div>
            <h3 className="font-semibold">{qs.title}</h3>
            <p className="text-sm text-foreground/60 mt-1">{qs.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-6">
          <h2 className="font-medium mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {recentActivity.length ? recentActivity.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-background">
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium bg-primary/10 text-primary">
                  {item.type.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-foreground/50 truncate">{item.detail}</p>
                </div>
                <span className="text-xs text-foreground/30">
                  {new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
                    Math.max(-30, Math.round((new Date(item.createdAt).getTime() - now) / 86_400_000)),
                    "day",
                  )}
                </span>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-sm font-medium">Your activity starts with a real action.</p>
                <p className="text-xs text-foreground/50 mt-1">Upload footage or create an editing project—no fabricated demo feed.</p>
              </div>
            )}
          </div>
        </div>

        {/* Onboarding */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-2">{t("dash.onboarding_title")}</h3>
          <p className="text-sm text-foreground/60 mb-4">{t("dash.onboarding_desc")}</p>
          <div className="space-y-3">
            {onboarding.map((item, index) => (
              <div key={item.title} className="flex items-start gap-3">
                <div className={cn(
                  "h-5 w-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center",
                  item.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-primary bg-primary/10",
                )}>
                  <span className={cn("text-[10px] font-bold", item.done ? "text-white" : "text-primary")}>{item.done ? "✓" : index + 1}</span>
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-foreground/50">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-border">
            <Link to="/dashboard/trends" className="flex items-center gap-2 text-sm text-primary hover:text-primary-hover">
              <Flame className="h-4 w-4" /> Explore trending content
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudioStatus() {
  const { capabilities, workspace, error } = useWorkspace();
  const rows = [
    { label: "Workspace database", detail: "Projects, edits, goals, and revisions", ready: capabilities.persistence, icon: Database },
    { label: "Media storage", detail: "Private uploaded and generated assets", ready: capabilities.uploads, icon: HardDrive },
    { label: "Kimi + OpenRouter", detail: "Scripts, edit plans, analysis, voice, and video", ready: capabilities.ai, icon: BrainCircuit },
    { label: "Zernio publishing", detail: "Account connection, scheduling, and posts", ready: capabilities.publishing, icon: Radio },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <p className="mono-eyebrow text-primary mb-2">Production readiness</p>
      <h1 className="text-3xl font-semibold">Studio status</h1>
      <p className="text-foreground/60 mt-2">Configuration presence for storage and providers; use a feature to verify the full request path.</p>
      {error ? <p className="mt-5 text-sm text-destructive">{error}</p> : null}
      <div className="grid sm:grid-cols-2 gap-4 mt-8">
        {rows.map((row) => (
          <div key={row.label} className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between">
              <row.icon className="h-5 w-5 text-primary" />
              <span className={cn(
                "text-[10px] font-mono tracking-wider uppercase px-2 py-1 rounded-full",
                row.ready ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500",
              )}>
                {row.ready ? "Configured" : "Setup needed"}
              </span>
            </div>
            <h2 className="font-semibold mt-5">{row.label}</h2>
            <p className="text-sm text-foreground/50 mt-1">{row.detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 bg-surface border border-border rounded-xl p-5">
        <h2 className="font-medium">Workspace footprint</h2>
        <p className="text-sm text-foreground/60 mt-2">
          {workspace.projects.length} projects · {workspace.assets.length} assets · {workspace.scripts.length} scripts · {workspace.posts.length} publications
        </p>
        {capabilities.missing.length ? (
          <p className="text-xs text-foreground/45 mt-3">
            Hosted variables still required: {capabilities.missing.join(", ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ── Main Dashboard Component ──
export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user, logout, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth/login");
  }, [authLoading, user, navigate]);
  if (authLoading || !user) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const toggleLang = () => i18n.changeLanguage(i18n.language === "it" ? "en" : "it");
  const path = location.pathname;

  const navItems: Array<
    | { separator: true }
    | { icon: LucideIcon; label: string; to: string; separator?: false }
  > = [
    { icon: LayoutDashboard, label: t("nav.dashboard"), to: "/dashboard" },
    { icon: Search, label: t("nav.analyze"), to: "/dashboard/analyze" },
    { icon: PenLine, label: t("nav.script"), to: "/dashboard/script" },
    { icon: Film, label: "AI Video", to: "/dashboard/video" },
    { icon: Mic, label: "Voice Studio", to: "/dashboard/voice" },
    { icon: MessageCircle, label: "Interview Me", to: "/dashboard/interview" },
    { icon: Scissors, label: t("nav.edit"), to: "/dashboard/edit" },
    { icon: Send, label: t("nav.publish"), to: "/dashboard/publish" },
    { icon: BarChart3, label: t("nav.analytics"), to: "/dashboard/analytics" },
    { icon: Flame, label: "Trends", to: "/dashboard/trends" },
    { separator: true },
    { icon: Target, label: "Goals", to: "/dashboard/goals" },
    { icon: Mail, label: "Weekly Coach", to: "/dashboard/coaching" },
    { icon: Gift, label: "Refer & Earn", to: "/dashboard/referral" },
    { separator: true },
    { icon: Library, label: t("nav.library"), to: "/dashboard/library" },
    { icon: Users, label: t("nav.clients"), to: "/dashboard/clients" },
    { icon: Calendar, label: t("nav.calendar"), to: "/dashboard/calendar" },
    { icon: AtSign, label: t("nav.social"), to: "/dashboard/social" },
    { separator: true },
    { icon: Shield, label: "Studio status", to: "/dashboard/status" },
    { icon: Settings, label: t("nav.settings"), to: "/dashboard/settings" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen bg-surface border-r border-border flex flex-col transition-all duration-300",
          collapsed ? "w-[68px]" : "w-56",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
        <div className="h-14 flex items-center px-3 border-b border-border shrink-0">
          <Link to="/" className="flex-1"><Logo collapsed={collapsed} /></Link>
          <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex p-1.5 rounded-md text-foreground/40 hover:text-foreground">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </button>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item, i) => (
            item.separator ? (
              <div key={`sep-${i}`} className="border-t border-border my-2" />
            ) : (
              <SidebarItem
                key={item.to}
                icon={item.icon}
                label={item.label}
                to={item.to}
                active={path === item.to || (item.to !== "/dashboard" && path.startsWith(item.to))}
                collapsed={collapsed}
              />
            )
          ))}
        </div>

        <div className="shrink-0 border-t border-border p-3">
          <button onClick={logout} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors w-full">
            <LogOut className="h-[18px] w-[18px]" /> {!collapsed && <span>{t("nav.logout") || "Exit studio"}</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30 flex items-center px-4 gap-3">
          <button onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="lg:hidden p-2 -ml-2"><Menu className="h-5 w-5" /></button>
          <span className="mono-eyebrow text-foreground/50 hidden sm:block">Dashboard</span>
          <div className="flex-1" />
          <Link to="/dashboard/library" className="hidden sm:flex items-center gap-1 h-9 px-3 rounded-md border border-border bg-surface text-xs text-foreground/50 hover:text-foreground">
            <Search className="h-3.5 w-3.5 mr-1" /> Find assets
          </Link>
          <Link to="/dashboard" aria-label="Recent activity" className="p-2 text-foreground/70"><Bell className="h-[18px] w-[18px]" /></Link>
          <button onClick={toggleTheme} className="p-2 text-foreground/70">{theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</button>
          <button onClick={toggleLang} className="flex items-center gap-1 text-xs text-foreground/50"><Globe className="h-3.5 w-3.5" /> {i18n.language === "it" ? "IT" : "EN"}</button>
        </header>

        <main className="flex-1 p-6 lg:p-10 w-full">
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/analyze" element={<VideoAnalyzer />} />
            <Route path="/script" element={<ScriptGenerator />} />
            <Route path="/video" element={<VideoGenerator />} />
            <Route path="/edit" element={<EditorPage />} />
            <Route path="/publish" element={<PublisherPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/library" element={<ContentLibrary />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/social" element={<SocialHub />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/trends" element={<TrendsPage />} />
            <Route path="/voice" element={<VoiceNotes />} />
            <Route path="/interview" element={<InterviewMe />} />
            <Route path="/goals" element={<GoalTracker />} />
            <Route path="/coaching" element={<CoachingPage />} />
            <Route path="/referral" element={<ReferralPage />} />
            <Route path="/status" element={<StudioStatus />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function SidebarItem({ icon: Icon, label, to, active, collapsed }: { icon: LucideIcon; label: string; to: string; active?: boolean; collapsed?: boolean }) {
  return (
    <Link to={to} className={cn(
      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
      active ? "bg-primary/10 text-primary font-medium" : "text-foreground/70 hover:text-foreground hover:bg-foreground/[0.04]",
    )}>
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
