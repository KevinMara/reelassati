import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Film,
  GraduationCap,
  MessageSquareText,
  Mic2,
  MousePointer2,
  Scissors,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type Language = "en" | "it";

type EditStep = {
  interval: string;
  action: string;
  reason: string;
  mode: "manual" | "assist";
};

type EditPlan = {
  kind: "product" | "education" | "story" | "custom";
  format: string;
  duration: number;
  direction: string;
  steps: EditStep[];
  checks: string[];
};

const PRESETS = {
  en: [
    {
      id: "product",
      name: "Product proof",
      prompt:
        "Turn my 42-second skincare demo into a credible product short for people with oily skin.",
    },
    {
      id: "education",
      name: "Educational cut",
      prompt:
        "Tighten my talking-head lesson about why creators lose attention in the first five seconds.",
    },
    {
      id: "story",
      name: "Founder story",
      prompt:
        "Shape my founder story into a 35-second reel without making it sound like an advertisement.",
    },
  ],
  it: [
    {
      id: "product",
      name: "Prova prodotto",
      prompt:
        "Trasforma la mia demo skincare di 42 secondi in uno short credibile per chi ha la pelle grassa.",
    },
    {
      id: "education",
      name: "Cut educativo",
      prompt:
        "Stringi la mia lezione talking-head su perché i creator perdono attenzione nei primi cinque secondi.",
    },
    {
      id: "story",
      name: "Storia founder",
      prompt:
        "Dai forma alla mia storia da founder in un reel di 35 secondi senza farla sembrare pubblicità.",
    },
  ],
} as const;

const COPY = {
  en: {
    eyebrow: "Edit-plan preview",
    title: "Describe the change. Inspect the plan.",
    body: "This interactive preview runs locally in your browser. It uses transparent rules—not AI processing—and never pretends to modify a real file.",
    promptLabel: "What should the edit accomplish?",
    placeholder:
      "Example: tighten my 50-second talking head into a clear 30-second launch reel…",
    action: "Build local plan",
    local: "Local deterministic preview",
    brief: "Interpreted brief",
    timeline: "Proposed timeline",
    manual: "Manual",
    assist: "Assisted",
    quality: "Preflight",
    director: "Prompt Director handoff",
    directorLead:
      "Use this production direction when a generated insert is needed:",
    open: "Continue in the Studio",
    noUpload: "No upload · no AI processing · no fabricated score",
    live: "Plan rebuilt",
  },
  it: {
    eyebrow: "Anteprima piano di montaggio",
    title: "Descrivi la modifica. Ispeziona il piano.",
    body: "Questa anteprima interattiva gira in locale nel browser. Usa regole trasparenti, non elaborazione AI, e non finge di modificare un file reale.",
    promptLabel: "Cosa deve ottenere il montaggio?",
    placeholder:
      "Esempio: stringi il mio talking-head di 50 secondi in un reel lancio chiaro da 30 secondi…",
    action: "Crea piano locale",
    local: "Anteprima locale deterministica",
    brief: "Brief interpretato",
    timeline: "Timeline proposta",
    manual: "Manuale",
    assist: "Assistito",
    quality: "Preflight",
    director: "Passaggio a Prompt Director",
    directorLead:
      "Usa questa direzione produttiva se serve un inserto generato:",
    open: "Continua nello Studio",
    noUpload:
      "Nessun upload · nessuna elaborazione AI · nessun punteggio inventato",
    live: "Piano aggiornato",
  },
} as const;

const PRODUCT_WORDS =
  /\b(product|launch|shop|skin|brand|demo|review|prodotto|lancio|skincare|recensione)\b/i;
const EDUCATION_WORDS =
  /\b(teach|lesson|explain|tip|learn|creator|educat|lezione|spiega|consiglio|impara)\b/i;
const STORY_WORDS =
  /\b(story|founder|journey|behind|storia|percorso|dietro)\b/i;
const NUMBER_PATTERN = /\b(\d{2})\s*(?:second|seconds|sec|s|secondi)\b/i;

