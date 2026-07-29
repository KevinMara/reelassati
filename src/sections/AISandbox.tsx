import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Film,
  Lock,
  MessageSquareText,
  MousePointer2,
  Scissors,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

type Language = "en" | "it";

type EditStep = {
  interval: string;
  action: string;
  reason: string;
  mode: "manual" | "assist";
};

type EditPlan = {
  format: string;
  duration: number;
  direction: string;
  steps: EditStep[];
  checks: string[];
};

const PRESETS = {
  en: [
    { id: "product", name: "Product proof", prompt: "Turn my 42-second skincare demo into a credible product short for people with oily skin." },
    { id: "education", name: "Educational cut", prompt: "Tighten my talking-head lesson about why creators lose attention in the first five seconds." },
    { id: "story", name: "Founder story", prompt: "Shape my founder story into a 35-second reel without making it sound like an advertisement." },
  ],
  it: [
    { id: "product", name: "Prova prodotto", prompt: "Trasforma la mia demo skincare di 42 secondi in uno short credibile per chi ha la pelle grassa." },
    { id: "education", name: "Cut educativo", prompt: "Stringi la mia lezione talking-head su perché i creator perdono attenzione nei primi cinque secondi." },
    { id: "story", name: "Storia founder", prompt: "Dai forma alla mia storia da founder in un reel di 35 secondi senza farla sembrare pubblicità." },
  ],
} as const;

const COPY = {
  en: {
    eyebrow: "Edit-plan preview",
    title: "Describe the change. Inspect the plan.",
    body: "This interactive preview runs locally in your browser. It uses transparent rules—not an AI provider—and never pretends to modify a real file.",
    promptLabel: "What should the edit accomplish?",
    placeholder: "Example: tighten my 50-second talking head into a clear 30-second launch reel…",
    action: "Build local plan",
    local: "Local deterministic preview",
    brief: "Interpreted brief",
    timeline: "Proposed timeline",
    manual: "Manual",
    assist: "Assisted",
    quality: "Preflight",
    director: "Prompt Director handoff",
    directorLead: "Use this production direction when a generated insert is needed:",
    open: "Continue in the Studio",
    noUpload: "No upload · no provider call · no fabricated score",
    lock: "Existing footage stays locked until you approve a change.",
  },
  it: {
    eyebrow: "Anteprima piano di montaggio",
    title: "Descrivi la modifica. Ispeziona il piano.",
    body: "Questa anteprima interattiva gira in locale nel browser. Usa regole trasparenti, non un provider AI, e non finge di modificare un file reale.",
    promptLabel: "Cosa deve ottenere il montaggio?",
    placeholder: "Esempio: stringi il mio talking-head di 50 secondi in un reel lancio chiaro da 30 secondi…",
    action: "Crea piano locale",
    local: "Anteprima locale deterministica",
    brief: "Brief interpretato",
    timeline: "Timeline proposta",
    manual: "Manuale",
    assist: "Assistito",
    quality: "Preflight",
    director: "Passaggio a Prompt Director",
    directorLead: "Usa questa direzione produttiva se serve un inserto generato:",
    open: "Continua nello Studio",
    noUpload: "Nessun upload · nessuna chiamata provider · nessun punteggio inventato",
    lock: "Il girato esistente resta bloccato finché non approvi una modifica.",
  },
} as const;

const PRODUCT_WORDS = /\b(product|launch|shop|skin|brand|demo|review|prodotto|lancio|skincare|recensione)\b/i;
const EDUCATION_WORDS = /\b(teach|lesson|explain|tip|learn|creator|educat|lezione|spiega|consiglio|impara)\b/i;
const STORY_WORDS = /\b(story|founder|journey|behind|storia|percorso|dietro)\b/i;
const NUMBER_PATTERN = /\b(\d{2})\s*(?:second|seconds|sec|s|secondi)\b/i;

