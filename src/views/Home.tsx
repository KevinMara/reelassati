import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Activity,
  PenLine,
  Scissors,
  Send,
  LineChart,
  Users,
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

function Hero() {
  const { t } = useTranslation();
  const marquee = t("home.marquee", { returnObjects: true }) as string[];

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute top-0 right-0 h-[600px] w-[600px] rounded-full opacity-[0.35] blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.18), transparent 60%)" }}
      />

      <div className="container-page relative pt-20 md:pt-28 pb-16 md:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
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

      <_MarqueeBare items={marquee} />
    </section>
  );
}

function HeroCutout({ chip }: { chip: string }) {
  return (
    <div className="relative mx-auto w-full max-w-[420px] aspect-[9/14] cutout">
      <div className="absolute inset-3 rounded-xl overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-foreground/[0.06]">
        <div className="absolute inset-0 grain" />
        <div
          aria-hidden
          className="absolute -top-10 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full bg-primary/40 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[70%] h-[62%]"
        >
          <div className="absolute bottom-0 inset-x-0 h-[78%] rounded-t-[36%] bg-gradient-to-t from-foreground/85 via-foreground/60 to-foreground/30" />
          <div className="absolute bottom-[60%] left-1/2 -translate-x-1/2 h-24 w-24 rounded-full bg-gradient-to-b from-foreground/70 to-foreground/50" />
        </div>

        <div className="absolute inset-x-6 bottom-24 text-center">
          <span className="inline-block font-bold text-foreground bg-background/90 px-2.5 py-1 rounded-md text-sm tracking-tight shadow-subtle">
            La verità è{" "}
            <span className="bg-primary text-primary-foreground px-1.5 rounded-sm">una sola.</span>
          </span>
        </div>

        <div className="absolute top-3 inset-x-3 flex items-center justify-between text-[10px] font-mono text-foreground/60">
          <span>0:00 · 0:42</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
            LIVE EDIT
          </span>
        </div>

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

      <div className="absolute -bottom-4 -left-4 bg-foreground text-background rounded-pill px-4 py-2 shadow-cutout">
        <span className="font-mono text-xs uppercase tracking-wider">⏱ {chip}</span>
      </div>

      <div className="absolute -top-4 -right-3 bg-surface border border-border rounded-pill px-3 py-2 shadow-cutout flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="font-mono text-xs">Hook score</span>
        <span className="font-semibold text-sm tabular">94</span>
      </div>
    </div>
  );
}

function Marquee() {
  return null;
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
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}

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

