import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Users,
  Video,
  Activity,
  Euro,
  Play,
  PenLine,
  Scissors,
  Send,
  BarChart3,
  Plus,
  Sparkles,
  Clock,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { StatCard } from "@/components/app/StatCard";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AuthedProfile } from "@/components/app/useAuthedProfile";

export default function DashboardHome() {
  return (
    <AppShell renderWith={(profile) => <DashboardContent profile={profile} />} />
  );
}

type Client = { id: string; name: string };
type Activity = {
  id: string;
  agent_name: string | null;
  action_type: string | null;
  description: string | null;
  created_at: string;
};

function DashboardContent({ profile }: { profile: AuthedProfile }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("clients").select("id, name").order("created_at", { ascending: false }),
      supabase
        .from("activity_log")
        .select("id, agent_name, action_type, description, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
    ]).then(([c, a]) => {
      if (!active) return;
      setClients((c.data as Client[]) || []);
      setActivity((a.data as Activity[]) || []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const firstName = (profile.display_name || profile.email || "").split(" ")[0] || t("dash.friend");
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 13) return t("dash.greet_morning");
    if (hour < 19) return t("dash.greet_afternoon");
    return t("dash.greet_evening");
  }, [t, i18n.language]);

  const today = new Date().toLocaleDateString(i18n.language === "it" ? "it-IT" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const isNewUser = !loading && clients.length === 0 && activity.length === 0;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      {/* Greeting strip */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
        <div>
          <p className="mono-eyebrow text-primary mb-3">{t("dash.eyebrow")}</p>
          <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight">
            {greeting}, {firstName}.
          </h1>
        </div>
        <div className="text-sm text-foreground/50 capitalize tabular-nums">{today}</div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-foreground/40">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : isNewUser ? (
        <NewUserWelcome />
      ) : (
        <>
          <StatsRow profile={profile} clientCount={clients.length} />
          <QuickStartGrid />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            <div className="lg:col-span-2">
              <RecentActivity items={activity} />
            </div>
            <div className="space-y-6">
              <SideCard title={t("dash.schedule_title")} empty={t("dash.schedule_empty")} />
              <SideCard title={t("dash.jobs_title")} empty={t("dash.jobs_empty")} />
              <SideCard title={t("dash.learnings_title")} empty={t("dash.learnings_empty")} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatsRow({ profile, clientCount }: { profile: AuthedProfile; clientCount: number }) {
  const { t } = useTranslation();
  const remaining = Math.max(
    0,
    Number(profile.monthly_api_budget_eur) - Number(profile.api_spend_this_cycle_eur),
  );
  const pct = Math.min(
    100,
    profile.monthly_api_budget_eur > 0
      ? (Number(profile.api_spend_this_cycle_eur) / Number(profile.monthly_api_budget_eur)) * 100
      : 0,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "grid grid-cols-2 gap-4",
        profile.is_unlimited ? "lg:grid-cols-3" : "lg:grid-cols-4",
      )}
    >
      <StatCard label={t("dash.stat.clients")} value={clientCount} icon={Users} hint={t("dash.stat.clients_hint")} />
      <StatCard label={t("dash.stat.posts")} value="0" icon={Video} hint={t("dash.stat.posts_hint")} />
      <StatCard label={t("dash.stat.performance")} value="—" icon={Activity} hint={t("dash.stat.performance_hint")} />
      {!profile.is_unlimited && (
        <StatCard
          label={t("dash.stat.budget")}
          value={`€${remaining.toFixed(2)}`}
          icon={Euro}
          hint={`€${Number(profile.api_spend_this_cycle_eur).toFixed(2)} / €${Number(profile.monthly_api_budget_eur).toFixed(0)}`}
        >
          <div className="h-1 w-full rounded-full bg-foreground/[0.08] overflow-hidden">
            <div
              className={cn("h-full rounded-full", pct >= 90 ? "bg-destructive" : "bg-primary")}
              style={{ width: `${pct}%` }}
            />
          </div>
        </StatCard>
      )}
    </motion.div>
  );
}

function QuickStartGrid() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cards = [
    { to: "/dashboard/analyze", icon: Play, key: "analyze" },
    { to: "/dashboard/script", icon: PenLine, key: "script" },
    { to: "/dashboard/edit", icon: Scissors, key: "edit" },
    { to: "/dashboard/publish", icon: Send, key: "publish" },
    { to: "/dashboard/analytics", icon: BarChart3, key: "analytics" },
  ] as const;

  return (
    <div className="mt-8">
      <h2 className="text-sm font-medium text-foreground/70 mb-4">{t("dash.quickstart_title")}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.button
              key={c.to}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => navigate(c.to)}
              className="group text-left rounded-xl border border-border bg-surface p-5 hover:border-primary/40 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-sm font-medium">{t(`dash.quickstart.${c.key}.title`)}</div>
              <div className="mt-1.5 text-xs text-foreground/50 leading-relaxed">
                {t(`dash.quickstart.${c.key}.body`)}
              </div>
              <div className="mt-4 inline-flex items-center gap-1 text-xs text-primary font-medium">
                {t("dash.quickstart.cta")}
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function RecentActivity({ items }: { items: Activity[] }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium">{t("dash.activity_title")}</h3>
      </div>
      {items.length === 0 ? (
        <div className="p-10 text-center text-sm text-foreground/50">
          {t("dash.activity_empty")}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <li key={it.id} className="px-5 py-3 flex items-center gap-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-foreground/40 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate">{it.description || it.action_type || it.agent_name}</div>
                <div className="text-[11px] text-foreground/40">
                  {new Date(it.created_at).toLocaleString(i18n.language === "it" ? "it-IT" : "en-GB")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SideCard({ title, empty }: { title: string; empty: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <div className="px-5 py-6 text-xs text-foreground/50 text-center">{empty}</div>
    </div>
  );
}

function NewUserWelcome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const steps = [
    { key: "client", to: "/dashboard/clients", icon: Users },
    { key: "social", to: "/dashboard/social-accounts", icon: Send },
    { key: "analyze", to: "/dashboard/analyze", icon: Play },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-border bg-surface p-10 lg:p-14 text-center max-w-2xl mx-auto"
    >
      <div className="h-14 w-14 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="text-2xl font-semibold">{t("dash.welcome_title")}</h2>
      <p className="mt-3 text-foreground/60">{t("dash.welcome_body")}</p>
      <ol className="mt-8 space-y-3 text-left max-w-md mx-auto">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={s.key} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 transition-colors">
              <div className="h-8 w-8 rounded-full bg-foreground/[0.04] flex items-center justify-center text-xs font-medium tabular-nums text-foreground/60 shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 text-sm">
                <div className="font-medium">{t(`dash.onboarding.${s.key}.title`)}</div>
                <div className="text-xs text-foreground/50">{t(`dash.onboarding.${s.key}.body`)}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate(s.to)}>
                <Icon className="h-3.5 w-3.5 mr-1.5" />
                {t("dash.onboarding.go")}
              </Button>
            </li>
          );
        })}
      </ol>
    </motion.div>
  );
}