function buildLocalPlan(input: string, language: Language): EditPlan {
  const clean = input.trim().replace(/\s+/g, " ");
  const requestedDuration = clean.match(NUMBER_PATTERN)?.[1];
  const duration = Math.min(60, Math.max(20, requestedDuration ? Number(requestedDuration) : 34));
  const closeStart = Math.max(16, duration - 4);
  const middleEnd = Math.max(13, Math.round(duration * 0.58));

  const format = PRODUCT_WORDS.test(clean)
    ? language === "it" ? "Prova prodotto" : "Product proof"
    : EDUCATION_WORDS.test(clean)
      ? language === "it" ? "Spiegazione educativa" : "Educational explanation"
      : STORY_WORDS.test(clean)
        ? language === "it" ? "Storia in prima persona" : "First-person story"
        : language === "it" ? "Short-form narrativo" : "Narrative short-form";

  if (language === "it") {
    return {
      format,
      duration,
      direction: `Verticale 9:16, inserto realistico coerente con “${clean.slice(0, 120)}”, movimento camera motivato, luce naturale, continuità del soggetto, audio ambiente pulito, nessun testo generato nell’immagine.`,
      steps: [
        { interval: "00:00–00:02", action: "Porta per primo il momento visivo più forte; mantieni l’audio originale se apre con chiarezza.", reason: "Il primo beat deve comunicare il payoff prima del contesto.", mode: "assist" },
        { interval: "00:02–00:06", action: "Taglia pause e ripetizioni; conserva una frase completa e respirabile.", reason: "Comprensione prima della velocità: niente jump cut gratuiti.", mode: "manual" },
        { interval: `00:06–00:${String(middleEnd).padStart(2, "0")}`, action: `Costruisci il corpo come ${format.toLowerCase()} con sottotitoli a blocchi brevi e B-roll solo dove aggiunge prova.`, reason: "Ogni visual deve sostenere ciò che viene detto, non decorarlo.", mode: "assist" },
        { interval: `00:${String(middleEnd).padStart(2, "0")}–00:${String(closeStart).padStart(2, "0")}`, action: "Inserisci un cambio di scala o un dettaglio; blocca il resto della sequenza.", reason: "Un reset visivo mirato riattiva l’attenzione senza rompere la continuità.", mode: "manual" },
        { interval: `00:${String(closeStart).padStart(2, "0")}–00:${String(duration).padStart(2, "0")}`, action: "Chiudi con una sola azione concreta, senza claim non supportati.", reason: "Una CTA specifica è più facile da capire e verificare.", mode: "assist" },
      ],
      checks: ["Testo dentro la safe area 9:16", "Nessun taglio sopra una parola", "Livelli voce coerenti", "Claim verificabili", "Ultimo frame esportabile"],
    };
  }

  return {
    format,
    duration,
    direction: `Vertical 9:16, realistic insert consistent with “${clean.slice(0, 120)}”, motivated camera movement, natural light, subject continuity, clean location sound, no generated text inside the image.`,
    steps: [
      { interval: "00:00–00:02", action: "Lead with the strongest visual moment; preserve the original audio when it opens clearly.", reason: "The first beat should communicate the payoff before context.", mode: "assist" },
      { interval: "00:02–00:06", action: "Trim pauses and repeated setup; keep one complete, breathable sentence.", reason: "Clarity comes before speed—no decorative jump cuts.", mode: "manual" },
      { interval: `00:06–00:${String(middleEnd).padStart(2, "0")}`, action: `Build the body as ${format.toLowerCase()} with short caption blocks and B-roll only where it adds evidence.`, reason: "Every visual should support the spoken point rather than decorate it.", mode: "assist" },
      { interval: `00:${String(middleEnd).padStart(2, "0")}–00:${String(closeStart).padStart(2, "0")}`, action: "Add one scale change or detail shot; lock the rest of the sequence.", reason: "A deliberate visual reset restores attention without breaking continuity.", mode: "manual" },
      { interval: `00:${String(closeStart).padStart(2, "0")}–00:${String(duration).padStart(2, "0")}`, action: "Close on one concrete next action without unsupported claims.", reason: "One specific CTA is easier to understand and verify.", mode: "assist" },
    ],
    checks: ["Text inside 9:16 safe area", "No cuts across a spoken word", "Consistent voice level", "Supportable claims only", "Export-safe final frame"],
  };
}