const PLATFORMS: { name: string; color: string; path: string }[] = [
  {
    name: "TikTok",
    color: "#000000",
    path: "M232.66,72.27a59.66,59.66,0,0,1-37.45-13.13,59.65,59.65,0,0,1-22.55-46.91V8H134.55V155.13a32.5,32.5,0,1,1-23.06-31.12V84.18a72.5,72.5,0,1,0,61.06,71.51V91.39a98.79,98.79,0,0,0,60.11,20.36Z",
  },
  {
    name: "Instagram",
    color: "#E4405F",
    path: "M128,23.06c34.18,0,38.23.13,51.73.75,12.48.57,19.26,2.66,23.77,4.41a39.66,39.66,0,0,1,14.71,9.57,39.66,39.66,0,0,1,9.57,14.71c1.75,4.51,3.84,11.29,4.41,23.77.62,13.5.75,17.55.75,51.73s-.13,38.23-.75,51.73c-.57,12.48-2.66,19.26-4.41,23.77a42.41,42.41,0,0,1-24.28,24.28c-4.51,1.75-11.29,3.84-23.77,4.41-13.5.62-17.55.75-51.73.75s-38.23-.13-51.73-.75c-12.48-.57-19.26-2.66-23.77-4.41a39.66,39.66,0,0,1-14.71-9.57,39.66,39.66,0,0,1-9.57-14.71c-1.75-4.51-3.84-11.29-4.41-23.77-.62-13.5-.75-17.55-.75-51.73s.13-38.23.75-51.73c.57-12.48,2.66-19.26,4.41-23.77A39.66,39.66,0,0,1,37.79,37.79a39.66,39.66,0,0,1,14.71-9.57c4.51-1.75,11.29-3.84,23.77-4.41,13.5-.62,17.55-.75,51.73-.75M128,0C93.24,0,88.88.15,75.22.77S52.24,3.55,43.79,6.84a62.69,62.69,0,0,0-22.66,14.76A62.69,62.69,0,0,0,6.37,44.26c-3.29,8.45-5.45,18.06-6.07,32.25S0,93.24,0,128s.15,39.12.77,52.78,2.78,23,6.07,31.43a62.69,62.69,0,0,0,14.76,22.66,62.69,62.69,0,0,0,22.66,14.76c8.45,3.29,18.06,5.45,32.25,6.07S93.24,256,128,256s39.12-.15,52.78-.77,23-2.78,31.43-6.07a65.4,65.4,0,0,0,37.42-37.42c3.29-8.45,5.45-18.06,6.07-32.25S256,162.76,256,128s-.15-39.12-.77-52.78-2.78-23-6.07-31.43a62.69,62.69,0,0,0-14.76-22.66A62.69,62.69,0,0,0,211.74,6.37c-8.45-3.29-18.06-5.45-32.25-6.07S162.76,0,128,0Zm0,62.27A65.73,65.73,0,1,0,193.73,128,65.73,65.73,0,0,0,128,62.27Zm0,108.4A42.67,42.67,0,1,1,170.67,128,42.67,42.67,0,0,1,128,170.67ZM196.31,44.4a15.36,15.36,0,1,0,15.36,15.36A15.36,15.36,0,0,0,196.31,44.4Z",
  },
  {
    name: "YouTube",
    color: "#FF0000",
    path: "M250.35,67.05a32,32,0,0,0-22.55-22.65C207.81,39,128,39,128,39s-79.81,0-99.8,5.4a32,32,0,0,0-22.55,22.65C0,87.16,0,128,0,128s0,40.84,5.65,60.95A32,32,0,0,0,28.2,211.6C48.19,217,128,217,128,217s79.81,0,99.8-5.4a32,32,0,0,0,22.55-22.65C256,168.84,256,128,256,128S256,87.16,250.35,67.05ZM102.4,166.4V89.6L168.96,128Z",
  },
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
        <div className="mt-16 flex flex-wrap justify-center gap-8">
          {PLATFORMS.map((p) => (
            <div key={p.name} className="flex flex-col items-center gap-3">
               <div 
                 className="h-16 w-16 rounded-2xl flex items-center justify-center"
                 style={{ backgroundColor: `${p.color}14` }}
               >
                 <svg width="32" height="32" viewBox="0 0 256 256" fill={p.color}>
                   <path d={p.path} />
                 </svg>
               </div>
               <span className="text-sm font-medium text-foreground/60">{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingTeaser() {
  const { t } = useTranslation();
  return (
    <section className="py-24 md:py-36 bg-surface/40 border-t border-border">
      <div className="container-page">
        <SectionHeading
          eyebrow={t("home.pricing_eyebrow")}
          lead={t("home.pricing_title_lead")}
          accent={t("home.pricing_title_accent")}
          sub={t("home.pricing_sub")}
        />
        <div className="mt-16 flex justify-center">
          <Button asChild variant="primary" size="xl">
            <Link to="/pricing">
              {t("cta.view_pricing")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, lead, accent, sub }: { eyebrow: string; lead: string; accent: string; sub?: string }) {
  return (
    <div className="max-w-3xl">
      <p className="mono-eyebrow text-primary mb-4">{eyebrow}</p>
      <h2 className="text-display-md font-semibold">
        {lead} <span className="serif-accent">{accent}</span>
      </h2>
      {sub && <p className="mt-6 text-lg text-foreground/70 leading-relaxed max-w-xl">{sub}</p>}
    </div>
  );
}
