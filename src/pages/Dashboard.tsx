import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Logo } from "@/components/Logo";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Search, Bell, Sun, Moon, Globe,
  Users, FileText, BarChart3, Euro, Search as SearchIcon, PenLine,
  Scissors, Send, Library, Calendar, AtSign, Shield, Settings, LogOut,
  X, ChevronRight,
} from "lucide-react";
import { useState, useEffect, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";

const EntryAnimation = lazy(() => import("@/components/entry/EntryAnimation"));

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, setEntryDone] = useState(false);

  useEffect(() => { if (!user) navigate("/auth/login"); }, [user, navigate]);
  if (!user) return null;

  const hour = new Date().getHours();
  const greetKey = hour < 12 ? "dash.greet_morning" : hour < 18 ? "dash.greet_afternoon" : "dash.greet_evening";

  const toggleLang = () => i18n.changeLanguage(i18n.language === "it" ? "en" : "it");

  const stats = [
    { label: t("dash.clienti_attivi"), value: "0", sub: "Totale nel tuo workspace", icon: Users },
    { label: t("dash.post_settimana"), value: "0", sub: "Pubblicati negli ultimi 7 giorni", icon: FileText },
    { label: t("dash.indice_performance"), value: "\u2014", sub: "Aggregato dei clienti", icon: BarChart3 },
    { label: t("dash.budget_api"), value: "0.00 \u20ac", sub: "Residuo del ciclo", icon: Euro },
  ];

  const quickStart = [
    { title: t("dash.analizza_video"), desc: t("dash.analizza_video_desc"), icon: SearchIcon, to: "/dashboard/analyze" },
    { title: t("dash.scrivi_script"), desc: t("dash.scrivi_script_desc"), icon: PenLine, to: "/dashboard/script" },
    { title: t("dash.monta_girato"), desc: t("dash.monta_girato_desc"), icon: Scissors, to: "/dashboard/edit" },
    { title: t("dash.pubblica_bozza"), desc: t("dash.pubblica_bozza_desc"), icon: Send, to: "/dashboard/publish" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Entry animation — plays once on hard load */}
      <Suspense fallback={null}>
        <EntryAnimation onComplete={() => setEntryDone(true)} />
      </Suspense>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 left-0 z-50 h-screen bg-surface border-r border-border flex flex-col transition-all duration-300 ease-out-expo",
        collapsed ? "w-[68px]" : "w-56",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}>
        <div className="h-14 flex items-center px-3 border-b border-border shrink-0">
          <Link to="/" className="flex-1"><Logo collapsed={collapsed} /></Link>
          <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex p-1.5 rounded-md text-foreground/40 hover:text-foreground">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </button>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          <SidebarItem icon={LayoutDashboard} label={t("nav.dashboard")} to="/dashboard" active />
          <SidebarItem icon={Search} label={t("nav.analyze")} to="/dashboard/analyze" />
          <SidebarItem icon={PenLine} label={t("nav.script")} to="/dashboard/script" />
          <SidebarItem icon={Scissors} label={t("nav.edit")} to="/dashboard/edit" />
          <SidebarItem icon={Send} label={t("nav.publish")} to="/dashboard/publish" />
          <SidebarItem icon={BarChart3} label={t("nav.analytics")} to="/dashboard/analytics" />
          <div className="border-t border-border my-2" />
          <SidebarItem icon={Library} label={t("nav.library")} to="/dashboard/library" />
          <SidebarItem icon={Users} label={t("nav.clients")} to="/dashboard/clients" />
          <SidebarItem icon={Calendar} label={t("nav.calendar")} to="/dashboard/calendar" />
          <SidebarItem icon={AtSign} label={t("nav.social")} to="/dashboard/social" />
          <div className="border-t border-border my-2" />
          <SidebarItem icon={Shield} label={t("nav.admin")} to="/dashboard/admin" />
          <SidebarItem icon={Settings} label={t("nav.settings")} to="/dashboard/settings" />
        </div>

        <div className="shrink-0 border-t border-border p-3">
          <button onClick={logout} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors w-full">
            <LogOut className="h-[18px] w-[18px]" /> {!collapsed && <span>{t("nav.logout") || "Logout"}</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30 flex items-center px-4 gap-3">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2"><Search className="h-5 w-5" /></button>
          <span className="mono-eyebrow text-foreground/50 hidden sm:block">Dashboard</span>
          <div className="flex-1" />
          <div className="hidden sm:flex items-center gap-1 h-9 px-3 rounded-md border border-border bg-surface text-xs text-foreground/50">
            <Search className="h-3.5 w-3.5 mr-1" /> Cerca <span className="ml-1 font-mono text-[10px] bg-foreground/[0.06] px-1 rounded">\u2318K</span>
          </div>
          <button className="relative p-2 text-foreground/70"><Bell className="h-[18px] w-[18px]" /><span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" /></button>
          <button onClick={toggleTheme} className="p-2 text-foreground/70">{theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</button>
          <button onClick={toggleLang} className="flex items-center gap-1 text-xs text-foreground/50"><Globe className="h-3.5 w-3.5" /> {i18n.language === "it" ? "IT" : "EN"}</button>
        </header>

        <main className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full">
          <p className="mono-eyebrow text-primary mb-2">Dashboard</p>
          <h1 className="text-3xl md:text-4xl font-semibold mb-8">{t(greetKey)}, {user.name}.</h1>

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
            <button className="text-sm text-primary hover:text-primary-hover flex items-center gap-1">+ {t("dash.aggiungi_cliente")}</button>
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

          {/* Onboarding panel */}
          <div className="bg-surface border border-border rounded-xl p-6 max-w-sm ml-auto">
            <h3 className="font-semibold mb-2">{t("dash.onboarding_title")}</h3>
            <p className="text-sm text-foreground/60 mb-4">{t("dash.onboarding_desc")}</p>
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full border-2 border-foreground/20 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{t(`dash.onboarding_${n}`)}</p>
                    <p className="text-xs text-foreground/50">{t(`dash.onboarding_${n}_sub`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarItem({ icon: Icon, label, to, active }: { icon: any; label: string; to: string; active?: boolean }) {
  return (
    <Link to={to} className={cn(
      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
      active ? "bg-primary/10 text-primary font-medium" : "text-foreground/70 hover:text-foreground hover:bg-foreground/[0.04]",
    )}>
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