function detectPlanKind(input: string): EditPlan["kind"] {
  if (PRODUCT_WORDS.test(input)) return "product";
  if (EDUCATION_WORDS.test(input)) return "education";
  if (STORY_WORDS.test(input)) return "story";
  return "custom";
}

function buildLocalPlan(
  input: string,
  language: Language,
  forcedKind?: EditPlan["kind"]
): EditPlan {
  const clean = input.trim().replace(/\s+/g, " ");
  const requestedDuration = clean.match(NUMBER_PATTERN)?.[1];
  const duration = Math.min(
    60,
    Math.max(20, requestedDuration ? Number(requestedDuration) : 34)
  );
  const closeStart = Math.max(16, duration - 4);
  const middleEnd = Math.max(13, Math.round(duration * 0.58));

  const kind = forcedKind ?? detectPlanKind(clean);
  const format =
    kind === "product"
      ? language === "it"
        ? "Prova prodotto"
        : "Product proof"
      : kind === "education"
        ? language === "it"
          ? "Spiegazione educativa"
          : "Educational cut"
        : kind === "story"
          ? language === "it"
            ? "Storia founder"
            : "Founder story"
          : language === "it"
            ? "Short-form narrativo"
            : "Narrative short-form";

  if (language === "it") {
    if (kind === "education") {
      return {
        kind,
        format,
        duration,
        direction: `Verticale 9:16, docente in camera coerente con “${clean.slice(0, 120)}”, esempi visivi leggibili, punch-in motivati, sottotitoli puliti, nessun elemento decorativo che compete con la spiegazione.`,
        steps: [
          {
            interval: "00:00–00:03",
            action:
              "Apri con l’errore più riconoscibile e una promessa didattica precisa.",
            reason:
              "Lo spettatore capisce subito problema e valore della spiegazione.",
            mode: "assist",
          },
          {
            interval: "00:03–00:08",
            action:
              "Riduci la premessa a una frase; mostra un esempio concreto mentre viene nominato.",
            reason:
              "L’esempio elimina il carico astratto e sostiene la comprensione.",
            mode: "manual",
          },
          {
            interval: `00:08–00:${String(middleEnd).padStart(2, "0")}`,
            action:
              "Dividi la lezione in tre passaggi numerati con sottotitoli brevi.",
            reason:
              "La struttura rende il contenuto memorizzabile senza accelerarlo artificialmente.",
            mode: "assist",
          },
          {
            interval: `00:${String(middleEnd).padStart(2, "0")}–00:${String(closeStart).padStart(2, "0")}`,
            action:
              "Inserisci un confronto prima/dopo o sbagliato/corretto sul punto decisivo.",
            reason:
              "Il contrasto visivo trasforma la regola in prova osservabile.",
            mode: "manual",
          },
          {
            interval: `00:${String(closeStart).padStart(2, "0")}–00:${String(duration).padStart(2, "0")}`,
            action:
              "Chiudi ricapitolando la regola in una riga e proponi una sola applicazione.",
            reason:
              "Il finale consolida l’apprendimento invece di aggiungere un nuovo concetto.",
            mode: "assist",
          },
        ],
        checks: [
          "Una sola idea per beat",
          "Esempi sincronizzati alla voce",
          "Termini chiave leggibili",
          "Nessun salto logico",
          "Riepilogo finale autonomo",
        ],
      };
    }

    if (kind === "story") {
      return {
        kind,
        format,
        duration,
        direction: `Verticale 9:16, racconto founder intimo coerente con “${clean.slice(0, 120)}”, camera stabile e vicina, luce naturale, dettagli reali del processo, pause umane, niente estetica pubblicitaria o claim gonfiati.`,
        steps: [
          {
            interval: "00:00–00:03",
            action:
              "Apri nel momento di tensione, prima di spiegare chi sei o cosa vendi.",
            reason:
              "Il conflitto crea curiosità senza dipendere da un hook artificiale.",
            mode: "assist",
          },
          {
            interval: "00:03–00:08",
            action:
              "Conserva un dettaglio personale specifico e taglia la biografia generica.",
            reason: "La specificità rende credibile la voce del founder.",
            mode: "manual",
          },
          {
            interval: `00:08–00:${String(middleEnd).padStart(2, "0")}`,
            action:
              "Costruisci la svolta con due momenti: cosa non funzionava e cosa hai cambiato.",
            reason: "Una trasformazione chiara dà direzione al racconto.",
            mode: "assist",
          },
          {
            interval: `00:${String(middleEnd).padStart(2, "0")}–00:${String(closeStart).padStart(2, "0")}`,
            action:
              "Mostra una prova del processo, non un montaggio celebrativo del risultato.",
            reason:
              "Il lavoro visibile evita il tono da spot e mantiene fiducia.",
            mode: "manual",
          },
          {
            interval: `00:${String(closeStart).padStart(2, "0")}–00:${String(duration).padStart(2, "0")}`,
            action:
              "Chiudi con ciò che stai costruendo adesso e invita a seguire il prossimo passo.",
            reason:
              "Una CTA narrativa continua la storia invece di interromperla.",
            mode: "assist",
          },
        ],
        checks: [
          "Dettaglio personale concreto",
          "Nessun tono da testimonial",
          "Arco narrativo completo",
          "Pause naturali conservate",
          "CTA coerente con la storia",
        ],
      };
    }

    return {
      kind,
      format,
      duration,
      direction: `Verticale 9:16, inserto realistico coerente con “${clean.slice(0, 120)}”, movimento camera motivato, luce naturale, continuità del soggetto, audio ambiente pulito, nessun testo generato nell’immagine.`,
      steps: [
        {
          interval: "00:00–00:02",
          action:
            "Porta per primo il momento visivo più forte; mantieni l’audio originale se apre con chiarezza.",
          reason: "Il primo beat deve comunicare il payoff prima del contesto.",
          mode: "assist",
        },
        {
          interval: "00:02–00:06",
          action:
            "Taglia pause e ripetizioni; conserva una frase completa e respirabile.",
          reason:
            "Comprensione prima della velocità: niente jump cut gratuiti.",
          mode: "manual",
        },
        {
          interval: `00:06–00:${String(middleEnd).padStart(2, "0")}`,
          action: `Costruisci il corpo come ${format.toLowerCase()} con sottotitoli a blocchi brevi e B-roll solo dove aggiunge prova.`,
          reason:
            "Ogni visual deve sostenere ciò che viene detto, non decorarlo.",
          mode: "assist",
        },
        {
          interval: `00:${String(middleEnd).padStart(2, "0")}–00:${String(closeStart).padStart(2, "0")}`,
          action:
            "Inserisci un cambio di scala o un dettaglio; blocca il resto della sequenza.",
          reason:
            "Un reset visivo mirato riattiva l’attenzione senza rompere la continuità.",
          mode: "manual",
        },
        {
          interval: `00:${String(closeStart).padStart(2, "0")}–00:${String(duration).padStart(2, "0")}`,
          action:
            "Chiudi con una sola azione concreta, senza claim non supportati.",
          reason: "Una CTA specifica è più facile da capire e verificare.",
          mode: "assist",
        },
      ],
      checks:
        kind === "product"
          ? [
              "Prodotto visibile entro 2 secondi",
              "Problema e payoff leggibili",
              "Claim verificabili",
              "Dettagli prodotto nitidi",
              "CTA singola e concreta",
            ]
          : [
              "Testo dentro la safe area 9:16",
              "Nessun taglio sopra una parola",
              "Livelli voce coerenti",
              "Claim verificabili",
              "Ultimo frame esportabile",
            ],
    };
  }

  if (kind === "education") {
    return {
      kind,
      format,
      duration,
      direction: `Vertical 9:16, presenter consistent with “${clean.slice(0, 120)}”, readable examples, motivated punch-ins, clean captions, and no decorative element competing with the explanation.`,
      steps: [
        {
          interval: "00:00–00:03",
          action:
            "Open on the most recognizable mistake and make one precise learning promise.",
          reason:
            "The viewer immediately understands both the problem and the value of staying.",
          mode: "assist",
        },
        {
          interval: "00:03–00:08",
          action:
            "Compress the setup to one sentence and show a concrete example as it is named.",
          reason:
            "The example removes abstraction and carries comprehension visually.",
          mode: "manual",
        },
        {
          interval: `00:08–00:${String(middleEnd).padStart(2, "0")}`,
          action:
            "Structure the lesson as three numbered moves with short caption blocks.",
          reason:
            "A visible sequence makes the lesson memorable without artificial speed.",
          mode: "assist",
        },
        {
          interval: `00:${String(middleEnd).padStart(2, "0")}–00:${String(closeStart).padStart(2, "0")}`,
          action:
            "Use a before/after or wrong/right comparison on the decisive point.",
          reason: "Contrast turns the rule into observable evidence.",
          mode: "manual",
        },
        {
          interval: `00:${String(closeStart).padStart(2, "0")}–00:${String(duration).padStart(2, "0")}`,
          action:
            "Close by restating the rule in one line and giving one action to try.",
          reason:
            "The ending consolidates learning instead of introducing another idea.",
          mode: "assist",
        },
      ],
      checks: [
        "One idea per beat",
        "Examples synced to speech",
        "Key terms stay readable",
        "No logical gaps",
        "Standalone final recap",
      ],
    };
  }

  if (kind === "story") {
    return {
      kind,
      format,
      duration,
      direction: `Vertical 9:16, intimate founder story consistent with “${clean.slice(0, 120)}”, close stable camera, natural light, real process details, human pauses, and no polished-ad language or inflated claims.`,
      steps: [
        {
          interval: "00:00–00:03",
          action:
            "Open inside the moment of tension before explaining who you are or what you sell.",
          reason: "Conflict creates curiosity without a manufactured hook.",
          mode: "assist",
        },
        {
          interval: "00:03–00:08",
          action:
            "Keep one specific personal detail and remove the generic biography.",
          reason: "Specificity makes the founder voice believable.",
          mode: "manual",
        },
        {
          interval: `00:08–00:${String(middleEnd).padStart(2, "0")}`,
          action:
            "Build the turn in two beats: what failed, then what you changed.",
          reason: "A clear transformation gives the story direction.",
          mode: "assist",
        },
        {
          interval: `00:${String(middleEnd).padStart(2, "0")}–00:${String(closeStart).padStart(2, "0")}`,
          action:
            "Show one piece of process evidence instead of a victory montage.",
          reason: "Visible work avoids ad polish and preserves trust.",
          mode: "manual",
        },
        {
          interval: `00:${String(closeStart).padStart(2, "0")}–00:${String(duration).padStart(2, "0")}`,
          action:
            "Close on what you are building now and invite viewers into the next step.",
          reason:
            "A narrative CTA continues the story instead of interrupting it.",
          mode: "assist",
        },
      ],
      checks: [
        "Specific personal detail",
        "No testimonial language",
        "Complete narrative arc",
        "Natural pauses preserved",
        "Story-led CTA",
      ],
    };
  }

  return {
    kind,
    format,
    duration,
    direction: `Vertical 9:16, realistic insert consistent with “${clean.slice(0, 120)}”, motivated camera movement, natural light, subject continuity, clean location sound, no generated text inside the image.`,
    steps: [
      {
        interval: "00:00–00:02",
        action:
          "Lead with the strongest visual moment; preserve the original audio when it opens clearly.",
        reason: "The first beat should communicate the payoff before context.",
        mode: "assist",
      },
      {
        interval: "00:02–00:06",
        action:
          "Trim pauses and repeated setup; keep one complete, breathable sentence.",
        reason: "Clarity comes before speed—no decorative jump cuts.",
        mode: "manual",
      },
      {
        interval: `00:06–00:${String(middleEnd).padStart(2, "0")}`,
        action: `Build the body as ${format.toLowerCase()} with short caption blocks and B-roll only where it adds evidence.`,
        reason:
          "Every visual should support the spoken point rather than decorate it.",
        mode: "assist",
      },
      {
        interval: `00:${String(middleEnd).padStart(2, "0")}–00:${String(closeStart).padStart(2, "0")}`,
        action:
          "Add one scale change or detail shot; lock the rest of the sequence.",
        reason:
          "A deliberate visual reset restores attention without breaking continuity.",
        mode: "manual",
      },
      {
        interval: `00:${String(closeStart).padStart(2, "0")}–00:${String(duration).padStart(2, "0")}`,
        action: "Close on one concrete next action without unsupported claims.",
        reason: "One specific CTA is easier to understand and verify.",
        mode: "assist",
      },
    ],
    checks:
      kind === "product"
        ? [
            "Product visible within 2 seconds",
            "Problem and payoff are clear",
            "Supportable claims only",
            "Product details stay sharp",
            "One concrete CTA",
          ]
        : [
            "Text inside 9:16 safe area",
            "No cuts across a spoken word",
            "Consistent voice level",
            "Supportable claims only",
            "Export-safe final frame",
          ],
  };
}

