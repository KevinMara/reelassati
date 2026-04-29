import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Instagram, Youtube, Music2, Linkedin, AtSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: Instagram, unlocks: ["publishing", "analytics", "ads"] },
  { id: "tiktok", label: "TikTok", icon: Music2, unlocks: ["publishing", "analytics"] },
  { id: "youtube", label: "YouTube", icon: Youtube, unlocks: ["publishing", "analytics"] },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, unlocks: ["publishing", "analytics", "ads"] },
];
const AD_PLATFORMS = ["Meta Ads", "TikTok Ads", "Google Ads", "LinkedIn Ads"];

export default function SocialAccountsRoute() {
  return <AppShell renderWith={() => <Page />} />;
}

function Page() {
  const { t } = useTranslation();
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("clients").select("id, name").order("name").then(({ data }) => {
      const list = data || [];
      setClients(list);
      if (list.length) setSelected(list[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    supabase.from("connected_accounts").select("*").eq("client_id", selected)
      .then(({ data }) => setAccounts(data || []));
  }, [selected]);

  if (loading) return <div className="flex justify-center py-20 text-foreground/40"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  if (clients.length === 0) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto">
        <h1 className="text-3xl font-semibold tracking-tight mb-6">{t("social.title")}</h1>
        <EmptyState icon={AtSign} title={t("social.no_clients")} />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <p className="mono-eyebrow text-primary mb-3">{t("social.eyebrow")}</p>
      <h1 className="text-3xl font-semibold tracking-tight mb-6">{t("social.title")}</h1>

      <div className="mb-8 max-w-xs">
        <label className="text-xs font-medium text-foreground/65 mb-1.5 block">{t("social.select_client")}</label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <section className="mb-10">
        <h2 className="text-sm font-medium mb-3">{t("social.connected")}</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-foreground/55 py-6 text-center bg-surface/40 rounded-lg border border-dashed border-border">
            {t("social.select_client_first")}
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3">
                <div>
                  <div className="font-medium capitalize text-sm">{a.platform}</div>
                  <div className="text-xs text-foreground/55">@{a.account_handle || "—"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => toast.info(t("social.oauth_placeholder"))}>{t("social.reconnect")}</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => toast.info(t("social.oauth_placeholder"))}>{t("social.disconnect")}</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-medium mb-3">{t("social.available")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PLATFORMS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.id} className="bg-surface border border-border rounded-lg p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Icon className="h-5 w-5 text-foreground/70" />
                  <span className="font-medium">{p.label}</span>
                </div>
                <div className="text-xs text-foreground/55 mb-4">
                  {t("social.unlocks")}: {p.unlocks.map((u) => t(`social.${u}`)).join(" · ")}
                </div>
                <Button size="sm" variant="outline" onClick={() => toast.info(t("social.oauth_placeholder"))}>{t("social.connect")}</Button>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium mb-3">{t("social.ad_accounts")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {AD_PLATFORMS.map((p) => (
            <div key={p} className="bg-surface border border-border rounded-lg p-5 flex items-center justify-between">
              <span className="font-medium text-sm">{p}</span>
              <Button size="sm" variant="outline" onClick={() => toast.info(t("social.oauth_placeholder"))}>{t("social.connect")}</Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
