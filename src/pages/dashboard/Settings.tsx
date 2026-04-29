import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Settings as SettingsIcon, KeyRound, Plug2, Users2, AlertTriangle, Bell, Palette, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { LangSwitcher } from "@/components/brand/LangSwitcher";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { AuthedProfile } from "@/components/app/useAuthedProfile";

export default function Settings() {
  return <AppShell renderWith={(p) => <SettingsContent profile={p} />} />;
}

const INTEGRATIONS = [
  { id: "zernio", label: "Zernio", connected: false },
  { id: "unified", label: "Unified.to", connected: false },
  { id: "deepgram", label: "Deepgram", connected: true },
  { id: "elevenlabs", label: "ElevenLabs", connected: true },
  { id: "shotstack", label: "Shotstack", connected: false },
];

function SettingsContent({ profile }: { profile: AuthedProfile }) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [timezone, setTimezone] = useState("Europe/Rome");
  const [accent, setAccent] = useState("#2D5A3F");
  const [emailNotif, setEmailNotif] = useState(true);
  const [inAppNotif, setInAppNotif] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim() || null,
      timezone,
    }).eq("id", profile.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("settings.saved"));
  };

  const exportData = async () => toast.info("Export coming in phase 6");
  const deleteAccount = async () => {
    toast.info("Account deletion coming in phase 6");
    setConfirmDelete(false);
  };

  const generateKey = () => toast.info(t("settings.api_keys.placeholder_notice"));

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="mono-eyebrow text-primary mb-1">{t("settings.eyebrow")}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t("settings.title")}</h1>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-6 w-full justify-start overflow-x-auto">
          <TabsTrigger value="profile"><User className="h-3.5 w-3.5 mr-1.5" />{t("settings.tabs.profile")}</TabsTrigger>
          <TabsTrigger value="theme"><Palette className="h-3.5 w-3.5 mr-1.5" />{t("settings.tabs.theme")}</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-3.5 w-3.5 mr-1.5" />{t("settings.tabs.notifications")}</TabsTrigger>
          <TabsTrigger value="api_keys"><KeyRound className="h-3.5 w-3.5 mr-1.5" />{t("settings.tabs.api_keys")}</TabsTrigger>
          <TabsTrigger value="integrations"><Plug2 className="h-3.5 w-3.5 mr-1.5" />{t("settings.tabs.integrations")}</TabsTrigger>
          {profile.plan_tier === "studio" && (
            <TabsTrigger value="team"><Users2 className="h-3.5 w-3.5 mr-1.5" />{t("settings.tabs.team")}</TabsTrigger>
          )}
          <TabsTrigger value="danger" className="text-destructive"><AlertTriangle className="h-3.5 w-3.5 mr-1.5" />{t("settings.tabs.danger")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card title={t("settings.profile_title")}>
            <div className="space-y-4">
              <Field label={t("auth.email")}><Input value={profile.email || ""} disabled /></Field>
              <Field label={t("auth.name")}><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></Field>
              <Field label={t("settings.profile.timezone")}><Input value={timezone} onChange={(e) => setTimezone(e.target.value)} /></Field>
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-foreground/70">{t("settings.language")}</span>
                <LangSwitcher />
              </div>
              <div className="flex justify-end">
                <Button variant="primary" onClick={saveProfile} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.save")}
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="theme">
          <Card title={t("settings.theme_tab.title")}>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">{t("settings.theme_tab.mode")}</span>
                <ThemeToggle />
              </div>
              <Field label={t("settings.theme_tab.accent")}>
                <div className="flex items-center gap-3">
                  <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-14 rounded border border-border cursor-pointer" />
                  <Input value={accent} onChange={(e) => setAccent(e.target.value)} className="flex-1" />
                </div>
              </Field>
              <div className="rounded-lg p-5 border border-border" style={{ background: `${accent}10` }}>
                <p className="text-xs text-foreground/55 mb-2">{t("settings.theme_tab.preview")}</p>
                <div className="flex gap-2">
                  <button className="px-4 h-9 rounded-md text-white text-sm font-medium" style={{ background: accent }}>Primary button</button>
                  <button className="px-4 h-9 rounded-md text-sm font-medium border" style={{ color: accent, borderColor: accent }}>Outline</button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card title={t("settings.tabs.notifications")}>
            <Toggle label={t("settings.notifications.email")} value={emailNotif} onChange={setEmailNotif} />
            <Toggle label={t("settings.notifications.in_app")} value={inAppNotif} onChange={setInAppNotif} />
            <div className="flex items-center justify-between py-3 border-t border-border opacity-60">
              <span className="text-sm">{t("settings.notifications.telegram")}</span>
              <span className="text-xs text-foreground/45">{t("lang.pending")}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-border opacity-60">
              <span className="text-sm">{t("settings.notifications.slack")}</span>
              <span className="text-xs text-foreground/45">{t("lang.pending")}</span>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="api_keys">
          <Card title={t("settings.tabs.api_keys")}>
            <p className="text-sm text-foreground/65 mb-4">{t("settings.api_keys.intro")}</p>
            <p className="text-sm text-foreground/55 italic mb-4">{t("settings.api_keys.none")}</p>
            <Button variant="primary" onClick={generateKey}>{t("settings.api_keys.generate")}</Button>
            <p className="text-xs text-foreground/45 mt-4">{t("settings.api_keys.placeholder_notice")}</p>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card title={t("settings.tabs.integrations")}>
            <p className="text-sm text-foreground/65 mb-4">{t("settings.integrations.intro")}</p>
            <div className="space-y-2">
              {INTEGRATIONS.map((i) => (
                <div key={i.id} className="flex items-center justify-between bg-surface-recessed/50 border border-border rounded-lg px-4 py-3">
                  <div>
                    <div className="font-medium text-sm">{i.label}</div>
                    <div className={`text-xs ${i.connected ? "text-primary" : "text-foreground/45"}`}>
                      {i.connected ? t("settings.integrations.connected") : t("settings.integrations.not_connected")}
                    </div>
                  </div>
                  <Button size="sm" variant={i.connected ? "ghost" : "outline"} onClick={() => toast.info("Phase 6")}>
                    {i.connected ? t("settings.integrations.reconnect") : t("settings.integrations.connect")}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {profile.plan_tier === "studio" && (
          <TabsContent value="team">
            <Card title={t("settings.tabs.team")}>
              <p className="text-sm text-foreground/65 mb-4">{t("settings.team.intro")}</p>
              <p className="text-sm text-foreground/55 italic mb-4">{t("settings.team.no_members")}</p>
              <Button variant="primary" onClick={() => toast.info(t("settings.team.placeholder_notice"))}>{t("settings.team.invite")}</Button>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="danger">
          <Card title={t("settings.tabs.danger")} danger>
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium text-sm">{t("settings.danger.export")}</div>
                  <div className="text-xs text-foreground/55 mt-1">{t("settings.danger.export_desc")}</div>
                </div>
                <Button variant="outline" onClick={exportData}>{t("settings.danger.export")}</Button>
              </div>
              <div className="flex items-start justify-between gap-4 flex-wrap pt-5 border-t border-destructive/20">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium text-sm text-destructive">{t("settings.danger.delete")}</div>
                  <div className="text-xs text-foreground/55 mt-1">{t("settings.danger.delete_desc")}</div>
                </div>
                <Button variant="destructive" onClick={() => setConfirmDelete(true)}>{t("settings.danger.delete")}</Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.danger.confirm_delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("settings.danger.confirm_delete_text")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("settings.danger.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Card({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={`rounded-xl border bg-surface p-6 ${danger ? "border-destructive/30" : "border-border"}`}>
      <h2 className={`text-sm font-medium mb-5 ${danger ? "text-destructive" : ""}`}>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-foreground/60 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <span className="text-sm">{label}</span>
      <button onClick={() => onChange(!value)}
        className={`h-6 w-11 rounded-full transition-colors relative ${value ? "bg-primary" : "bg-foreground/20"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
