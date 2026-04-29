import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, Users, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Client = {
  id: string;
  name: string;
  industry: string | null;
  primary_language: string | null;
  custom_brand_color: string | null;
  logo_url: string | null;
  created_at: string;
};

type BriefRow = { client_id: string; completion_pct: number };

export default function Clients() {
  return <AppShell renderWith={() => <ClientsContent />} />;
}

const LANGS = [
  { code: "it", flag: "🇮🇹", label: "Italiano" },
  { code: "en", flag: "🇺🇸", label: "English" },
  { code: "es", flag: "🇪🇸", label: "Español" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "de", flag: "🇩🇪", label: "Deutsch" },
];

function ClientsContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [briefs, setBriefs] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");

  // form
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [language, setLanguage] = useState("it");
  const [color, setColor] = useState("#2D5A3F");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("clients")
      .select("id, name, industry, primary_language, custom_brand_color, logo_url, created_at")
      .order("created_at", { ascending: false });
    const list = (data as Client[]) || [];
    setClients(list);
    if (list.length) {
      const { data: b } = await supabase
        .from("client_briefs")
        .select("client_id, completion_pct")
        .in("client_id", list.map((c) => c.id));
      const map: Record<string, number> = {};
      (b as BriefRow[] | null)?.forEach((r) => (map[r.client_id] = r.completion_pct));
      setBriefs(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (continueToBrief: boolean) => {
    if (!name.trim()) return;
    setSaving(true);
    const { data: me } = await supabase.auth.getUser();
    if (!me.user) return;
    const { data, error } = await supabase
      .from("clients")
      .insert({
        name: name.trim(),
        industry: industry.trim() || null,
        primary_language: language,
        custom_brand_color: color,
        user_id: me.user.id,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("clients.created"));
    setName("");
    setIndustry("");
    setOpen(false);
    if (continueToBrief && data) navigate(`/dashboard/clients/${data.id}`);
    else load();
  };

  const industries = useMemo(
    () => Array.from(new Set(clients.map((c) => c.industry).filter(Boolean))) as string[],
    [clients],
  );

  const filtered = clients.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (langFilter !== "all" && c.primary_language !== langFilter) return false;
    if (industryFilter !== "all" && c.industry !== industryFilter) return false;
    return true;
  });

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="mono-eyebrow text-primary mb-3">{t("clients.eyebrow")}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t("clients.title")}</h1>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("clients.add")}
        </Button>
      </div>

      {clients.length > 0 && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("clients.search_placeholder")}
              className="pl-9"
            />
          </div>
          <Select value={industryFilter} onValueChange={setIndustryFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("clients.filter_all_industries")}</SelectItem>
              {industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={langFilter} onValueChange={setLangFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("clients.filter_all_languages")}</SelectItem>
              {LANGS.map((l) => <SelectItem key={l.code} value={l.code}>{l.flag} {l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-foreground/40">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("clients.empty_title")}
          body={t("clients.empty_body")}
          action={
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("clients.add")}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((c) => {
            const initials = c.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
            const flag = LANGS.find((l) => l.code === c.primary_language)?.flag ?? "🌐";
            const pct = briefs[c.id] ?? 0;
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/dashboard/clients/${c.id}`)}
                className="text-left rounded-xl border border-border bg-surface p-5 hover:border-primary/40 hover:shadow-md transition-all flex flex-col"
                style={{ minHeight: 280 }}
              >
                <div
                  className="h-14 w-14 rounded-lg flex items-center justify-center text-lg font-semibold text-white mb-4"
                  style={{ background: c.custom_brand_color || "hsl(var(--primary))" }}
                >
                  {c.logo_url ? <img src={c.logo_url} className="h-full w-full object-cover rounded-lg" alt="" /> : initials}
                </div>
                <div className="font-semibold text-base truncate">{c.name}</div>
                <div className="text-xs text-foreground/55 mt-1 truncate">
                  {c.industry || t("clients.no_industry")}
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs text-foreground/60">
                  <span>{flag}</span>
                </div>
                <div className="mt-auto pt-4">
                  <div className="flex items-center justify-between text-[11px] text-foreground/50 mb-1.5">
                    <span>{t("clients.brief_complete", { pct })}</span>
                  </div>
                  <div className="h-1 w-full bg-foreground/[0.06] rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("clients.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-foreground/70 mb-1.5 block">{t("clients.name")} *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/70 mb-1.5 block">{t("clients.language_primary")} *</label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGS.map((l) => <SelectItem key={l.code} value={l.code}>{l.flag} {l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/70 mb-1.5 block">{t("clients.industry")}</label>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/70 mb-1.5 block">{t("clients.brand_color")}</label>
              <div className="flex items-center gap-3">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 rounded border border-border cursor-pointer" />
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => create(false)} disabled={saving || !name.trim()}>
              {t("clients.save_finish_later")}
            </Button>
            <Button variant="primary" onClick={() => create(true)} disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("clients.save_continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
