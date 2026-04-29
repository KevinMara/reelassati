import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Library as LibraryIcon, Search, Grid as GridIcon, List, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChipInput } from "@/components/app/ChipInput";
import { toast } from "sonner";

const CATEGORIES = ["food_pizza", "food_general", "fashion", "tech", "education", "fitness", "comedy", "lifestyle", "uncategorized"];
const REACTIONS = ["curiosity", "surprise", "envy", "humor", "inspiration", "fear", "trust"];
const TIERS = ["viral", "above_avg", "avg", "below_avg"];
const LANGS = ["it", "en", "es", "fr", "de"];

type Ref = {
  id: string; title: string | null; content_category: string;
  reactions: string[]; language: string; performance_tier: string | null;
  thumbnail_url: string | null; curated_by_user: boolean; auto_promoted: boolean;
};

export default function LibraryRoute() {
  return <AppShell renderWith={() => <LibraryPage />} />;
}

function LibraryPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [fCat, setFCat] = useState("all");
  const [fReact, setFReact] = useState("all");
  const [fLang, setFLang] = useState("all");
  const [fTier, setFTier] = useState("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("reference_videos")
      .select("id, title, content_category, reactions, language, performance_tier, thumbnail_url, curated_by_user, auto_promoted")
      .order("created_at", { ascending: false });
    setItems((data as Ref[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter((r) => {
    if (search && !(r.title || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (fCat !== "all" && r.content_category !== fCat) return false;
    if (fReact !== "all" && !r.reactions?.includes(fReact)) return false;
    if (fLang !== "all" && r.language !== fLang) return false;
    if (fTier !== "all" && r.performance_tier !== fTier) return false;
    return true;
  });

  const cohorts = useMemo(() => {
    const groups: Record<string, number> = {};
    items.forEach((r) => { groups[r.content_category] = (groups[r.content_category] || 0) + 1; });
    return Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [items]);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="mono-eyebrow text-primary mb-3">{t("library.eyebrow")}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t("library.title")}</h1>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />{t("library.add")}
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("library.search_placeholder")} className="pl-9" />
        </div>
        <FilterSelect value={fCat} onChange={setFCat} placeholder={t("library.filter_category")} options={CATEGORIES} />
        <FilterSelect value={fReact} onChange={setFReact} placeholder={t("library.filter_reaction")} options={REACTIONS} />
        <FilterSelect value={fLang} onChange={setFLang} placeholder={t("library.filter_language")} options={LANGS} />
        <FilterSelect value={fTier} onChange={setFTier} placeholder={t("library.filter_tier")} options={TIERS} />
        <div className="flex border border-border rounded-md overflow-hidden">
          <button onClick={() => setView("grid")} className={`p-2 ${view === "grid" ? "bg-primary/10 text-primary" : "text-foreground/55"}`}><GridIcon className="h-4 w-4" /></button>
          <button onClick={() => setView("list")} className={`p-2 ${view === "list" ? "bg-primary/10 text-primary" : "text-foreground/55"}`}><List className="h-4 w-4" /></button>
        </div>
      </div>

      {items.length < 50 && items.length > 0 && (
        <div className="mb-6 bg-primary/5 border border-primary/15 rounded-lg p-5 flex items-start gap-4">
          <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium text-sm">{t("library.starter.title")}</div>
            <p className="text-sm text-foreground/65 mt-1">{t("library.starter.body")}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => toast.info("Coming in phase 4")}>{t("library.starter.cta")}</Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div>
          {loading ? (
            <div className="flex justify-center py-16 text-foreground/40"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={LibraryIcon} title={t("library.empty_title")} body={t("library.empty_body")}
              action={<Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />{t("library.add")}</Button>} />
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((r) => <RefCard key={r.id} r={r} />)}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => (
                <div key={r.id} className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center justify-between text-sm">
                  <span className="font-medium truncate">{r.title || "Untitled"}</span>
                  <span className="text-xs text-foreground/50">{r.content_category} · {r.language}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="bg-surface border border-border rounded-lg p-5 h-fit">
          <h3 className="text-sm font-medium mb-3">{t("library.cohorts.title")}</h3>
          {cohorts.length === 0 ? (
            <p className="text-xs text-foreground/55">{t("library.cohorts.empty")}</p>
          ) : (
            <ul className="space-y-3">
              {cohorts.map(([cat, n]) => {
                const conf = n >= 10 ? "high" : n >= 4 ? "medium" : "low";
                const label = conf === "high" ? t("library.cohorts.confidence_high") : conf === "medium" ? t("library.cohorts.confidence_medium") : t("library.cohorts.confidence_low");
                return (
                  <li key={cat}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="capitalize">{cat.replace(/_/g, " ")}</span>
                      <span className="text-foreground/50 tabular-nums">{n}</span>
                    </div>
                    <div className="h-1.5 bg-foreground/[0.06] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${conf === "high" ? "bg-primary" : conf === "medium" ? "bg-primary/60" : "bg-primary/30"}`} style={{ width: `${Math.min(100, n * 10)}%` }} />
                    </div>
                    <div className="text-[10px] text-foreground/45 mt-1">{label}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      <AddReferenceModal open={open} onOpenChange={setOpen} onSaved={load} />
    </div>
  );
}

function FilterSelect({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[150px]"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o.replace(/_/g, " ")}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function RefCard({ r }: { r: Ref }) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden hover:border-primary/40 transition-all">
      <div className="aspect-[3/4] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
        {r.thumbnail_url ? <img src={r.thumbnail_url} className="h-full w-full object-cover" alt="" /> : <LibraryIcon className="h-8 w-8 text-primary/50" />}
      </div>
      <div className="p-3">
        <div className="text-sm font-medium truncate">{r.title || "Untitled"}</div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wide bg-foreground/[0.06] px-1.5 py-0.5 rounded">{r.content_category}</span>
          {r.performance_tier && <span className="text-[10px] uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded">{r.performance_tier}</span>}
        </div>
      </div>
    </div>
  );
}

function AddReferenceModal({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [source, setSource] = useState("upload");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("uncategorized");
  const [reactions, setReactions] = useState<string[]>([]);
  const [goal, setGoal] = useState("unspecified");
  const [tier, setTier] = useState("avg");
  const [language, setLanguage] = useState("it");
  const [curated, setCurated] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { data: me } = await supabase.auth.getUser();
    if (!me.user) return;
    const { error } = await supabase.from("reference_videos").insert({
      user_id: me.user.id, title: title || null, source_url: url || null,
      content_category: category, reactions, goal, language,
      performance_tier: tier, curated_by_user: curated,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("library.add_modal.saved"));
    onOpenChange(false);
    setTitle(""); setUrl(""); setReactions([]); setCurated(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("library.add_modal.title")}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-foreground/70 mb-1.5 block">{t("library.add_modal.source")}</label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="upload">{t("library.add_modal.source_upload")}</SelectItem>
                <SelectItem value="url">{t("library.add_modal.source_url")}</SelectItem>
                <SelectItem value="analysis">{t("library.add_modal.source_analysis")}</SelectItem>
                <SelectItem value="published">{t("library.add_modal.source_published")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {source === "url" && <Input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />}
          <Input placeholder={t("library.add_modal.ref_title")} value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label={t("library.add_modal.category")} value={category} onChange={setCategory} options={CATEGORIES} />
            <SelectField label={t("library.add_modal.tier")} value={tier} onChange={setTier} options={TIERS} />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground/70 mb-1.5 block">{t("library.add_modal.reactions")}</label>
            <div className="flex flex-wrap gap-1.5">
              {REACTIONS.map((r) => (
                <button key={r} type="button" onClick={() => setReactions((p) => p.includes(r) ? p.filter((x) => x !== r) : [...p, r])}
                  className={`px-2.5 h-7 rounded-pill text-xs border transition-colors ${reactions.includes(r) ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground/65"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <SelectField label={t("library.filter_language")} value={language} onChange={setLanguage} options={LANGS} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={curated} onChange={(e) => setCurated(e.target.checked)} className="h-4 w-4 accent-primary" />
            {t("library.add_modal.curated")}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("library.add_modal.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground/70 mb-1.5 block">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o.replace(/_/g, " ")}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
