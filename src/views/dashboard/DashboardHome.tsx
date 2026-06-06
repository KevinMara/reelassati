import { AppShell } from "@/components/app/AppShell";
import { StatCard } from "@/components/app/StatCard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTranslation } from "react-i18next";
import { 
  Users, 
  Video, 
  BarChart3, 
  Euro, 
  Plus, 
  Search, 
  PenLine, 
  Scissors, 
  Send, 
  LineChart,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function DashboardHome() {
  const { profile } = useAuth();
  const { t } = useTranslation();

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dash.greet_morning");
    if (hour < 18) return t("dash.greet_afternoon");
    return t("dash.greet_evening");
  };

  const quickstarts = [
    { key: "analyze", icon: Search, to: "/dashboard/analyze" },
    { key: "script", icon: PenLine, to: "/dashboard/script" },
    { key: "edit", icon: Scissors, to: "/dashboard/edit" },
    { key: "publish", icon: Send, to: "/dashboard/publish" },
    { key: "analytics", icon: LineChart, to: "/dashboard/analytics" },
  ];

  return (
    <AppShell>
      <div className="p-8 space-y-10 max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <p className="mono-eyebrow text-primary mb-2">{t("dash.eyebrow")}</p>
          <h1 className="text-4xl font-semibold">
            {getTimeGreeting()}, {profile?.display_name || t("dash.friend")}.
          </h1>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={t("dash.stat.clients")}
            value="12"
            hint={t("dash.stat.clients_hint")}
            icon={Users}
          />
          <StatCard
            label={t("dash.stat.posts")}
            value="48"
            hint={t("dash.stat.posts_hint")}
            icon={Video}
          />
          <StatCard
            label={t("dash.stat.performance")}
            value="92/100"
            hint={t("dash.stat.performance_hint")}
            icon={BarChart3}
            accent
          />
          <StatCard
            label={t("dash.stat.budget")}
            value={`€${Number(profile?.api_spend_this_cycle_eur || 0).toFixed(2)}`}
            hint={t("dash.stat.budget_hint")}
            icon={Euro}
          />
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-10">
          <div className="space-y-10">
            {/* Quickstart Section */}
            <section>
              <h2 className="text-xl font-semibold mb-6 flex items-center justify-between">
                {t("dash.quickstart_title")}
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/dashboard/clients" className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t("dash.onboarding.client.title")}
                  </Link>
                </Button>
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {quickstarts.map((q) => (
                  <Link
                    key={q.key}
                    to={q.to}
                    className="group bg-surface border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <q.icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-foreground/20 group-hover:text-primary transition-colors" />
                    </div>
                    <h3 className="font-semibold text-lg">{t(`dash.quickstart.${q.key}.title`)}</h3>
                    <p className="text-sm text-foreground/60 mt-1">{t(`dash.quickstart.${q.key}.body`)}</p>
                  </Link>
                ))}
              </div>
            </section>

            {/* Activity (Empty State) */}
            <section>
              <h2 className="text-xl font-semibold mb-6">{t("dash.activity_title")}</h2>
              <div className="bg-surface/50 border border-dashed border-border rounded-xl p-10 text-center">
                <p className="text-foreground/40 text-sm">{t("dash.activity_empty")}</p>
              </div>
            </section>
          </div>

          <aside className="space-y-8">
            {/* Onboarding / Welcome Card */}
            <div className="bg-primary/[0.03] border border-primary/20 rounded-2xl p-6">
              <h3 className="font-semibold text-lg">{t("dash.welcome_title")}</h3>
              <p className="text-sm text-foreground/70 mt-2 mb-6">{t("dash.welcome_body")}</p>
              
              <div className="space-y-4">
                {["client", "social", "analyze"].map((k) => (
                  <div key={k} className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full border border-primary/30 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{t(`dash.onboarding.${k}.title`)}</div>
                      <div className="text-[11px] text-foreground/50">{t(`dash.onboarding.${k}.body`)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Jobs */}
            <div>
              <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-foreground/50">
                {t("dash.jobs_title")}
              </h3>
              <div className="text-xs text-foreground/40 italic px-1">
                {t("dash.jobs_empty")}
              </div>
            </div>

            {/* Latest Learnings */}
            <div>
              <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-foreground/50">
                {t("dash.learnings_title")}
              </h3>
              <div className="text-xs text-foreground/40 italic px-1">
                {t("dash.learnings_empty")}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
