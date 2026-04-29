import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Loader2, ArrowLeft, Trash2, Save, Instagram, Youtube, Music2, Linkedin,
  Plug, Activity as ActivityIcon, BarChart3, Palette,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChipInput } from "@/components/app/ChipInput";
import { EmptyState } from "@/components/app/EmptyState";
import { toast } from "sonner";

type Client = {
  id: string; name: string; industry: string | null;
  primary_language: string | null; custom_brand_color: string | null;
  logo_url: string | null;
};

type Brief = {
  id?: string;
  brand_voice: any;
  audience: any;
  content_strategy: any;
  scripting_preferences: any;
  editing_preferences: any;
  publishing_preferences: any;
  analytics_preferences: any;
  ads_strategy: any;
  operational: any;
  completion_pct: number;
};

const EMPTY_BRIEF: Brief = {
  brand_voice: {}, audience: {}, content_strategy: {},
  scripting_preferences: {}, editing_preferences: {}, publishing_preferences: {},
  analytics_preferences: {}, ads_strategy: {}, operational: {},
  completion_pct: 0,
};

const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "tiktok", label: "TikTok", icon: Music2 },
  { id: "youtube", label: "YouTube", icon: Youtube },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
];
const AD_PLATFORMS = ["Meta Ads", "TikTok Ads", "Google Ads", "LinkedIn Ads"];

export default function ClientDetailPage() {
  return <AppShell renderWith={() => <Detail />} />;
}