export default function AISandbox() {
  const { i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const language: Language = i18n.resolvedLanguage?.startsWith("it")
    ? "it"
    : "en";
  const copy = COPY[language];
  const presets = PRESETS[language];
  const [prompt, setPrompt] = useState<string>(presets[0].prompt);
  const [submittedPrompt, setSubmittedPrompt] = useState<string>(
    presets[0].prompt
  );
  const [activePreset, setActivePreset] = useState<EditPlan["kind"]>("product");
  const [submittedPreset, setSubmittedPreset] =
    useState<EditPlan["kind"]>("product");
  const plan = useMemo(
    () => buildLocalPlan(submittedPrompt, language, submittedPreset),
    [submittedPrompt, submittedPreset, language]
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = prompt.trim();
    if (clean) {
      setSubmittedPrompt(clean);
      setSubmittedPreset(activePreset ?? detectPlanKind(clean));
    }
  };

  const choosePreset = (id: EditPlan["kind"], value: string) => {
    setActivePreset(id);
    setPrompt(value);
    setSubmittedPrompt(value);
    setSubmittedPreset(id);
  };

  const presetIcon = {
    product: BadgeCheck,
    education: GraduationCap,
    story: Mic2,
  } as const;

  return (
    <section
      id="edit-plan"
      className="relative overflow-hidden border-t border-border bg-surface py-24 md:py-32"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-primary/[0.08] blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, 42, 0], y: [0, -24, 0], scale: [1, 1.12, 1] }
        }
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-28 bottom-12 h-80 w-80 rounded-full bg-primary/[0.06] blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, -34, 0], y: [0, 28, 0], scale: [1.08, 0.96, 1.08] }
        }
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="container-page">
        <motion.div
          initial={
            reduceMotion ? false : { opacity: 0, y: 28, filter: "blur(8px)" }
          }
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.45 }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="mono-eyebrow mb-3 text-primary">{copy.eyebrow}</p>
          <h2 className="text-display-md font-semibold">{copy.title}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-foreground/60">
            {copy.body}
          </p>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 34, scale: 0.985 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.16 }}
          transition={{ duration: 0.85, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto mt-12 max-w-6xl overflow-hidden rounded-2xl border border-border bg-background shadow-cutout"
        >
          <div
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent"
            aria-hidden
          />
          <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
            <div className="border-b border-border p-6 md:p-8 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2">
                <MessageSquareText
                  className="h-4 w-4 text-primary"
                  aria-hidden
                />
                <p className="text-sm font-semibold">{copy.promptLabel}</p>
              </div>

              <div
                className="mt-5 flex flex-wrap gap-2"
                aria-label={
                  language === "it" ? "Preset brief" : "Brief presets"
                }
              >
                {presets.map(preset => {
                  const PresetIcon = presetIcon[preset.id];
                  const selected = activePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => choosePreset(preset.id, preset.prompt)}
                      aria-pressed={selected}
                      className={`group inline-flex items-center gap-2 rounded-pill border px-3 py-2 text-xs font-medium transition-all duration-300 ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_24px_-12px_hsl(var(--primary))]"
                          : "border-border bg-surface text-foreground/60 hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      <PresetIcon className="h-3.5 w-3.5" aria-hidden />
                      {preset.name}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={submit} className="mt-5">
                <label htmlFor="edit-plan-brief" className="sr-only">
                  {copy.promptLabel}
                </label>
                <textarea
                  id="edit-plan-brief"
                  value={prompt}
                  onChange={event => {
                    setPrompt(event.target.value);
                    setActivePreset(detectPlanKind(event.target.value));
                  }}
                  placeholder={copy.placeholder}
                  rows={7}
                  className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-relaxed outline-none transition-shadow placeholder:text-foreground/35 focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="submit"
                  disabled={!prompt.trim()}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <MousePointer2 className="h-4 w-4" aria-hidden />{" "}
                  {copy.action}
                </button>
              </form>

              <p className="mt-4 font-mono text-[9px] uppercase tracking-wider text-foreground/40">
                {copy.noUpload}
              </p>
            </div>

            <div className="min-w-0 p-6 md:p-8" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${plan.kind}-${submittedPrompt}`}
                  initial={
                    reduceMotion
                      ? false
                      : { opacity: 0, x: 18, filter: "blur(6px)" }
                  }
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={
                    reduceMotion
                      ? undefined
                      : { opacity: 0, x: -12, filter: "blur(4px)" }
                  }
                  transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="mono-eyebrow text-primary">{copy.local}</p>
                      <h3 className="mt-2 text-2xl font-semibold">
                        {plan.format} · {plan.duration}s
                      </h3>
                    </div>
                    <span className="rounded-pill border border-border bg-surface px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-foreground/50">
                      <span
                        className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
                        aria-hidden
                      />
                      {copy.live}
                    </span>
                  </div>

                  <div className="mt-7">
                    <p className="mono-eyebrow mb-3 text-foreground/45">
                      {copy.timeline}
                    </p>
                    <div className="space-y-2">
                      {plan.steps.map((step, index) => (
                        <motion.article
                          key={`${step.interval}-${step.action}`}
                          initial={
                            reduceMotion
                              ? false
                              : { opacity: 0, y: 12, scale: 0.99 }
                          }
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: reduceMotion ? 0 : index * 0.055,
                            duration: 0.38,
                          }}
                          whileHover={
                            reduceMotion
                              ? undefined
                              : {
                                  x: 4,
                                  borderColor: "hsl(var(--primary) / 0.32)",
                                }
                          }
                          className="group grid gap-3 rounded-lg border border-border bg-surface p-4 transition-colors sm:grid-cols-[88px_1fr]"
                        >
                          <div>
                            <p className="font-mono text-[10px] tabular text-primary">
                              {step.interval}
                            </p>
                            <span className="mt-2 inline-flex items-center gap-1 rounded-pill bg-foreground/[0.05] px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-foreground/50">
                              {step.mode === "manual" ? (
                                <Scissors className="h-2.5 w-2.5" aria-hidden />
                              ) : (
                                <Film className="h-2.5 w-2.5" aria-hidden />
                              )}
                              {step.mode === "manual"
                                ? copy.manual
                                : copy.assist}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium leading-relaxed">
                              {step.action}
                            </p>
                            <p className="mt-1.5 text-xs leading-relaxed text-foreground/50">
                              {step.reason}
                            </p>
                          </div>
                        </motion.article>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-border bg-surface-recessed p-4">
                      <p className="mono-eyebrow mb-3 text-foreground/45">
                        {copy.quality}
                      </p>
                      <ul className="space-y-2">
                        {plan.checks.map(check => (
                          <li
                            key={check}
                            className="flex items-start gap-2 text-xs text-foreground/65"
                          >
                            <Check
                              className="mt-0.5 h-3 w-3 shrink-0 text-primary"
                              aria-hidden
                            />{" "}
                            {check}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-primary/20 bg-primary/[0.045] p-4">
                      <p className="mono-eyebrow mb-2 text-primary">
                        {copy.director}
                      </p>
                      <p className="text-[11px] leading-relaxed text-foreground/50">
                        {copy.directorLead}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-foreground/75">
                        {plan.direction}
                      </p>
                    </div>
                  </div>

                  <Link
                    to="/dashboard/edit"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
                  >
                    {copy.open} <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
