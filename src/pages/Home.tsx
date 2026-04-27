import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import {
  ArrowRight,
  Activity,
  PenLine,
  Scissors,
  Send,
  LineChart,
  Users,
  Check,
} from "lucide-react";
import { MarketingLayout } from "@/components/brand/MarketingLayout";
import { Button } from "@/components/ui/button";

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

export default function Home() {
  return (
    <MarketingLayout>
      <Hero />
      <Marquee />
      <Features />
      <HowItWorks />
      <Platforms />
      <PricingTeaser />
    </MarketingLayout>
  );
}

/* ───────────────────────── HERO ───────────────────────── */

function Hero() {
  const { t } = useTranslation();
  const marquee = t("home.marquee", { returnObjects: true }) as string[];

  return (
    <section className="relative overflow-hidden">
      {/* Faint amethyst wash in upper right — Italian Renaissance light */}
      <div
        aria-hidden
        className="absolute top-0 right-0 h-[600px] w-[600px] rounded-full opacity-[0.35] blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.18), transparent 60%)" }}
      />

      <div className="container-page relative pt-20 md:pt-28 pb-16 md:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* LEFT — typography column */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="lg:col-span-7"
          >
            <motion.p variants={fadeUp} className="mono-eyebrow text-primary mb-5">
              {t("brand.eyebrow")}
            </motion.p>

            <motion.h1
              variants={fadeUp}
              className="text-display-xl font-semibold"
            >
              {t("home.hero_lead")} <span className="serif-accent">{t("home.hero_accent")}</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-7 text-lg md:text-xl text-foreground/70 leading-relaxed max-w-[520px]"
            >
              {t("home.hero_sub")}
            </motion.p>

            <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-3">
              <Button asChild variant="primary" size="xl">
                <Link to="/auth/signup">
                  {t("cta.start_free")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="xl">
                <Link to="/pricing">{t("cta.view_pricing")}</Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* RIGHT — Cutout UI artifact */}
          <motion.div
            initial={{ opacity: 0, x: 40, filter: "blur(8px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={{ duration: 1, ease, delay: 0.3 }}
            className="lg:col-span-5 relative"
          >
            <HeroCutout chip={t("home.hero_chip")} />
          </motion.div>
        </div>
      </div>

      {/* Marquee strip kept inside hero as bottom rule */}
      <_MarqueeBare items={marquee} />
    </section>
  );
}

function HeroCutout({ chip }: { chip: string }) {
  return (
    <div className="relative mx-auto w-full max-w-[420px] aspect-[9/14] cutout overflow-hidden">
      {/* Phone-style frame inside */}
      <div className="absolute inset-3 rounded-xl overflow-hidden bg-gradient-to-b from-primary/15 via-foreground/[0.04] to-foreground/[0.02]">
        {/* Mock vertical video composition */}
        <div className="absolute inset-0 grain" />

        {/* "Subject" silhouette */}
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 bottom-0 w-3/5 h-3/5 rounded-t-[40%] bg-gradient-to-t from-foreground/30 to-foreground/10"
        />

        {/* Captions overlay */}
        <div className="absolute inset-x-6 bottom-24 text-center">
          <span className="inline-block font-bold text-foreground bg-background/90 px-2.5 py-1 rounded-md text-sm tracking-tight shadow-subtle">
            La verità è{" "}
            <span className="bg-primary text-primary-foreground px-1.5 rounded-sm">una sola.</span>
          </span>
        </div>

        {/* Top status bar mock */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between text-[10px] font-mono text-foreground/60">
          <span>0:00 · 0:42</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
            LIVE EDIT
          </span>
        </div>

        {/* Waveform strip */}
        <div className="absolute bottom-3 inset-x-3 flex items-end gap-[2px] h-10 px-1">
          {Array.from({ length: 48 }).map((_, i) => {
            const h = 20 + Math.abs(Math.sin(i * 0.7) * 60) + (i % 5) * 6;
            return (
              <div
                key={i}
                className="flex-1 rounded-sm bg-primary/70"
                style={{ height: `${Math.min(h, 100)}%`, opacity: i < 18 ? 1 : 0.35 }}
              />
            );
          })}
        </div>
      </div>

      {/* Floating stat chip — bottom-left overlap */}
      <div className="absolute -bottom-4 -left-4 bg-foreground text-background rounded-pill px-4 py-2 shadow-cutout">
        <span className="font-mono text-xs uppercase tracking-wider">⏱ {chip}</span>
      </div>

      {/* Floating score chip — top-right overlap */}
      <div className="absolute -top-4 -right-3 bg-surface border border-border rounded-pill px-3 py-2 shadow-cutout flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="font-mono text-xs">Hook score</span>
        <span className="font-semibold text-sm tabular">94</span>
      </div>
    </div>
  );
}

/* ───────────────────────── MARQUEE ───────────────────────── */

function Marquee() {
  return null; // rendered inside Hero via _MarqueeBare to share spacing
}

function _MarqueeBare({ items }: { items: string[] }) {
  const doubled = [...items, ...items];
  return (
    <div className="relative border-y border-border bg-surface/50 overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap py-4">
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center mx-6 mono-eyebrow text-foreground/50">
            <span className="h-1 w-1 rounded-full bg-primary mr-6" />
            {item}
          </span>
        ))}
      </div>
      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}

