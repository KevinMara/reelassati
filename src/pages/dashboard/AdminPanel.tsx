import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Check, X, Users, Activity, Settings as SettingsIcon, ShieldCheck, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AccessRequest = {
  id: string;
  user_id: string;
  requested_tier: string;
  status: string;
  request_message: string | null;
  created_at: string;
  profile?: { email: string | null; display_name: string | null };
};

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  plan_tier: string;
  access_status: string;
  is_unlimited: boolean;
  is_owner: boolean;
  monthly_api_budget_eur: number;
  api_spend_this_cycle_eur: number;
};

type Setting = { key: string; value: unknown };

const TABS = ["requests", "users", "usage", "settings"] as const;
type Tab = (typeof TABS)[number];

const TIER_DEFAULTS: Record<string, number> = { solo: 5, creator: 15, studio: 50 };

export default function AdminPanel() {
  return <AppShell ownerOnly renderWith={() => <AdminContent />} />;
}

function AdminContent() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("requests");

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 mono-eyebrow text-primary mb-3">
          <ShieldCheck className="h-4 w-4" />
          {t("admin.eyebrow")}
        </div>
        <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight">{t("admin.title")}</h1>
        <p className="mt-3 text-foreground/60 max-w-xl">{t("admin.sub")}</p>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto mb-8">
        {TABS.map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              tab === k
                ? "border-primary text-foreground"
                : "border-transparent text-foreground/50 hover:text-foreground",
            )}
          >
            {t(`admin.tabs.${k}`)}
          </button>
        ))}
      </div>

      {tab === "requests" && <RequestsTab />}
      {tab === "users" && <UsersTab />}
      {tab === "usage" && <UsageTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

function RequestsTab() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: reqs } = await supabase
      .from("access_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (!reqs) {
      setRows([]);
      setLoading(false);
      return;
    }
    const ids = reqs.map((r: any) => r.user_id);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const map = new Map((profs || []).map((p: any) => [p.id, p]));
    setRows(
      reqs.map((r: any) => ({
        ...r,
        profile: map.get(r.user_id),
      })) as AccessRequest[],
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (r: AccessRequest) => {
    const budget = TIER_DEFAULTS[r.requested_tier] ?? 5;
    const { error: e1 } = await supabase
      .from("profiles")
      .update({
        access_status: "active",
        plan_tier: r.requested_tier,
        monthly_api_budget_eur: budget,
      })
      .eq("id", r.user_id);
    if (e1) return toast.error(e1.message);
    const { data: me } = await supabase.auth.getUser();
    await supabase
      .from("access_requests")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: me.user?.id })
      .eq("id", r.id);
    toast.success(t("admin.requests.approved"));
    load();
  };

  const deny = async (r: AccessRequest) => {
    const { error: e1 } = await supabase
      .from("profiles")
      .update({ access_status: "active", plan_tier: "solo" })
      .eq("id", r.user_id);
    if (e1) return toast.error(e1.message);
    const { data: me } = await supabase.auth.getUser();
    await supabase
      .from("access_requests")
      .update({ status: "denied", reviewed_at: new Date().toISOString(), reviewed_by: me.user?.id })
      .eq("id", r.id);
    toast.success(t("admin.requests.denied"));
    load();
  };

  if (loading) return <TabLoader />;
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/40 py-16 text-center text-sm text-foreground/50">
        {t("admin.requests.empty")}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-foreground/[0.03] border-b border-border">
          <tr className="text-left text-xs uppercase tracking-wide text-foreground/50">
            <th className="px-4 py-3">{t("admin.requests.col.user")}</th>
            <th className="px-4 py-3">{t("admin.requests.col.tier")}</th>
            <th className="px-4 py-3">{t("admin.requests.col.date")}</th>
            <th className="px-4 py-3">{t("admin.requests.col.message")}</th>
            <th className="px-4 py-3 text-right">{t("admin.requests.col.actions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3">
                <div className="font-medium">{r.profile?.display_name || "—"}</div>
                <div className="text-xs text-foreground/50">{r.profile?.email}</div>
              </td>
              <td className="px-4 py-3 capitalize">{r.requested_tier}</td>
              <td className="px-4 py-3 text-foreground/60 tabular-nums">
                {new Date(r.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-foreground/60 max-w-xs truncate">{r.request_message || "—"}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="primary" onClick={() => approve(r)}>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {t("admin.requests.approve")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deny(r)}>
                    <X className="h-3.5 w-3.5 mr-1" />
                    {t("admin.requests.deny")}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsersTab() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, email, display_name, plan_tier, access_status, is_unlimited, is_owner, monthly_api_budget_eur, api_spend_this_cycle_eur")
      .order("created_at", { ascending: false });
    setRows((data as ProfileRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter(
    (r) =>
      !q ||
      (r.email || "").toLowerCase().includes(q.toLowerCase()) ||
      (r.display_name || "").toLowerCase().includes(q.toLowerCase()),
  );

  const suspend = async (r: ProfileRow) => {
    const next = r.access_status === "suspended" ? "active" : "suspended";
    const { error } = await supabase.from("profiles").update({ access_status: next }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(t("admin.users.updated"));
    load();
  };

  const toggleUnlimited = async (r: ProfileRow) => {
    const { error } = await supabase.from("profiles").update({ is_unlimited: !r.is_unlimited }).eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  };

  const setBudget = async (r: ProfileRow, value: string) => {
    const n = parseFloat(value);
    if (isNaN(n)) return;
    const { error } = await supabase
      .from("profiles")
      .update({ monthly_api_budget_eur: n, budget_set_by: "owner" })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(t("admin.users.budget_updated"));
    load();
  };

  if (loading) return <TabLoader />;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("admin.users.search")}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] border-b border-border">
            <tr className="text-left text-xs uppercase tracking-wide text-foreground/50">
              <th className="px-4 py-3">{t("admin.users.col.user")}</th>
              <th className="px-4 py-3">{t("admin.users.col.tier")}</th>
              <th className="px-4 py-3">{t("admin.users.col.status")}</th>
              <th className="px-4 py-3">{t("admin.users.col.unlimited")}</th>
              <th className="px-4 py-3">{t("admin.users.col.budget")}</th>
              <th className="px-4 py-3">{t("admin.users.col.spend")}</th>
              <th className="px-4 py-3 text-right">{t("admin.users.col.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <div className="font-medium flex items-center gap-2">
                    {r.display_name || "—"}
                    {r.is_owner && (
                      <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-mono uppercase">
                        owner
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-foreground/50">{r.email}</div>
                </td>
                <td className="px-4 py-3 capitalize">{r.plan_tier}</td>
                <td className="px-4 py-3">
                  <StatusPill status={r.access_status} />
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleUnlimited(r)}
                    className={cn(
                      "h-5 w-9 rounded-full relative transition-colors",
                      r.is_unlimited ? "bg-primary" : "bg-foreground/15",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-4 w-4 bg-background rounded-full transition-transform",
                        r.is_unlimited ? "translate-x-[18px]" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    defaultValue={r.monthly_api_budget_eur}
                    onBlur={(e) => {
                      if (parseFloat(e.target.value) !== Number(r.monthly_api_budget_eur))
                        setBudget(r, e.target.value);
                    }}
                    className="w-20 h-8 px-2 rounded border border-border bg-background text-sm tabular-nums"
                  />
                </td>
                <td className="px-4 py-3 text-foreground/60 tabular-nums">
                  €{Number(r.api_spend_this_cycle_eur).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">
                  {!r.is_owner && (
                    <Button size="sm" variant="outline" onClick={() => suspend(r)}>
                      {r.access_status === "suspended" ? t("admin.users.unsuspend") : t("admin.users.suspend")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    pending_approval: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    suspended: "bg-destructive/15 text-destructive",
  };
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", map[status] || "bg-foreground/10")}>
      {t(`dash.status_${status}`, { defaultValue: status })}
    </span>
  );
}

function UsageTab() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<{ total: number; byService: Record<string, number>; byUser: Record<string, number> }>({
    total: 0,
    byService: {},
    byUser: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const since = new Date();
    since.setDate(1);
    supabase
      .from("api_usage_log")
      .select("cost_eur, external_service, user_id")
      .gte("created_at", since.toISOString())
      .then(({ data }) => {
        const rows = (data as any[]) || [];
        const byService: Record<string, number> = {};
        const byUser: Record<string, number> = {};
        let total = 0;
        for (const r of rows) {
          const cost = Number(r.cost_eur) || 0;
          total += cost;
          byService[r.external_service || "unknown"] = (byService[r.external_service || "unknown"] || 0) + cost;
          byUser[r.user_id] = (byUser[r.user_id] || 0) + cost;
        }
        setStats({ total, byService, byUser });
        setLoading(false);
      });
  }, []);

  if (loading) return <TabLoader />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="mono-eyebrow text-foreground/50 mb-2">{t("admin.usage.total")}</div>
        <div className="text-3xl font-semibold tabular-nums">€{stats.total.toFixed(2)}</div>
      </div>
      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="text-sm font-medium mb-4">{t("admin.usage.by_service")}</h3>
        {Object.keys(stats.byService).length === 0 ? (
          <div className="text-xs text-foreground/50">{t("admin.usage.empty")}</div>
        ) : (
          <div className="space-y-2">
            {Object.entries(stats.byService)
              .sort(([, a], [, b]) => b - a)
              .map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span>{k}</span>
                  <span className="tabular-nums font-medium">€{v.toFixed(2)}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("platform_settings").select("*").order("key");
    setSettings((data as Setting[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateValue = async (key: string, raw: string) => {
    let parsed: unknown = raw;
    const n = Number(raw);
    if (!isNaN(n) && raw.trim() !== "") parsed = n;
    const { error } = await supabase.from("platform_settings").update({ value: parsed as any }).eq("key", key);
    if (error) return toast.error(error.message);
    toast.success(t("admin.settings.saved"));
  };

  if (loading) return <TabLoader />;

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <SettingsIcon className="h-4 w-4 text-foreground/50" />
        <h3 className="text-sm font-medium">{t("admin.settings.title")}</h3>
      </div>
      <div className="divide-y divide-border">
        {settings.map((s) => (
          <div key={s.key} className="px-5 py-3 flex items-center gap-4">
            <div className="flex-1 text-sm font-mono text-foreground/70">{s.key}</div>
            <input
              defaultValue={String(s.value)}
              onBlur={(e) => {
                if (e.target.value !== String(s.value)) updateValue(s.key, e.target.value);
              }}
              className="w-40 h-9 px-3 rounded border border-border bg-background text-sm tabular-nums"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-16 text-foreground/40">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}