export default function AISandbox() {
  const { i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const language: Language = i18n.resolvedLanguage?.startsWith("it") ? "it" : "en";
  const copy = COPY[language];
  const presets = PRESETS[language];
  const [prompt, setPrompt] = useState<string>(presets[0].prompt);
  const [submittedPrompt, setSubmittedPrompt] = useState<string>(presets[0].prompt);
  const plan = useMemo(() => buildLocalPlan(submittedPrompt, language), [submittedPrompt, language]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = prompt.trim();
    if (clean) setSubmittedPrompt(clean);
  };

  const choosePreset = (value: string) => {
    setPrompt(value);
    setSubmittedPrompt(value);
  };

  return (
    <section id="edit-plan" className="relative overflow-hidden border-t border-border bg-surface py-24 md:py-32">
      <div className="container-page">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mono-eyebrow mb-3 text-primary">{copy.eyebrow}</p>
          <h2 className="text-display-md font-semibold">{copy.title}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-foreground/60">{copy.body}</p>
        </div>

        <div className="mx-auto mt-12 max-w-6xl overflow-hidden rounded-2xl border border-border bg-background shadow-cutout">
          <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
            <div className="border-b border-border p-6 md:p-8 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-primary" aria-hidden />
                <p className="text-sm font-semibold">{copy.promptLabel}</p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2" aria-label={language === "it" ? "Preset brief" : "Brief presets"}>
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => choosePreset(preset.prompt)}
                    className={`rounded-pill border px-3 py-2 text-xs font-medium transition-colors ${
                      prompt === preset.prompt
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-surface text-foreground/60 hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="mt-5">
                <label htmlFor="edit-plan-brief" className="sr-only">{copy.promptLabel}</label>
                <textarea
                  id="edit-plan-brief"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={copy.placeholder}
                  rows={7}
                  className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-relaxed outline-none transition-shadow placeholder:text-foreground/35 focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="submit"
                  disabled={!prompt.trim()}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <MousePointer2 className="h-4 w-4" aria-hidden /> {copy.action}
                </button>
              </form>

              <p className="mt-4 font-mono text-[9px] uppercase tracking-wider text-foreground/40">{copy.noUpload}</p>
              <div className="mt-6 rounded-lg border border-border bg-surface-recessed p-4">
                <div className="flex items-start gap-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <p className="text-xs leading-relaxed text-foreground/60">{copy.lock}</p>
                </div>
              </div>
            </div>

            <div className="min-w-0 p-6 md:p-8" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="mono-eyebrow text-primary">{copy.local}</p>
                  <h3 className="mt-2 text-2xl font-semibold">{plan.format} · {plan.duration}s</h3>
                </div>
                <span className="rounded-pill border border-border bg-surface px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-foreground/50">
                  {copy.brief}
                </span>
              </div>

              <div className="mt-7">
                <p className="mono-eyebrow mb-3 text-foreground/45">{copy.timeline}</p>
                <div className="space-y-2">
                  {plan.steps.map((step, index) => (
                    <motion.article
                      key={`${step.interval}-${step.action}`}
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: reduceMotion ? 0 : index * 0.045 }}
                      className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-[88px_1fr]"
                    >
                      <div>
                        <p className="font-mono text-[10px] tabular text-primary">{step.interval}</p>
                        <span className="mt-2 inline-flex items-center gap-1 rounded-pill bg-foreground/[0.05] px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-foreground/50">
                          {step.mode === "manual" ? <Scissors className="h-2.5 w-2.5" aria-hidden /> : <Film className="h-2.5 w-2.5" aria-hidden />}
                          {step.mode === "manual" ? copy.manual : copy.assist}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-relaxed">{step.action}</p>
                        <p className="mt-1.5 text-xs leading-relaxed text-foreground/50">{step.reason}</p>
                      </div>
                    </motion.article>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-surface-recessed p-4">
                  <p className="mono-eyebrow mb-3 text-foreground/45">{copy.quality}</p>
                  <ul className="space-y-2">
                    {plan.checks.map((check) => (
                      <li key={check} className="flex items-start gap-2 text-xs text-foreground/65">
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" aria-hidden /> {check}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/[0.045] p-4">
                  <p className="mono-eyebrow mb-2 text-primary">{copy.director}</p>
                  <p className="text-[11px] leading-relaxed text-foreground/50">{copy.directorLead}</p>
                  <p className="mt-2 text-xs leading-relaxed text-foreground/75">{plan.direction}</p>
                </div>
              </div>

              <Link
                to="/dashboard/edit"
                className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
              >
                {copy.open} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