/* ───────────────────────── FEATURES ───────────────────────── */

function Features() {
  const { t } = useTranslation();
  const cards = t("home.cards", { returnObjects: true }) as { title: string; body: string }[];
  const icons = [Activity, PenLine, Scissors, Send, LineChart, Users];

  return (
    <section id="features" className="py-24 md:py-36">
      <div className="container-page">
        <SectionHeading
          eyebrow={t("home.what_eyebrow")}
          lead={t("home.what_title_lead")}
          accent={t("home.what_title_accent")}
          sub={t("home.what_sub")}
        />

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6"
        >
          {cards.map((card, i) => {
            const Icon = icons[i];
            return (
              <motion.div
                key={i}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 200, damping: 24 }}
                className="group relative bg-surface border border-border rounded-lg p-7 shadow-card hover:shadow-card-hover transition-shadow duration-300"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                  </div>
                  <span className="mono-eyebrow text-foreground/40">0{i + 1}</span>
                </div>
                <h3 className="text-xl font-semibold tracking-tight">{card.title}</h3>
                <p className="mt-3 text-sm text-foreground/65 leading-relaxed">{card.body}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

/* ───────────────────────── HOW IT WORKS ───────────────────────── */

function HowItWorks() {
  const { t } = useTranslation();
  const steps = t("home.steps", { returnObjects: true }) as { num: string; title: string; body: string }[];
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.4"] });
  const morphRotate = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const morphScale = useTransform(scrollYProgress, [0, 1], [1, 0.7]);

  return (
    <section ref={ref} className="py-24 md:py-36 bg-surface/40 border-y border-border">
      <div className="container-page">
        <SectionHeading
          eyebrow={t("home.how_eyebrow")}
          lead={t("home.how_title_lead")}
          accent={t("home.how_title_accent")}
        />

        {/* Signature visual: horizontal raw timeline morphs into a vertical short */}
        <div className="mt-16 mx-auto w-full max-w-md aspect-square flex items-center justify-center">
          <motion.div
            style={{ rotate: morphRotate, scale: morphScale }}
            className="origin-center w-full h-20 flex gap-2"
          >
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="flex-1 rounded-md bg-gradient-to-r from-primary/30 to-primary/15 border border-primary/30"
              />
            ))}
          </motion.div>
        </div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border"
        >
          {steps.map((step, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="bg-background p-8 md:p-10 relative"
            >
              <div className="flex items-baseline justify-between mb-6">
                <span className="font-mono text-xs uppercase tracking-wider text-primary">{step.num}</span>
                <span className="mono-eyebrow text-foreground/30">step</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-semibold">
                {step.title}
              </h3>
              <p className="mt-4 text-sm text-foreground/65 leading-relaxed">{step.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ───────────────────────── PLATFORMS ───────────────────────── */

const PLATFORMS = [
  { name: "TikTok", short: "TT" },
  { name: "Instagram", short: "IG" },
  { name: "YouTube", short: "YT" },
  { name: "LinkedIn", short: "in" },
  { name: "X", short: "X" },
  { name: "Facebook", short: "f" },
  { name: "Threads", short: "@" },
  { name: "Pinterest", short: "P" },
  { name: "Bluesky", short: "BS" },
  { name: "Reddit", short: "r/" },
];

function Platforms() {
  const { t } = useTranslation();
  return (
    <section id="platforms" className="py-24 md:py-36">
      <div className="container-page">
        <SectionHeading
          eyebrow={t("home.platforms_eyebrow")}
          lead={t("home.platforms_title_lead")}
          accent={t("home.platforms_title_accent")}
          sub={t("home.platforms_sub")}
        />

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          className="mt-16 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3"
        >
          {PLATFORMS.map((p) => (
            <motion.div
              key={p.name}
              variants={fadeUp}
              whileHover={{ y: -3 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="aspect-[4/3] bg-surface border border-border rounded-lg flex flex-col items-center justify-center gap-3 shadow-subtle hover:shadow-card transition-shadow"
            >
              <div className="h-10 w-10 rounded-md bg-foreground/[0.04] flex items-center justify-center font-mono text-sm font-semibold text-foreground/70">
                {p.short}
              </div>
              <span className="text-xs text-foreground/60 mono-eyebrow">{p.name}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ───────────────────────── PRICING TEASER ───────────────────────── */

function PricingTeaser() {
  const { t } = useTranslation();
  return (
    <section className="py-24 md:py-36 bg-surface/40 border-t border-border">
      <div className="container-page">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12 items-center">
          <div className="md:col-span-6">
            <p className="mono-eyebrow text-primary mb-4">{t("home.pricing_eyebrow")}</p>
            <h2 className="text-display-lg font-semibold">
              {t("home.pricing_title_lead")} <span className="serif-accent">{t("home.pricing_title_accent")}</span>
            </h2>
            <p className="mt-6 text-lg text-foreground/70 max-w-md leading-relaxed">{t("home.pricing_sub")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="primary" size="lg">
                <Link to="/pricing">{t("cta.view_pricing")} <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link to="/auth/signup">{t("cta.start_free")}</Link>
              </Button>
            </div>
          </div>

          <div className="md:col-span-6 space-y-3">
            <MiniTier name="Solo" price={t("pricing.free")} highlighted={false} features={["3 video", "5 crediti AI", "1 social"]} />
            <MiniTier name="Creator" price="€29" highlighted features={["50 video", "200 crediti", "Tutti i social"]} />
            <MiniTier name="Studio" price="€99" highlighted={false} features={["200 video", "1000 crediti", "Multi-cliente"]} />
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniTier({ name, price, features, highlighted }: { name: string; price: string; features: string[]; highlighted: boolean }) {
  return (
    <div
      className={`bg-background border rounded-lg p-5 flex items-center justify-between gap-4 ${
        highlighted ? "border-primary shadow-card" : "border-border"
      }`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className={`h-10 w-10 rounded-md flex items-center justify-center font-mono text-sm font-semibold shrink-0 ${
          highlighted ? "bg-primary text-primary-foreground" : "bg-foreground/[0.05] text-foreground/70"
        }`}>
          {name[0]}
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{name}</p>
          <p className="text-xs text-foreground/60 truncate">{features.join(" · ")}</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-semibold tabular text-lg">{price}</p>
        <p className="mono-eyebrow text-foreground/40">/mese</p>
      </div>
    </div>
  );
}

/* ───────────────────────── SECTION HEADING ───────────────────────── */

function SectionHeading({
  eyebrow,
  lead,
  accent,
  sub,
}: {
  eyebrow: string;
  lead: string;
  accent: string;
  sub?: string;
}) {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
      className="max-w-2xl"
    >
      <motion.p variants={fadeUp} className="mono-eyebrow text-primary mb-4">
        {eyebrow}
      </motion.p>
      <motion.h2 variants={fadeUp} className="text-display-lg font-semibold">
        {lead} <span className="serif-accent">{accent}</span>
      </motion.h2>
      {sub && (
        <motion.p variants={fadeUp} className="mt-5 text-lg text-foreground/65 leading-relaxed">
          {sub}
        </motion.p>
      )}
    </motion.div>
  );
}
