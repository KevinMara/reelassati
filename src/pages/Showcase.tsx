import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Captions,
  Check,
  Film,
  Layers3,
  Lock,
  ScanLine,
  Scissors,
  Sparkles,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

type Language = "en" | "it";
type Category = "Editing" | "Script" | "Generation" | "Delivery";

type LocalizedText = Record<Language, string>;
type ShowcaseItem = {
  id: string;
  category: Category;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: LocalizedText;
  description: LocalizedText;
  source: LocalizedText;
  goal: LocalizedText;
  steps: { interval: string; action: LocalizedText; reason: LocalizedText }[];
  capabilities: LocalizedText[];
  route: string;
  accent: string;
};

const CATEGORY_LABELS: Record<"All" | Category, LocalizedText> = {
  All: { en: "All", it: "Tutti" },
  Editing: { en: "Editing", it: "Montaggio" },
  Script: { en: "Script", it: "Script" },
  Generation: { en: "Generation", it: "Generazione" },
  Delivery: { en: "Delivery", it: "Consegna" },
};

const ITEMS: ShowcaseItem[] = [
  {
    id: "hook-rescue",
    category: "Editing",
    icon: Scissors,
    title: { en: "Hook rescue", it: "Recupero hook" },
    description: {
      en: "Tighten a slow opening without flattening the speaker’s cadence.",
      it: "Stringi un’apertura lenta senza appiattire il ritmo di chi parla.",
    },
    source: { en: "42s talking-head take", it: "Take talking-head da 42s" },
    goal: {
      en: "Reach the first proof point by 00:03",
      it: "Arrivare alla prima prova entro 00:03",
    },
    steps: [
      {
        interval: "00:00–00:01",
        action: {
          en: "Move the concrete outcome to frame one",
          it: "Porta il risultato concreto al primo frame",
        },
        reason: {
          en: "The original starts with generic context.",
          it: "L’originale parte da un contesto generico.",
        },
      },
      {
        interval: "00:01–00:03",
        action: {
          en: "Preserve one complete setup sentence",
          it: "Conserva una frase di setup completa",
        },
        reason: {
          en: "Fast still needs to be understandable.",
          it: "Veloce deve restare comprensibile.",
        },
      },
      {
        interval: "00:03–00:08",
        action: {
          en: "Lock the first proof example",
          it: "Blocca il primo esempio-prova",
        },
        reason: {
          en: "Approved material should not drift in later passes.",
          it: "Il materiale approvato non deve cambiare nei passaggi successivi.",
        },
      },
    ],
    capabilities: [
      { en: "Range selection", it: "Selezione intervallo" },
      { en: "Lock regions", it: "Blocca regioni" },
      { en: "Review plan", it: "Revisione piano" },
    ],
    route: "/dashboard/edit",
    accent: "from-primary/25 via-primary/10 to-transparent",
  },
  {
    id: "caption-architecture",
    category: "Editing",
    icon: Captions,
    title: { en: "Caption architecture", it: "Architettura sottotitoli" },
    description: {
      en: "Shape readable caption beats around meaning instead of arbitrary word counts.",
      it: "Costruisci beat leggibili attorno al significato, non a un numero arbitrario di parole.",
    },
    source: { en: "58s interview answer", it: "Risposta intervista da 58s" },
    goal: {
      en: "Readable 2-line captions in the 9:16 safe area",
      it: "Sottotitoli leggibili su 2 righe nella safe area 9:16",
    },
    steps: [
      {
        interval: "00:00–00:07",
        action: {
          en: "Group the opening into two semantic beats",
          it: "Raggruppa l’apertura in due beat semantici",
        },
        reason: {
          en: "Phrases should land with the voice.",
          it: "Le frasi devono atterrare con la voce.",
        },
      },
      {
        interval: "00:07–00:19",
        action: {
          en: "Emphasize one contrast, not every keyword",
          it: "Enfatizza un contrasto, non ogni parola chiave",
        },
        reason: {
          en: "Hierarchy makes captions scannable.",
          it: "La gerarchia rende i sottotitoli leggibili al volo.",
        },
      },
      {
        interval: "00:19–00:31",
        action: {
          en: "Check safe-area collisions",
          it: "Controlla collisioni con la safe area",
        },
        reason: {
          en: "Platform UI cannot cover essential text.",
          it: "L’interfaccia della piattaforma non deve coprire il testo essenziale.",
        },
      },
    ],
    capabilities: [
      { en: "Caption timing", it: "Timing caption" },
      { en: "Safe areas", it: "Safe area" },
      { en: "Style memory", it: "Memoria stile" },
    ],
    route: "/dashboard/edit",
    accent: "from-blue-500/20 via-primary/5 to-transparent",
  },
  {
    id: "script-to-shots",
    category: "Script",
    icon: Layers3,
    title: { en: "Script to shot plan", it: "Dallo script al piano scene" },
    description: {
      en: "Convert an idea into spoken beats, proof moments, and a shootable coverage list.",
      it: "Trasforma un’idea in beat parlati, momenti di prova e una lista scene girabile.",
    },
    source: {
      en: "One-paragraph product brief",
      it: "Brief prodotto di un paragrafo",
    },
    goal: {
      en: "A 30s structure with evidence before CTA",
      it: "Struttura da 30s con una prova prima della CTA",
    },
    steps: [
      {
        interval: "00:00–00:03",
        action: {
          en: "State the tension in one sentence",
          it: "Esprimi la tensione in una frase",
        },
        reason: {
          en: "The viewer should know why to stay.",
          it: "Chi guarda deve sapere perché restare.",
        },
      },
      {
        interval: "00:03–00:18",
        action: {
          en: "Pair each claim with a visible proof beat",
          it: "Abbina ogni claim a una prova visibile",
        },
        reason: {
          en: "Evidence is more persuasive than adjectives.",
          it: "La prova convince più degli aggettivi.",
        },
      },
      {
        interval: "00:18–00:30",
        action: {
          en: "Resolve and ask for one next action",
          it: "Risolvi e chiedi una sola azione",
        },
        reason: {
          en: "One close keeps the ending legible.",
          it: "Una sola chiusura mantiene il finale chiaro.",
        },
      },
    ],
    capabilities: [
      { en: "Structured script", it: "Script strutturato" },
      { en: "Shot list", it: "Shot list" },
      { en: "Brand context", it: "Contesto brand" },
    ],
    route: "/dashboard/script",
    accent: "from-emerald-500/20 via-primary/5 to-transparent",
  },
  {
    id: "controlled-insert",
    category: "Generation",
    icon: Film,
    title: { en: "Controlled insert", it: "Inserto controllato" },
    description: {
      en: "Direct one missing shot with production constraints, then review it before insertion.",
      it: "Dirigi una sola scena mancante con vincoli produttivi, poi revisiona prima di inserirla.",
    },
    source: {
      en: "Selected 3.5s gap in an existing edit",
      it: "Gap selezionato da 3,5s in un montaggio esistente",
    },
    goal: {
      en: "A continuity-safe product detail shot",
      it: "Dettaglio prodotto coerente con la continuità",
    },
    steps: [
      {
        interval: "Selected range",
        action: {
          en: "Lock the surrounding shots",
          it: "Blocca le scene circostanti",
        },
        reason: {
          en: "Generation should not rewrite approved work.",
          it: "La generazione non deve riscrivere il lavoro approvato.",
        },
      },
      {
        interval: "Prompt Director",
        action: {
          en: "Specify camera, light, action, audio, and exclusions",
          it: "Specifica camera, luce, azione, audio ed esclusioni",
        },
        reason: {
          en: "Production detail reduces arbitrary output.",
          it: "Il dettaglio produttivo riduce risultati arbitrari.",
        },
      },
      {
        interval: "Review",
        action: {
          en: "Preview, reject, or insert as a new version",
          it: "Anteprima, rifiuto o inserimento come nuova versione",
        },
        reason: {
          en: "Generated media never lands silently.",
          it: "Il media generato non entra mai in silenzio.",
        },
      },
    ],
    capabilities: [
      { en: "Prompt Director", it: "Prompt Director" },
      { en: "Provider-gated", it: "Provider richiesto" },
      { en: "Versioned insert", it: "Inserto versionato" },
    ],
    route: "/dashboard/video",
    accent: "from-violet-500/25 via-fuchsia-500/5 to-transparent",
  },
  {
    id: "quality-preflight",
    category: "Delivery",
    icon: ScanLine,
    title: { en: "Quality preflight", it: "Preflight qualità" },
    description: {
      en: "Catch practical export problems before a finished short leaves the workspace.",
      it: "Trova problemi pratici di export prima che lo short lasci il workspace.",
    },
    source: {
      en: "Version 04, approved edit",
      it: "Versione 04, montaggio approvato",
    },
    goal: {
      en: "A delivery-ready 9:16 master",
      it: "Master 9:16 pronto per la consegna",
    },
    steps: [
      {
        interval: "Picture",
        action: {
          en: "Check crop, safe areas, blank frames, and source resolution",
          it: "Controlla crop, safe area, frame vuoti e risoluzione",
        },
        reason: {
          en: "Visual failures are costly after export.",
          it: "Gli errori visivi costano dopo l’export.",
        },
      },
      {
        interval: "Sound",
        action: {
          en: "Check peaks, speech consistency, and silent gaps",
          it: "Controlla picchi, coerenza voce e silenzi",
        },
        reason: {
          en: "A clean mix protects comprehension.",
          it: "Un mix pulito protegge la comprensione.",
        },
      },
      {
        interval: "Copy",
        action: {
          en: "Check caption timing and unsupported claims",
          it: "Controlla timing caption e claim non supportati",
        },
        reason: {
          en: "Accuracy is part of production quality.",
          it: "L’accuratezza fa parte della qualità.",
        },
      },
    ],
    capabilities: [
      { en: "Visual checks", it: "Controlli video" },
      { en: "Audio checks", it: "Controlli audio" },
      { en: "Claim review", it: "Revisione claim" },
    ],
    route: "/dashboard/edit",
    accent: "from-amber-500/20 via-primary/5 to-transparent",
  },
  {
    id: "publish-ready",
    category: "Delivery",
    icon: Sparkles,
    title: {
      en: "Publish-ready variants",
      it: "Varianti pronte alla pubblicazione",
    },
    description: {
      en: "Turn one approved master into channel-specific copy and delivery variants—without claiming an account is connected.",
      it: "Trasforma un master approvato in copy e varianti per canale, senza dare per collegato un account.",
    },
    source: { en: "Approved 9:16 master", it: "Master 9:16 approvato" },
    goal: {
      en: "Prepare, review, then connect or export",
      it: "Prepara, revisiona, poi collega o esporta",
    },
    steps: [
      {
        interval: "Variant",
        action: {
          en: "Set target crop, caption, and metadata",
          it: "Imposta crop, caption e metadati",
        },
        reason: {
          en: "Each destination has different constraints.",
          it: "Ogni destinazione ha vincoli differenti.",
        },
      },
      {
        interval: "Review",
        action: {
          en: "Approve each channel package",
          it: "Approva ogni pacchetto canale",
        },
        reason: {
          en: "Distribution should remain deliberate.",
          it: "La distribuzione deve restare intenzionale.",
        },
      },
      {
        interval: "Deliver",
        action: {
          en: "Export or publish after account authorization",
          it: "Esporta o pubblica dopo l’autorizzazione account",
        },
        reason: {
          en: "No hidden or assumed connection.",
          it: "Nessuna connessione nascosta o presunta.",
        },
      },
    ],
    capabilities: [
      { en: "Channel variants", it: "Varianti canale" },
      { en: "Approval step", it: "Passo approvazione" },
      { en: "Connection-gated", it: "Connessione richiesta" },
    ],
    route: "/dashboard/publish",
    accent: "from-cyan-500/20 via-primary/5 to-transparent",
  },
];

