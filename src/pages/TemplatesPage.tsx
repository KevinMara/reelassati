import { useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Film,
  GraduationCap,
  Search,
  Shapes,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { VIDEO_PROMPT_TEMPLATES, type PromptTemplate } from "@/lib/videoPromptTemplates";

type Language = "en" | "it";
type Category = "all" | PromptTemplate["category"];

const CATEGORY_META: Record<PromptTemplate["category"], {
  label: Record<Language, string>;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  color: string;
}> = {
  realistic: { label: { en: "Realistic", it: "Realistico" }, icon: Camera, color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300" },
  cinematic: { label: { en: "Cinematic", it: "Cinematico" }, icon: Film, color: "bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  product: { label: { en: "Product", it: "Prodotto" }, icon: Shapes, color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  social: { label: { en: "Social", it: "Social" }, icon: Smartphone, color: "bg-pink-500/10 text-pink-600 dark:text-pink-300" },
  educational: { label: { en: "Educational", it: "Educativo" }, icon: GraduationCap, color: "bg-blue-500/10 text-blue-600 dark:text-blue-300" },
};

const ALL_LABEL = { en: "All", it: "Tutti" };

export default function TemplatesPage() {
  const { i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const language: Language = i18n.resolvedLanguage?.startsWith("it") ? "it" : "en";
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(VIDEO_PROMPT_TEMPLATES[0]?.id ?? "");
  const [subject, setSubject] = useState(
    language === "it"
      ? "Una creator mostra la texture di una crema viso e il modo corretto di applicarla."
      : "A creator demonstrates the texture of a face cream and the correct way to apply it.",
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return VIDEO_PROMPT_TEMPLATES.filter((template) => {
      if (activeCategory !== "all" && template.category !== activeCategory) return false;
      if (!query) return true;
      return `${template.name} ${template.description} ${template.preview}`.toLowerCase().includes(query);
    });
  }, [activeCategory, search]);

  const selected = VIDEO_PROMPT_TEMPLATES.find((template) => template.id === selectedId) ?? VIDEO_PROMPT_TEMPLATES[0];
  const compiledPrompt = selected?.buildPrompt(subject.trim() || (language === "it" ? "Descrivi il soggetto." : "Describe the subject."));
  const categories: Category[] = ["all", "realistic", "cinematic", "product", "social", "educational"];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="px-6 pb-20 pt-24 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10">
            <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-foreground/50 transition-colors hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {language === "it" ? "Torna alla home" : "Back to home"}
            </Link>
            <p className="mono-eyebrow mb-2 text-primary">Prompt Director</p>
            <h1 className="text-4xl font-semibold md:text-5xl">
              {language === "it" ? "Preset produttivi, non formule virali." : "Production presets, not viral formulas."}
            </h1>
            <p className="mt-4 max-w-2xl leading-relaxed text-foreground/60">
              {language === "it"
                ? "Dieci preset reali trasformano il tuo soggetto in direzione video più precisa: camera, luce, movimento, audio, continuità e vincoli. Nessun preset garantisce performance."
                : "Ten real presets turn your subject into more precise video direction: camera, light, movement, audio, continuity, and exclusions. No preset guarantees performance."}
            </p>
          </div>

          <div className="mb-8 flex flex-wrap items-center gap-3">
            <label className="relative min-w-[240px] flex-1 sm:max-w-sm">
              <span className="sr-only">{language === "it" ? "Cerca preset" : "Search presets"}</span>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={language === "it" ? "Cerca preset…" : "Search presets…"}
                className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <div className="flex flex-wrap gap-1.5" aria-label={language === "it" ? "Filtra per categoria" : "Filter by category"}>
              {categories.map((category) => {
                const label = category === "all" ? ALL_LABEL[language] : CATEGORY_META[category].label[language];
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    aria-pressed={activeCategory === category}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                      activeCategory === category
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-surface text-foreground/60 hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_0.92fr]">
            <div>
              {filtered.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filtered.map((template, index) => {
                    const meta = CATEGORY_META[template.category];
                    const Icon = meta.icon;
                    const isSelected = selected?.id === template.id;
                    return (
                      <motion.button
                        key={template.id}
                        type="button"
                        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: reduceMotion ? 0 : index * 0.04 }}
                        onClick={() => setSelectedId(template.id)}
                        aria-pressed={isSelected}
                        className={`flex min-h-[220px] flex-col rounded-xl border p-5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                          isSelected
                            ? "border-primary/45 bg-primary/[0.045] shadow-card"
                            : "border-border bg-surface hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:hover:translate-y-0"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${meta.color}`}>
                            <Icon className="h-5 w-5" aria-hidden />
                          </span>
                          <span className="rounded-pill bg-background px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-foreground/45">
                            {template.defaultRatio} · {template.defaultDuration}s
                          </span>
                        </div>
                        <h2 className="mt-5 text-lg font-semibold">{template.name}</h2>
                        <p className="mt-2 text-sm leading-relaxed text-foreground/55">{template.description}</p>
                        <p className="mt-auto pt-4 font-mono text-[9px] uppercase tracking-wider text-primary">
                          {isSelected
                            ? language === "it" ? "Aperto nel compiler" : "Open in compiler"
                            : language === "it" ? "Ispeziona preset" : "Inspect preset"}
                        </p>
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-12 text-center">
                  <p className="font-medium">{language === "it" ? "Nessun preset corrisponde alla ricerca." : "No preset matches that search."}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setActiveCategory("all");
                    }}
                    className="mt-3 text-sm font-medium text-primary hover:text-primary-hover"
                  >
                    {language === "it" ? "Azzera filtri" : "Clear filters"}
                  </button>
                </div>
              )}
            </div>

            {selected ? (
              <aside className="h-fit rounded-2xl border border-border bg-surface p-6 shadow-card lg:sticky lg:top-24 md:p-7" aria-label={language === "it" ? "Compiler prompt locale" : "Local prompt compiler"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="mono-eyebrow text-primary">{language === "it" ? "Compiler locale" : "Local compiler"}</p>
                    <h2 className="mt-2 text-2xl font-semibold">{selected.name}</h2>
                  </div>
                  <span className="rounded-pill bg-primary/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-primary">
                    {language === "it" ? "Nessuna chiamata provider" : "No provider call"}
                  </span>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-foreground/60">{selected.preview}</p>
                <label className="mt-6 block">
                  <span className="text-xs font-medium">{language === "it" ? "Soggetto e azione" : "Subject and action"}</span>
                  <textarea
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    rows={4}
                    className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>

                <div className="mt-5 rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                    <p className="font-mono text-[9px] uppercase tracking-wider text-primary">
                      {language === "it" ? "Direzione compilata" : "Compiled direction"}
                    </p>
                  </div>
                  <p className="mt-3 max-h-64 overflow-y-auto text-xs leading-relaxed text-foreground/70">{compiledPrompt}</p>
                </div>

                {selected.finishingNote ? (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-background p-3">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    <p className="text-xs leading-relaxed text-foreground/55">{selected.finishingNote}</p>
                  </div>
                ) : null}

                <Link
                  to="/dashboard/video"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  {language === "it" ? "Apri Prompt Director" : "Open Prompt Director"} <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <p className="mt-3 text-center text-[10px] leading-relaxed text-foreground/40">
                  {language === "it"
                    ? "La generazione nello Studio richiede un provider configurato e una revisione esplicita."
                    : "Generation in the Studio requires a configured provider and explicit review."}
                </p>
              </aside>
            ) : null}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
