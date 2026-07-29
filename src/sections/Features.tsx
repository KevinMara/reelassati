import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  BrainCircuit,
  Film,
  History,
  LineChart,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const ease = [0.16, 1, 0.3, 1] as const;
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease } },
};
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

type Feature = {
  title: string;
  description: string;
  status: string;
  icon: LucideIcon;
  roadmap?: boolean;
};

const FEATURES: Record<"en" | "it", Feature[]> = {
  en: [
    {
      title: "Precision Studio",
      description: "Trim, split, reorder, caption, lock, and inspect the exact interval you are changing. Manual control remains available at every step.",
      status: "Studio",
      icon: SlidersHorizontal,
    },
    {
      title: "Reviewable AI plan",
      description: "Proposed edits show the interval, action, and reason before they touch the timeline. Approve changes one by one or reject the plan.",
      status: "Studio",
      icon: BrainCircuit,
    },
    {
      title: "Selected-range generation",
      description: "Keep the edit that works, select only the weak beat, and direct a replacement shot. Provider actions remain explicitly connection-gated.",
      status: "Provider-gated",
      icon: Film,
    },
    {
      title: "Prompt Director",
      description: "Turn a brief into production-aware direction with camera, subject, lighting, audio, timing, and negative constraints—not a vague one-line prompt.",
      status: "10 presets",
      icon: Sparkles,
    },
    {
      title: "Non-destructive versions",
      description: "Save checkpoints, compare directions, and keep a clear path back. Exploration should never destroy the cut you already trust.",
      status: "Workspace",
      icon: History,
    },
    {
      title: "Performance → timeline",
      description: "Map retention and skips back to exact edit decisions, then draft a more informed V2. This learning loop is visible product roadmap—not a current claim.",
      status: "Roadmap",
      icon: LineChart,
      roadmap: true,
    },
  ],
  it: [
    {
      title: "Studio di precisione",
      description: "Taglia, dividi, riordina, sottotitola, blocca e ispeziona l’intervallo esatto che stai cambiando. Il controllo manuale resta sempre disponibile.",
      status: "Studio",
      icon: SlidersHorizontal,
    },
    {
      title: "Piano AI revisionabile",
      description: "Ogni modifica proposta mostra intervallo, azione e motivo prima di toccare la timeline. Approva una voce alla volta o rifiuta il piano.",
      status: "Studio",
      icon: BrainCircuit,
    },
    {
      title: "Generazione sull’intervallo",
      description: "Mantieni ciò che funziona, seleziona solo il beat debole e dirigi una scena sostitutiva. Le azioni provider richiedono una connessione configurata.",
      status: "Provider richiesto",
      icon: Film,
    },
    {
      title: "Prompt Director",
      description: "Trasforma un brief in direzione produttiva: camera, soggetto, luce, audio, timing e vincoli negativi, non una riga generica.",
      status: "10 preset",
      icon: Sparkles,
    },
    {
      title: "Versioni non distruttive",
      description: "Salva checkpoint, confronta direzioni e conserva una strada chiara per tornare indietro. Esplorare non deve distruggere il montaggio buono.",
      status: "Workspace",
      icon: History,
    },
    {
      title: "Performance → timeline",
      description: "Collegare retention e skip alle decisioni di montaggio e proporre una V2 più informata. È roadmap esplicita, non una funzione dichiarata come attiva.",
      status: "Roadmap",
      icon: LineChart,
      roadmap: true,
    },
  ],
};

export function Features() {
  const { i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const isItalian = i18n.resolvedLanguage?.startsWith("it");
  const features = FEATURES[isItalian ? "it" : "en"];

  return (
    <section id="features" className="py-24 md:py-36">
      <div className="container-page">
        <div className="max-w-3xl">
          <p className="mono-eyebrow mb-4 text-primary">{isItalian ? "Il sistema" : "The system"}</p>
          <h2 className="text-display-md font-semibold">
            {isItalian ? "Più veloce dell’automazione." : "Faster than automation."}{" "}
            <span className="serif-accent">{isItalian ? "Più preciso del manuale." : "More precise than guesswork."}</span>
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-foreground/70">
            {isItalian
              ? "REELassati unisce una timeline professionale, assistenza revisionabile e strumenti per ideare, generare, organizzare e consegnare short-form."
              : "REELassati combines a professional timeline, reviewable assistance, and the tools to ideate, generate, organize, and deliver short-form work."}
          </p>
        </div>

        <motion.div
          variants={stagger}
          initial={reduceMotion ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-3"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.article
                key={feature.title}
                variants={fadeUp}
                whileHover={reduceMotion ? undefined : { y: -4 }}
                transition={{ type: "spring", stiffness: 200, damping: 24 }}
                className={`group relative rounded-lg border p-7 shadow-card transition-shadow duration-300 hover:shadow-card-hover ${
                  feature.roadmap ? "border-dashed border-primary/30 bg-primary/[0.035]" : "border-border bg-surface"
                }`}
              >
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="mono-eyebrow text-foreground/30">0{index + 1}</span>
                    <span className={`rounded-pill px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${
                      feature.roadmap ? "bg-primary/10 text-primary" : "bg-foreground/[0.05] text-foreground/50"
                    }`}>
                      {feature.status}
                    </span>
                  </div>
                </div>
                <h3 className="text-xl font-semibold tracking-tight">{feature.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-foreground/65">{feature.description}</p>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
