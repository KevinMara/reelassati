import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight, Check, Scissors } from "lucide-react";
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
const WAVEFORM = Array.from({ length: 48 }, (_, index) =>
  Math.min(20 + Math.abs(Math.sin(index * 0.7) * 60) + (index % 5) * 6, 100)
);

const COPY = {
  en: {
    eyebrow: "The editing-first short-form studio",
    title: "Short-form content.",
    accent: "Accelerated. Sharpened.",
    body: "Script, cut, caption and publish in one workspace.",
    primary: "Open the Studio",
    secondary: "Explore the product",
    preview: "Caption & crop demo",
    selected: "Selected range",
    locked: "Opening locked",
    plan: "A clearer opening",
    change: "Focus the frame",
    reason: "Bring the product forward",
    approve: "Approve",
    timeline: "Timeline",
    caption: "Caption",
    status: "Ready for review",
  },
  it: {
    eyebrow: "Studio short-form centrato sul montaggio",
    title: "Short-form content.",
    accent: "Accelerated. Sharpened.",
    body: "Script, montaggio, sottotitoli e pubblicazione in un solo workspace.",
    primary: "Apri lo Studio",
    secondary: "Esplora il prodotto",
    preview: "Demo taglio e sottotitoli",
    selected: "Intervallo selezionato",
    locked: "Apertura bloccata",
    plan: "Un’apertura più chiara",
    change: "Metti a fuoco il soggetto",
    reason: "Porta il prodotto in primo piano",
    approve: "Approva",
    timeline: "Timeline",
    caption: "Sottotitolo",
    status: "Pronto da revisionare",
  },
} as const;

export function Hero() {
  const { i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const copy = COPY[i18n.resolvedLanguage?.startsWith("it") ? "it" : "en"];

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute right-0 top-0 h-[600px] w-[600px] rounded-full opacity-[0.35] blur-3xl pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, hsl(var(--primary) / 0.18), transparent 60%)",
        }}
      />
      <div className="container-page relative pb-16 pt-20 md:pb-24 md:pt-28">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
          <motion.div
            initial={reduceMotion ? false : "hidden"}
            animate="show"
            variants={stagger}
            className="lg:col-span-7"
          >
            <motion.p
              variants={fadeUp}
              className="mono-eyebrow mb-5 text-primary"
            >
              {copy.eyebrow}
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="max-w-[760px] tracking-[-0.04em]"
            >
              <span className="block text-[clamp(3.25rem,5vw,4.75rem)] font-semibold leading-[0.98]">
                {copy.title}
              </span>
              <span className="mt-2 block font-serif text-[clamp(3rem,4.7vw,4.45rem)] font-normal italic leading-[1.02] tracking-[-0.035em] text-primary">
                {copy.accent}
              </span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-[610px] text-lg leading-relaxed text-foreground/65 md:text-xl"
            >
              {copy.body}
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="mt-10 flex flex-wrap items-center gap-3"
            >
              <Link
                to="/auth/signup"
                className="inline-flex items-center gap-2 rounded-pill bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_14px_30px_-16px_hsl(var(--primary))] transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
              >
                {copy.primary} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                to="/showcase"
                className="inline-flex items-center gap-2 rounded-pill px-4 py-3 text-sm text-foreground/70 transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
              >
                {copy.secondary}
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial={
              reduceMotion ? false : { opacity: 0, x: 40, filter: "blur(8px)" }
            }
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={{ duration: 1, ease, delay: reduceMotion ? 0 : 0.3 }}
            className="relative lg:col-span-5"
          >
            <HeroEditorPreview copy={copy} />
          </motion.div>
        </div>
      </div>
      <MarqueeBar />
    </section>
  );
}

