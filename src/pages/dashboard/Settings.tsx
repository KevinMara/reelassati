import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { LangSwitcher } from "@/components/brand/LangSwitcher";
import { toast } from "sonner";
import type { AuthedProfile } from "@/components/app/useAuthedProfile";

export default function Settings() {
  return <AppShell renderWith={(p) => <SettingsContent profile={p} />} />;
}

function SettingsContent({ profile }: { profile: AuthedProfile }) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", profile.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("settings.saved"));
  };

  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("settings.title")}</h1>
      </div>

      <section className="rounded-xl border border-border bg-surface p-6 space-y-5">
        <h2 className="text-sm font-medium">{t("settings.profile_title")}</h2>
        <div>
          <label className="text-xs text-foreground/60 mb-1.5 block">{t("auth.email")}</label>
          <Input value={profile.email || ""} disabled />
        </div>
        <div>
          <label className="text-xs text-foreground/60 mb-1.5 block">{t("auth.name")}</label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.save")}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 mt-6">
        <h2 className="text-sm font-medium mb-4">{t("settings.appearance")}</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground/70">{t("settings.theme")}</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-foreground/70">{t("settings.language")}</span>
          <LangSwitcher />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 mt-6">
        <h2 className="text-sm font-medium mb-4">{t("settings.plan_title")}</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-foreground/60">{t("dash.plan")}</dt>
            <dd className="font-medium capitalize">{profile.plan_tier}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-foreground/60">{t("dash.status")}</dt>
            <dd className="font-medium capitalize">{profile.access_status}</dd>
          </div>
          {!profile.is_unlimited && (
            <div className="flex justify-between">
              <dt className="text-foreground/60">{t("dash.stat.budget")}</dt>
              <dd className="font-medium tabular-nums">
                €{Number(profile.api_spend_this_cycle_eur).toFixed(2)} / €
                {Number(profile.monthly_api_budget_eur).toFixed(0)}
              </dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}