export default function Showcase() {
  const { i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const language: Language = i18n.resolvedLanguage?.startsWith("it")
    ? "it"
    : "en";
  const [activeCategory, setActiveCategory] = useState<"All" | Category>("All");
  const [selectedItem, setSelectedItem] = useState<ShowcaseItem | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const categories: ("All" | Category)[] = [
    "All",
    "Editing",
    "Script",
    "Generation",
    "Delivery",
  ];
  const filtered =
    activeCategory === "All"
      ? ITEMS
      : ITEMS.filter(item => item.category === activeCategory);

  const closeDialog = useCallback(() => {
    setSelectedItem(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!selectedItem) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() =>
      closeButtonRef.current?.focus()
    );
    const handleDialogKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleDialogKey);
    };
  }, [closeDialog, selectedItem]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="px-6 pb-20 pt-24 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10">
            <Link
              to="/"
              className="mb-4 inline-flex items-center gap-1 text-sm text-foreground/50 transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />{" "}
              {language === "it" ? "Torna alla home" : "Back to home"}
            </Link>
            <p className="mono-eyebrow mb-2 text-primary">
              {language === "it"
                ? "Walkthrough prodotto"
                : "Product walkthroughs"}
            </p>
            <h1 className="text-4xl font-semibold md:text-5xl">
              {language === "it"
                ? "Guarda come ragiona il flusso."
                : "See how the workflow thinks."}
            </h1>
            <p className="mt-4 max-w-2xl text-foreground/60">
              {language === "it"
                ? "Questi sono esempi interattivi di decisioni e interfaccia, non contenuti pubblicati né risultati attribuiti a creator."
                : "These are interactive workflow and interface specimens—not published creator work, testimonials, or attributed performance results."}
            </p>
          </div>

          <div
            className="mb-8 flex flex-wrap gap-2"
            aria-label={language === "it" ? "Filtra esempi" : "Filter examples"}
          >
            {categories.map(category => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                aria-pressed={activeCategory === category}
                className={`rounded-pill px-4 py-2 text-sm font-medium transition-colors ${
                  activeCategory === category
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-surface text-foreground/60 hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {CATEGORY_LABELS[category][language]}
              </button>
            ))}
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduceMotion ? 0 : index * 0.06 }}
                  onClick={event => {
                    triggerRef.current = event.currentTarget;
                    setSelectedItem(item);
                  }}
                  className="group overflow-hidden rounded-xl border border-border bg-surface text-left shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-primary/30 motion-reduce:hover:translate-y-0"
                  aria-label={`${language === "it" ? "Apri esempio" : "Open example"}: ${item.title[language]}`}
                >
                  <WorkflowThumbnail item={item} language={language} />
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-primary">
                        {CATEGORY_LABELS[item.category][language]}
                      </span>
                      <Icon
                        className="h-4 w-4 text-foreground/35"
                        aria-hidden
                      />
                    </div>
                    <h2 className="mt-2 text-lg font-semibold">
                      {item.title[language]}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/55">
                      {item.description[language]}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {item.capabilities.map(capability => (
                        <span
                          key={capability.en}
                          className="rounded-pill bg-primary/8 px-2 py-1 text-[10px] font-medium text-primary"
                        >
                          {capability[language]}
                        </span>
                      ))}
                    </div>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-foreground/55 transition-colors group-hover:text-primary">
                      {language === "it"
                        ? "Ispeziona il flusso"
                        : "Inspect the workflow"}{" "}
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </main>

      {selectedItem ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/55 p-4 backdrop-blur-sm">
          <button
            type="button"
            aria-label={language === "it" ? "Chiudi finestra" : "Close dialog"}
            onClick={closeDialog}
            tabIndex={-1}
            className="absolute inset-0 cursor-default"
          />
          <motion.section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="showcase-dialog-title"
            initial={reduceMotion ? false : { scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-background shadow-modal"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-6 py-4 backdrop-blur-xl">
              <span className="mono-eyebrow text-primary">
                {language === "it" ? "Specimen di flusso" : "Workflow specimen"}
              </span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeDialog}
                className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/50 transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
                aria-label={language === "it" ? "Chiudi" : "Close"}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="p-6 md:p-8">
              <WorkflowThumbnail
                item={selectedItem}
                language={language}
                large
              />
              <h2
                id="showcase-dialog-title"
                className="mt-7 text-3xl font-semibold"
              >
                {selectedItem.title[language]}
              </h2>
              <p className="mt-3 max-w-2xl leading-relaxed text-foreground/60">
                {selectedItem.description[language]}
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <Info
                  label={
                    language === "it"
                      ? "Materiale di partenza"
                      : "Starting material"
                  }
                  value={selectedItem.source[language]}
                />
                <Info
                  label={language === "it" ? "Obiettivo" : "Edit objective"}
                  value={selectedItem.goal[language]}
                />
              </div>

              <div className="mt-7">
                <p className="mono-eyebrow mb-3 text-foreground/45">
                  {language === "it"
                    ? "Decisioni revisionabili"
                    : "Reviewable decisions"}
                </p>
                <div className="space-y-2">
                  {selectedItem.steps.map(step => (
                    <article
                      key={`${selectedItem.id}-${step.interval}`}
                      className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-[105px_1fr]"
                    >
                      <span className="font-mono text-[10px] text-primary">
                        {step.interval}
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {step.action[language]}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-foreground/50">
                          {step.reason[language]}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to={selectedItem.route}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  {language === "it"
                    ? "Apri lo strumento reale"
                    : "Open the real tool"}{" "}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-lg border border-border px-5 py-3 text-sm font-medium transition-colors hover:bg-surface"
                >
                  {language === "it" ? "Torna agli esempi" : "Back to examples"}
                </button>
              </div>
            </div>
          </motion.section>
        </div>
      ) : null}

      <Footer />
    </div>
  );
}

function WorkflowThumbnail({
  item,
  language,
  large = false,
}: {
  item: ShowcaseItem;
  language: Language;
  large?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${item.accent} ${large ? "h-52 rounded-xl border border-border" : "h-44 border-b border-border"}`}
    >
      <div className="absolute inset-x-5 top-5 flex items-center justify-between">
        <span className="rounded-pill bg-background/80 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-foreground/55 backdrop-blur">
          {item.source[language]}
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-primary backdrop-blur">
          <Lock className="h-3 w-3" aria-hidden />
        </span>
      </div>
      <div className="absolute inset-x-5 bottom-5 rounded-lg border border-border bg-background/85 p-3 shadow-card backdrop-blur">
        <div className="flex h-7 gap-1">
          <span className="w-[18%] rounded-sm bg-foreground/10" />
          <span className="w-[36%] rounded-sm border border-primary/30 bg-primary/25" />
          <span className="w-[24%] rounded-sm bg-foreground/10" />
          <span className="flex-1 rounded-sm bg-foreground/10" />
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[8px] uppercase tracking-wider text-foreground/40">
          <span>
            {language === "it" ? "Intervallo selezionato" : "Selected range"}
          </span>
          <span className="inline-flex items-center gap-1 text-primary">
            <Check className="h-2.5 w-2.5" aria-hidden />{" "}
            {language === "it" ? "Revisionabile" : "Reviewable"}
          </span>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="font-mono text-[9px] uppercase tracking-wider text-foreground/40">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}