function HeroEditorPreview({
  copy,
}: {
  copy: (typeof COPY)[keyof typeof COPY];
}) {
  const [finished, setFinished] = useState(true);
  const italian = copy.preview.startsWith("Demo");
  return (
    <div
      className="cutout relative mx-auto w-full max-w-[440px] overflow-hidden"
      aria-label={copy.preview}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="font-mono text-xs uppercase tracking-wider text-foreground/70">
            {copy.preview}
          </span>
        </div>
        <span className="rounded-pill bg-primary/10 px-2.5 py-1 font-mono text-xs uppercase tracking-wider text-primary">
          {copy.status}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-3 p-3">
        <div className="relative aspect-[9/15] overflow-hidden rounded-lg border border-border bg-gradient-to-br from-primary/25 via-primary/10 to-foreground/[0.06]">
          <img
            src="/demo/coffee.jpg"
            alt={
              italian
                ? "Cappuccino con latte art, media dimostrativo"
                : "Latte art coffee, sample media"
            }
            width={1400}
            height={2097}
            className={`absolute inset-0 h-full w-full object-cover transition-transform duration-300 ${finished ? "scale-125" : "scale-100"}`}
            style={{ objectPosition: "center 60%" }}
          />
          {finished && (
            <div className="absolute inset-x-3 bottom-12 text-center">
              <span className="inline-block rounded-md bg-background/90 px-2.5 py-1 text-xs font-bold tracking-tight text-foreground shadow-subtle">
                {italian ? "La tua" : "Your daily"}{" "}
                <span className="rounded-sm bg-primary px-1 text-primary-foreground">
                  {italian ? "pausa perfetta." : "perfect pause."}
                </span>{" "}
              </span>
            </div>
          )}
          <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
            {italian ? "Media dimostrativo" : "Sample media"}
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="font-mono text-xs uppercase tracking-wider text-primary">
              {copy.plan}
            </p>
            <div className="mt-3 flex items-start gap-2">
              <div className="mt-0.5 rounded-md bg-primary/10 p-1.5 text-primary">
                <Scissors className="h-3 w-3" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold">{copy.change}</p>
                <p className="mt-1 text-xs leading-relaxed text-foreground/70">
                  {copy.reason}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-pressed={finished}
              onClick={() => setFinished(value => !value)}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-2 text-xs font-medium text-primary-foreground"
            >
              <Check className="h-3 w-3" aria-hidden />{" "}
              {finished
                ? italian
                  ? "Vedi originale"
                  : "View original"
                : italian
                  ? "Vedi risultato"
                  : "View result"}
            </button>
          </div>
          <div className="rounded-lg border border-border bg-surface-recessed p-3">
            <p className="font-mono text-xs uppercase tracking-wider text-foreground/70">
              {copy.selected}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-pill bg-foreground/10">
              <div className="ml-[18%] h-full w-[42%] rounded-pill bg-primary" />
            </div>
            <div className="mt-2 flex justify-between font-mono text-xs text-foreground/70">
              <span>00:01.2</span>
              <span>00:04.8</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border px-3 pb-3 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-foreground/70">
            {copy.timeline}
          </span>
          <span className="font-mono text-xs text-primary">{copy.caption}</span>
        </div>
        <div className="flex h-10 items-end gap-[2px] rounded-md bg-surface-recessed px-2 py-1">
          {WAVEFORM.map((height, index) => (
            <div
              key={index}
              className="flex-1 rounded-sm bg-primary/70"
              style={{
                height: `${height}%`,
                opacity: index >= 9 && index <= 28 ? 1 : 0.28,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MarqueeBar() {
  const { i18n } = useTranslation();
  const isItalian = i18n.resolvedLanguage?.startsWith("it");
  const labels = isItalian
    ? [
        "Timeline manuale",
        "Piano AI revisionabile",
        "Generazione su intervallo",
        "Prompt Director",
        "Versioni",
        "TRIBE v2",
        "Sottotitoli",
        "Brand DNA",
      ]
    : [
        "Manual timeline",
        "Reviewable AI plan",
        "Selected-range generation",
        "Prompt Director",
        "Version history",
        "TRIBE v2",
        "Captions",
        "Brand DNA",
      ];
  const doubled = [...labels, ...labels];

  return (
    <div className="relative overflow-hidden border-y border-border bg-surface/50">
      <div className="flex animate-marquee whitespace-nowrap py-4 motion-reduce:animate-none">
        {doubled.map((label, index) => (
          <span
            key={`${label}-${index}`}
            className="mono-eyebrow mx-6 inline-flex items-center text-foreground/70"
          >
            <span className="mr-6 h-1 w-1 rounded-full bg-primary" />
            {label}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