function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [client, setClient] = useState<Client | null>(null);
  const [brief, setBrief] = useState<Brief>(EMPTY_BRIEF);
  const [original, setOriginal] = useState<Brief>(EMPTY_BRIEF);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty = JSON.stringify(brief) !== JSON.stringify(original);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: c } = await supabase
        .from("clients").select("*").eq("id", id).maybeSingle();
      if (!c) { navigate("/dashboard/clients"); return; }
      setClient(c as Client);
      const { data: b } = await supabase
        .from("client_briefs").select("*").eq("client_id", id).maybeSingle();
      const next: Brief = b ? {
        id: b.id,
        brand_voice: b.brand_voice ?? {},
        audience: b.audience ?? {},
        content_strategy: b.content_strategy ?? {},
        scripting_preferences: b.scripting_preferences ?? {},
        editing_preferences: b.editing_preferences ?? {},
        publishing_preferences: b.publishing_preferences ?? {},
        analytics_preferences: b.analytics_preferences ?? {},
        ads_strategy: b.ads_strategy ?? {},
        operational: b.operational ?? {},
        completion_pct: b.completion_pct ?? 0,
      } : { ...EMPTY_BRIEF };
      setBrief(next);
      setOriginal(JSON.parse(JSON.stringify(next)));
      setLoading(false);
    })();
  }, [id, navigate]);

  const computePct = (b: Brief) => {
    const sections = [
      "brand_voice", "audience", "content_strategy", "scripting_preferences",
      "editing_preferences", "publishing_preferences", "analytics_preferences",
      "ads_strategy", "operational",
    ] as const;
    let filled = 0;
    sections.forEach((s) => {
      const v = (b as any)[s];
      if (v && Object.keys(v).filter((k) => {
        const x = v[k]; return Array.isArray(x) ? x.length : x !== "" && x != null;
      }).length) filled++;
    });
    return Math.round((filled / sections.length) * 100);
  };

  const save = async () => {
    if (!id) return;
    setSaving(true);
    const completion_pct = computePct(brief);
    const payload = {
      client_id: id,
      brand_voice: brief.brand_voice,
      audience: brief.audience,
      content_strategy: brief.content_strategy,
      scripting_preferences: brief.scripting_preferences,
      editing_preferences: brief.editing_preferences,
      publishing_preferences: brief.publishing_preferences,
      analytics_preferences: brief.analytics_preferences,
      ads_strategy: brief.ads_strategy,
      operational: brief.operational,
      completion_pct,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("client_briefs").upsert(payload, { onConflict: "client_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    const next = { ...brief, completion_pct };
    setBrief(next);
    setOriginal(JSON.parse(JSON.stringify(next)));
    toast.success(t("clients.detail.brief.saved"));
  };

  const remove = async () => {
    if (!id) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("clients.deleted"));
    navigate("/dashboard/clients");
  };

  if (loading || !client) {
    return <div className="flex justify-center py-20 text-foreground/40"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const initials = client.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const set = (section: keyof Brief, key: string, value: any) =>
    setBrief((prev) => ({ ...prev, [section]: { ...(prev as any)[section], [key]: value } }));

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto pb-32">
      <button
        onClick={() => navigate("/dashboard/clients")}
        className="inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> {t("clients.detail.back")}
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-4">
          <div
            className="h-16 w-16 rounded-xl flex items-center justify-center text-xl font-semibold text-white"
            style={{ background: client.custom_brand_color || "hsl(var(--primary))" }}
          >
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <p className="text-sm text-foreground/55 mt-0.5">{client.industry || t("clients.no_industry")}</p>
          </div>
        </div>
        <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" /> {t("clients.detail.delete")}
        </Button>
      </div>

      <Tabs defaultValue="brief" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="brief">{t("clients.detail.tabs.brief")}</TabsTrigger>
          <TabsTrigger value="accounts"><Plug className="h-3.5 w-3.5 mr-1.5" />{t("clients.detail.tabs.accounts")}</TabsTrigger>
          <TabsTrigger value="activity"><ActivityIcon className="h-3.5 w-3.5 mr-1.5" />{t("clients.detail.tabs.activity")}</TabsTrigger>
          <TabsTrigger value="performance"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />{t("clients.detail.tabs.performance")}</TabsTrigger>
          <TabsTrigger value="branding"><Palette className="h-3.5 w-3.5 mr-1.5" />{t("clients.detail.tabs.branding")}</TabsTrigger>
        </TabsList>

        <TabsContent value="brief" className="mt-6">
          <p className="text-sm text-foreground/60 mb-4">{t("clients.detail.brief.intro")}</p>
          <Accordion type="multiple" defaultValue={["brand_voice"]} className="space-y-3">
            <Section value="brand_voice" title={t("clients.detail.brief.sections.brand_voice")}>
              <Field label={t("clients.detail.brief.fields.adjectives")}>
                <ChipInput
                  value={brief.brand_voice.adjectives || []}
                  onChange={(v) => set("brand_voice", "adjectives", v)}
                  placeholder={t("clients.detail.brief.fields.adjectives_ph")}
                  max={5}
                />
              </Field>
              <Radio
                label={t("clients.detail.brief.fields.register")}
                options={["informal", "neutral", "formal"]}
                value={brief.brand_voice.register || ""}
                onChange={(v) => set("brand_voice", "register", v)}
              />
              <Field label={t("clients.detail.brief.fields.register_exceptions")}>
                <Input value={brief.brand_voice.register_exceptions || ""} onChange={(e) => set("brand_voice", "register_exceptions", e.target.value)} />
              </Field>
              <Field label={t("clients.detail.brief.fields.us_voice")}>
                <Textarea rows={3} value={brief.brand_voice.us_voice || ""} onChange={(e) => set("brand_voice", "us_voice", e.target.value)} />
              </Field>
              <Field label={t("clients.detail.brief.fields.not_us_voice")}>
                <Textarea rows={3} value={brief.brand_voice.not_us_voice || ""} onChange={(e) => set("brand_voice", "not_us_voice", e.target.value)} />
              </Field>
              <Radio
                label={t("clients.detail.brief.fields.pronoun")}
                options={["tu", "Lei", "you", "usted"]}
                value={brief.brand_voice.pronoun || ""}
                onChange={(v) => set("brand_voice", "pronoun", v)}
              />
              <Radio
                label={t("clients.detail.brief.fields.we_or_i")}
                options={["we", "I", "depends"]}
                value={brief.brand_voice.we_or_i || ""}
                onChange={(v) => set("brand_voice", "we_or_i", v)}
              />
            </Section>

            <Section value="audience" title={t("clients.detail.brief.sections.audience")}>
              <Field label={t("clients.detail.brief.fields.demographics")}>
                <Textarea rows={2} value={brief.audience.demographics || ""} onChange={(e) => set("audience", "demographics", e.target.value)} />
              </Field>
              <Field label={t("clients.detail.brief.fields.psychographics")}>
                <Textarea rows={2} value={brief.audience.psychographics || ""} onChange={(e) => set("audience", "psychographics", e.target.value)} />
              </Field>
              <Radio label={t("clients.detail.brief.fields.sophistication")} options={["novice", "intermediate", "expert"]}
                value={brief.audience.sophistication || ""} onChange={(v) => set("audience", "sophistication", v)} />
              <Radio label={t("clients.detail.brief.fields.trust_state")} options={["cold", "warm", "hot"]}
                value={brief.audience.trust_state || ""} onChange={(v) => set("audience", "trust_state", v)} />
            </Section>

            <Section value="content_strategy" title={t("clients.detail.brief.sections.content_strategy")}>
              <Radio label={t("clients.detail.brief.fields.primary_goal")}
                options={["virality", "conversion", "brand_awareness", "education", "entertainment"]}
                value={brief.content_strategy.primary_goal || ""}
                onChange={(v) => set("content_strategy", "primary_goal", v)} />
              <Field label={t("clients.detail.brief.fields.platforms")}>
                <MultiToggle
                  options={PLATFORMS.map((p) => ({ id: p.id, label: p.label }))}
                  value={brief.content_strategy.platforms || []}
                  onChange={(v) => set("content_strategy", "platforms", v)}
                />
              </Field>
              <Field label={t("clients.detail.brief.fields.cadence")}>
                <Input type="number" min={0} value={brief.content_strategy.cadence_per_week || ""} onChange={(e) => set("content_strategy", "cadence_per_week", e.target.value ? Number(e.target.value) : "")} />
              </Field>
            </Section>

            <Section value="scripting" title={t("clients.detail.brief.sections.scripting")}>
              <Field label={t("clients.detail.brief.fields.approaches_work")}>
                <ChipInput value={brief.scripting_preferences.approaches_work || []} onChange={(v) => set("scripting_preferences", "approaches_work", v)} placeholder="contrarian_opener, story_opener…" />
              </Field>
              <Field label={t("clients.detail.brief.fields.approaches_avoid")}>
                <ChipInput value={brief.scripting_preferences.approaches_avoid || []} onChange={(v) => set("scripting_preferences", "approaches_avoid", v)} />
              </Field>
              <Field label={t("clients.detail.brief.fields.banned_phrases")}>
                <ChipInput value={brief.scripting_preferences.banned_phrases || []} onChange={(v) => set("scripting_preferences", "banned_phrases", v)} />
              </Field>
              <Field label={t("clients.detail.brief.fields.banned_topics")}>
                <ChipInput value={brief.scripting_preferences.banned_topics || []} onChange={(v) => set("scripting_preferences", "banned_topics", v)} />
              </Field>
              <Field label={t("clients.detail.brief.fields.disclosures")}>
                <Textarea rows={2} value={brief.scripting_preferences.disclosures || ""} onChange={(e) => set("scripting_preferences", "disclosures", e.target.value)} />
              </Field>
            </Section>

            <Section value="editing" title={t("clients.detail.brief.sections.editing")}>
              <Radio label={t("clients.detail.brief.fields.pacing")} options={["fast", "moderate", "breathing_room"]}
                value={brief.editing_preferences.pacing || ""} onChange={(v) => set("editing_preferences", "pacing", v)} />
              <Radio label={t("clients.detail.brief.fields.shot_density")} options={["high", "medium", "low"]}
                value={brief.editing_preferences.shot_density || ""} onChange={(v) => set("editing_preferences", "shot_density", v)} />
              <Radio label={t("clients.detail.brief.fields.sfx_intensity")} options={["minimal", "moderate", "heavy"]}
                value={brief.editing_preferences.sfx_intensity || ""} onChange={(v) => set("editing_preferences", "sfx_intensity", v)} />
              <Field label={t("clients.detail.brief.fields.music_mood")}>
                <ChipInput value={brief.editing_preferences.music_mood || []} onChange={(v) => set("editing_preferences", "music_mood", v)} />
              </Field>
              <Radio label={t("clients.detail.brief.fields.color_grading")}
                options={["warm_lifestyle", "cool_corporate", "high_contrast", "none"]}
                value={brief.editing_preferences.color_grading || ""} onChange={(v) => set("editing_preferences", "color_grading", v)} />
              <Radio label={t("clients.detail.brief.fields.broll_style")}
                options={["real_footage_preferred", "stock_ok", "generative_last_resort"]}
                value={brief.editing_preferences.broll_style || ""} onChange={(v) => set("editing_preferences", "broll_style", v)} />
              <ToggleField label={t("clients.detail.brief.fields.face_first_2s")}
                value={!!brief.editing_preferences.face_first_2s}
                onChange={(v) => set("editing_preferences", "face_first_2s", v)} />
            </Section>

            <Section value="publishing" title={t("clients.detail.brief.sections.publishing")}>
              <Radio label={t("clients.detail.brief.fields.title_style")} options={["curiosity", "specific", "direct", "varied"]}
                value={brief.publishing_preferences.title_style || ""} onChange={(v) => set("publishing_preferences", "title_style", v)} />
              <Field label={t("clients.detail.brief.fields.hashtag_signature")}>
                <ChipInput value={brief.publishing_preferences.hashtag_signature || []} onChange={(v) => set("publishing_preferences", "hashtag_signature", v)} />
              </Field>
              <Field label={t("clients.detail.brief.fields.hashtag_blacklist")}>
                <ChipInput value={brief.publishing_preferences.hashtag_blacklist || []} onChange={(v) => set("publishing_preferences", "hashtag_blacklist", v)} />
              </Field>
              <Radio label={t("clients.detail.brief.fields.auto_publish")} options={["always_review", "publish_if_score_above_X", "never_auto"]}
                value={brief.publishing_preferences.auto_publish || ""} onChange={(v) => set("publishing_preferences", "auto_publish", v)} />
              <Radio label={t("clients.detail.brief.fields.default_action")} options={["save_draft", "schedule", "publish_now"]}
                value={brief.publishing_preferences.default_action || ""} onChange={(v) => set("publishing_preferences", "default_action", v)} />
            </Section>

            <Section value="analytics" title={t("clients.detail.brief.sections.analytics")}>
              <Radio label={t("clients.detail.brief.fields.primary_kpi")}
                options={["views", "watch_through", "engagement", "follows", "conversions", "roas"]}
                value={brief.analytics_preferences.primary_kpi || ""} onChange={(v) => set("analytics_preferences", "primary_kpi", v)} />
              <Radio label={t("clients.detail.brief.fields.report_frequency")} options={["weekly", "monthly", "both"]}
                value={brief.analytics_preferences.report_frequency || ""} onChange={(v) => set("analytics_preferences", "report_frequency", v)} />
              <Field label={t("clients.detail.brief.fields.report_recipients")}>
                <ChipInput value={brief.analytics_preferences.report_recipients || []} onChange={(v) => set("analytics_preferences", "report_recipients", v)} placeholder="email@…" />
              </Field>
            </Section>

            <Section value="ads" title={t("clients.detail.brief.sections.ads")}>
              <ToggleField label={t("clients.detail.brief.fields.running_ads")}
                value={!!brief.ads_strategy.running_ads}
                onChange={(v) => set("ads_strategy", "running_ads", v)} />
              {brief.ads_strategy.running_ads && (
                <>
                  <Field label={t("clients.detail.brief.fields.ad_platforms")}>
                    <MultiToggle options={AD_PLATFORMS.map((p) => ({ id: p, label: p }))}
                      value={brief.ads_strategy.ad_platforms || []}
                      onChange={(v) => set("ads_strategy", "ad_platforms", v)} />
                  </Field>
                  <Field label={t("clients.detail.brief.fields.ad_budget")}>
                    <Input type="number" value={brief.ads_strategy.ad_budget || ""} onChange={(e) => set("ads_strategy", "ad_budget", e.target.value ? Number(e.target.value) : "")} />
                  </Field>
                  <Radio label={t("clients.detail.brief.fields.objective")}
                    options={["leads", "sales", "awareness", "engagement"]}
                    value={brief.ads_strategy.objective || ""} onChange={(v) => set("ads_strategy", "objective", v)} />
                  <Field label={t("clients.detail.brief.fields.min_roas")}>
                    <Input type="number" step="0.1" value={brief.ads_strategy.min_roas || ""} onChange={(e) => set("ads_strategy", "min_roas", e.target.value ? Number(e.target.value) : "")} />
                  </Field>
                </>
              )}
            </Section>

            <Section value="operational" title={t("clients.detail.brief.sections.operational")}>
              <Field label={t("clients.detail.brief.fields.decision_maker")}>
                <Input type="email" value={brief.operational.decision_maker || ""} onChange={(e) => set("operational", "decision_maker", e.target.value)} />
              </Field>
              <Field label={t("clients.detail.brief.fields.approval_above")}>
                <Input type="number" value={brief.operational.approval_above || ""} onChange={(e) => set("operational", "approval_above", e.target.value ? Number(e.target.value) : "")} />
              </Field>
              <Field label={t("clients.detail.brief.fields.escalation")}>
                <Input type="email" value={brief.operational.escalation || ""} onChange={(e) => set("operational", "escalation", e.target.value)} />
              </Field>
              <Field label={t("clients.detail.brief.fields.notes")}>
                <Textarea rows={3} value={brief.operational.notes || ""} onChange={(e) => set("operational", "notes", e.target.value)} />
              </Field>
            </Section>
          </Accordion>
        </TabsContent>

        <TabsContent value="accounts" className="mt-6">
          <ConnectedAccountsTab clientId={client.id} />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <ActivityTab clientId={client.id} />
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <EmptyState icon={BarChart3} title={t("clients.detail.performance.title")} body={t("clients.detail.performance.empty")} />
        </TabsContent>

        <TabsContent value="branding" className="mt-6">
          <BrandingTab client={client} onUpdated={(c) => setClient(c)} />
        </TabsContent>
      </Tabs>

      {/* Sticky save bar */}
      {dirty && (
        <div className="fixed bottom-0 inset-x-0 lg:left-[240px] border-t border-border bg-surface/95 backdrop-blur-sm z-30">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-3 flex items-center justify-between gap-4">
            <div className="text-sm text-foreground/70">
              {t("clients.detail.brief.completion", { pct: computePct(brief) })}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setBrief(JSON.parse(JSON.stringify(original)))}>
                {t("clients.detail.brief.discard")}
              </Button>
              <Button variant="primary" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" />{t("clients.detail.brief.save")}</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("clients.confirm_delete")}</AlertDialogTitle>
            <AlertDialogDescription>{client.name}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("clients.detail.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({ value, title, children }: { value: string; title: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={value} className="border border-border rounded-lg bg-surface px-5">
      <AccordionTrigger className="text-base font-medium hover:no-underline">{title}</AccordionTrigger>
      <AccordionContent className="pt-2 pb-5 space-y-4">{children}</AccordionContent>
    </AccordionItem>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground/65 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function Radio({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o} type="button" onClick={() => onChange(o)}
            className={`px-3 h-8 rounded-pill text-xs border transition-colors ${
              value === o ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground/65 hover:bg-foreground/[0.04]"
            }`}>
            {o.replace(/_/g, " ")}
          </button>
        ))}
      </div>
    </Field>
  );
}

function MultiToggle({ options, value, onChange }: { options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => toggle(o.id)}
          className={`px-3 h-8 rounded-pill text-xs border transition-colors ${
            value.includes(o.id) ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground/65 hover:bg-foreground/[0.04]"
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm">{label}</span>
      <button type="button" onClick={() => onChange(!value)}
        className={`h-6 w-11 rounded-full transition-colors relative ${value ? "bg-primary" : "bg-foreground/20"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function ConnectedAccountsTab({ clientId }: { clientId: string }) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from("connected_accounts").select("*").eq("client_id", clientId)
      .then(({ data }) => { setAccounts(data || []); setLoading(false); });
  }, [clientId]);

  if (loading) return <div className="flex justify-center py-10 text-foreground/40"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-medium mb-3">{t("clients.detail.accounts.connected")}</h3>
        {accounts.length === 0 ? (
          <p className="text-sm text-foreground/55 py-6 text-center bg-surface/40 rounded-lg border border-dashed border-border">
            {t("clients.detail.accounts.no_accounts")}
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="capitalize font-medium text-sm">{a.platform}</span>
                  <span className="text-xs text-foreground/55">@{a.account_handle || "—"}</span>
                </div>
                <span className="text-xs text-foreground/50">{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <h3 className="text-sm font-medium mb-3">{t("clients.detail.accounts.available")}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PLATFORMS.map((p) => {
            const Icon = p.icon;
            return (
              <button key={p.id}
                onClick={() => toast.info(t("clients.detail.accounts.oauth_placeholder"))}
                className="flex flex-col items-center justify-center bg-surface border border-border rounded-lg py-5 hover:border-primary/40 transition-colors">
                <Icon className="h-6 w-6 text-foreground/70 mb-2" />
                <span className="text-sm">{p.label}</span>
                <span className="text-[11px] text-primary mt-1">{t("clients.detail.accounts.connect")}</span>
              </button>
            );
          })}
        </div>
      </section>
      <section>
        <h3 className="text-sm font-medium mb-3">{t("clients.detail.accounts.ad_accounts")}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {AD_PLATFORMS.map((p) => (
            <button key={p}
              onClick={() => toast.info(t("clients.detail.accounts.oauth_placeholder"))}
              className="flex flex-col items-center justify-center bg-surface border border-border rounded-lg py-5 hover:border-primary/40 transition-colors">
              <span className="text-sm">{p}</span>
              <span className="text-[11px] text-primary mt-1">{t("clients.detail.accounts.connect")}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ActivityTab({ clientId }: { clientId: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from("activity_log").select("*").eq("client_id", clientId)
      .order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { setItems(data || []); setLoading(false); });
  }, [clientId]);
  if (loading) return <div className="flex justify-center py-10 text-foreground/40"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!items.length) return <EmptyState icon={ActivityIcon} title={t("clients.detail.activity.empty")} />;
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.id} className="bg-surface border border-border rounded-lg px-4 py-3 text-sm flex items-center justify-between">
          <span>{i.description || i.action_type}</span>
          <span className="text-xs text-foreground/50">{new Date(i.created_at).toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

function BrandingTab({ client, onUpdated }: { client: Client; onUpdated: (c: Client) => void }) {
  const { t } = useTranslation();
  const [color, setColor] = useState(client.custom_brand_color || "#2D5A3F");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.from("clients")
      .update({ custom_brand_color: color }).eq("id", client.id).select("*").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    onUpdated(data as Client);
    toast.success(t("clients.detail.brief.saved"));
  };
  return (
    <div className="space-y-6 max-w-md">
      <div>
        <label className="text-sm font-medium block mb-2">{t("clients.detail.branding.color")}</label>
        <div className="flex items-center gap-3">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-12 w-16 rounded border border-border cursor-pointer" />
          <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
          <Button onClick={save} disabled={saving} variant="primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.save")}
          </Button>
        </div>
      </div>
      <p className="text-xs text-foreground/50">{t("clients.detail.accounts.oauth_placeholder")}</p>
    </div>
  );
}
