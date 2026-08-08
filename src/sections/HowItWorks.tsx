import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from "framer-motion";
import { useTranslation } from "react-i18next";

const ease = [0.16, 1, 0.3, 1] as const;
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease },
  },
};
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const STEPS = {
  en: [
    {
      num: "01",
      title: "Bring the material",
      description:
        "Upload footage, start from a brief, or capture a voice note. Add the audience and outcome before editing.",
    },
    {
      num: "02",
      title: "Direct the cut",
      description:
        "Work manually on the timeline or ask for a change in plain language. Select and lock any range that must stay untouched.",
    },
    {
      num: "03",
      title: "Review every proposal",
      description:
        "See what will change, where, and why. Accept individual edits, compare a version, or keep your original.",
    },
    {
      num: "04",
      title: "Finish and deliver",
      description:
        "Run a quality preflight, export the right format, or publish after connecting an authorized platform account.",
    },
  ],
  it: [
    {
      num: "01",
      title: "Porta il materiale",
      description:
        "Carica il girato, parti da un brief o registra una nota vocale. Definisci pubblico e risultato prima del montaggio.",
    },
    {
      num: "02",
      title: "Dirigi il montaggio",
      description:
        "Lavora manualmente sulla timeline o chiedi una modifica in linguaggio naturale. Seleziona e blocca ciò che non deve cambiare.",
    },
    {
      num: "03",
      title: "Revisiona ogni proposta",
      description:
        "Vedi cosa cambierà, dove e perché. Accetta singole modifiche, confronta una versione o conserva l’originale.",
    },
    {
      num: "04",
      title: "Finalizza e consegna",
      description:
        "Esegui il preflight qualità, esporta nel formato giusto o pubblica dopo aver collegato un account autorizzato.",
    },
  ],
} as const;

export function HowItWorks() {
  const { i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.4"],
  });
  const playhead = useTransform(scrollYProgress, [0, 1], ["8%", "88%"]);
  const isItalian = i18n.resolvedLanguage?.startsWith("it");
  const steps = STEPS[isItalian ? "it" : "en"];

  return (
    <section
      ref={ref}
      className="border-y border-border bg-surface/40 py-24 md:py-36"
    >
      <div className="container-page">
        <div className="max-w-3xl">
          <p className="mono-eyebrow mb-4 text-primary">
            {isItalian
              ? "Dal girato alla versione finale"
              : "From footage to final"}
          </p>
          <h2 className="text-display-md font-semibold">
            {isItalian
              ? "Assistenza dove serve."
              : "Assistance where it helps."}{" "}
            <span className="serif-accent">
              {isItalian
                ? "Controllo dove conta."
                : "Control where it matters."}
            </span>
          </h2>
        </div>

        <div className="mx-auto mt-16 w-full max-w-4xl rounded-xl border border-border-strong bg-surface p-4 shadow-cutout md:p-6">
          <div className="timeline-preview-header flex items-center justify-between border-b pb-4">
            <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/60">
              {isItalian
                ? "Sequenza / Lancio prodotto"
                : "Sequence / Product launch"}
            </span>
            <span className="rounded-pill bg-primary/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-primary">
              {isItalian ? "Versione 03" : "Version 03"}
            </span>
          </div>
          <div className="timeline-preview-canvas relative mt-5 space-y-2 overflow-hidden rounded-lg border p-3">
            <motion.div
              aria-hidden
              style={{ left: reduceMotion ? "48%" : playhead }}
              className="absolute bottom-2 top-2 z-10 w-px bg-primary"
            >
              <span className="absolute -left-1 top-0 h-2 w-2 rotate-45 bg-primary" />
            </motion.div>
            <Track
              label={isItalian ? "Video" : "Video"}
              widths={["32%", "19%", "38%"]}
            />
            <Track
              label={isItalian ? "Voce" : "Voice"}
              widths={["18%", "42%", "28%"]}
              muted
            />
            <Track
              label={isItalian ? "Testo" : "Text"}
              widths={["24%", "29%", "36%"]}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-foreground/65">
            <span>
              {isItalian
                ? "L’intervallo viola è selezionato. Il resto rimane bloccato."
                : "The purple range is selected. Everything else stays locked."}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
              {isItalian ? "1 modifica in revisione" : "1 change in review"}
            </span>
          </div>
        </div>

        <motion.div
          variants={stagger}
          initial={reduceMotion ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          className="mt-16 grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-4"
        >
          {steps.map(step => (
            <motion.article
              key={step.num}
              variants={fadeUp}
              className="relative bg-background p-8 md:p-9"
            >
              <div className="mb-6 flex items-baseline justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-primary">
                  {step.num}
                </span>
                <span className="mono-eyebrow text-foreground/30">
                  {isItalian ? "passo" : "step"}
                </span>
              </div>
              <h3 className="text-2xl font-semibold">{step.title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-foreground/65">
                {step.description}
              </p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Track({
  label,
  widths,
  muted = false,
}: {
  label: string;
  widths: string[];
  muted?: boolean;
}) {
  return (
    <div className="grid grid-cols-[48px_1fr] items-center gap-2">
      <span className="timeline-preview-label font-mono text-[8px] font-medium uppercase tracking-wider">
        {label}
      </span>
      <div className="flex h-9 items-stretch gap-1">
        {widths.map((width, index) => (
          <div
            key={`${label}-${index}`}
            className={`rounded-sm border ${
              index === 1 && !muted
                ? "timeline-preview-clip-selected"
                : "timeline-preview-clip"
            }`}
            style={{ width, opacity: muted ? 0.72 : 1 }}
          />
        ))}
      </div>
    </div>
  );
}
