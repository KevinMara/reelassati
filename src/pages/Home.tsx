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
    <div className="relative mx-auto w-full max-w-[420px] aspect-[9/14] cutout">
      {/* Phone-style frame inside */}
      <div className="absolute inset-3 rounded-xl overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-foreground/[0.06]">
        {/* Mock vertical video composition */}
        <div className="absolute inset-0 grain" />

        {/* Soft spotlight */}
        <div
          aria-hidden
          className="absolute -top-10 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full bg-primary/40 blur-3xl"
        />

        {/* "Subject" silhouette — head + shoulders */}
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[70%] h-[62%]"
        >
          <div className="absolute bottom-0 inset-x-0 h-[78%] rounded-t-[36%] bg-gradient-to-t from-foreground/85 via-foreground/60 to-foreground/30" />
          <div className="absolute bottom-[60%] left-1/2 -translate-x-1/2 h-24 w-24 rounded-full bg-gradient-to-b from-foreground/70 to-foreground/50" />
        </div>

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
  {
    name: "LinkedIn",
    color: "#0A66C2",
    path: "M218.12,218.13H180.17V158.69c0-14.18-.25-32.42-19.74-32.42-19.77,0-22.79,15.44-22.79,31.39v60.47H99.69V95.71h36.42v16.7h.51a39.92,39.92,0,0,1,35.95-19.74c38.46,0,45.55,25.31,45.55,58.24ZM56.85,79a22,22,0,1,1,22-22A22,22,0,0,1,56.85,79ZM75.83,218.13H37.84V95.71H75.83ZM237.05,0H18.89A18.66,18.66,0,0,0,0,18.45V237.55A18.67,18.67,0,0,0,18.89,256H237.05A18.71,18.71,0,0,0,256,237.55V18.43C256,8.18,247.55,0,237.05,0Z",
  },
  {
    name: "X",
    color: "#000000",
    path: "M214.75,27.84h36.81L172.49,118.6,266.55,256H191.4L132.43,178.06,64.93,256H28.1L113.05,158.99,22.27,27.84H99.32l54.05,71.49ZM201.83,234h20.4L86.62,48.66H64.74Z",
  },
  {
    name: "Facebook",
    color: "#1877F2",
    path: "M256,128C256,57.31,198.69,0,128,0S0,57.31,0,128c0,63.88,46.8,116.84,108,126.45V165H75.5V128H108V99.8c0-32.08,19.11-49.8,48.34-49.8C170.34,50,185,52.5,185,52.5V84H168.86C153,84,148,93.87,148,104v24h35.5l-5.67,37H148v89.45C209.2,244.84,256,191.88,256,128Z",
  },
  {
    name: "Threads",
    color: "#000000",
    path: "M141.54,121.05c-1.69-.81-3.4-1.59-5.14-2.32-3-31.49-20.18-48.05-49-48.23h-.39c-17.24,0-31.58,7.36-40.4,20.75l15.86,10.87c6.6-10,17-12.13,24.55-12.13h.27c9.49.06,16.65,2.82,21.29,8.2,3.38,3.92,5.64,9.34,6.77,16.18-8.55-1.45-17.79-1.9-27.67-1.32-27.83,1.6-45.71,17.83-44.51,40.39.61,11.45,6.32,21.29,16.07,27.71,8.24,5.43,18.85,8.08,29.88,7.47,14.57-.8,26-6.36,33.97-16.53,6.05-7.72,9.88-17.73,11.57-30.31,6.94,4.19,12.08,9.7,14.92,16.32,4.83,11.26,5.12,29.77-15,49.84-13.24,13.23-29.16,18.95-53.21,19.13-26.69-.2-46.87-8.76-60-25.43-12.29-15.61-18.64-38.15-18.88-67,.24-28.84,6.59-51.39,18.88-67,13.13-16.67,33.31-25.23,60-25.43,26.88.2,47.41,8.8,61,25.57,6.66,8.22,11.68,18.56,15,30.61L195.68,72.06C191.7,57.43,185.43,44.84,176.91,34.39,159.49,12.92,134,1.94,99.21,1.69h-.13C64.39,1.94,39.39,13,22.79,34.69,8.05,53.93,.45,80.7,.18,114.69v.13c.27,33.99,7.87,60.76,22.61,80,16.6,21.69,41.6,32.74,76.29,33H99.2c30.83-.21,52.55-8.28,70.45-26.16,23.42-23.4,22.71-52.74,15-70.74C179.21,118.06,168.06,108.41,141.54,121.05Zm-12.05,18.74c-.32,1.66-.74,3.27-1.27,4.81-3.05,8.4-9.21,12.94-19.34,13.85-9.7.55-18.49-2.16-22.94-5.84-3.93-3.25-6.18-7.84-6.43-13.13-.18-3.31.79-6.36,2.93-9.13,3.41-4.42,9.47-7.66,17.51-9.13,2.85-.52,5.79-.78,8.74-.78a73.81,73.81,0,0,1,17.61,2.16c5.1.94,8.84,2.32,11.46,3.71-1.5,4.43-4.18,8.79-8.27,13.48Z",
  },
  {
    name: "Pinterest",
    color: "#BD081C",
    path: "M128,0C57.3,0,0,57.3,0,128c0,54.3,33.8,100.6,81.5,119.2c-1.1-10.1-2.1-25.7,0.4-36.8c2.3-10,14.8-63.7,14.8-63.7s-3.8-7.6-3.8-18.7c0-17.5,10.2-30.6,22.8-30.6c10.8,0,16,8.1,16,17.7c0,10.8-6.9,26.9-10.4,41.8c-3,12.5,6.3,22.7,18.6,22.7c22.3,0,39.5-23.5,39.5-57.5c0-30.1-21.6-51.1-52.4-51.1c-35.7,0-56.7,26.8-56.7,54.5c0,10.8,4.2,22.4,9.3,28.7c1,1.2,1.2,2.3,0.9,3.6c-1,4.1-3.1,12.5-3.5,14.3c-0.6,2.3-1.8,2.8-4.2,1.7c-15.7-7.3-25.5-30.2-25.5-48.7c0-39.6,28.8-76,82.9-76c43.6,0,77.5,31,77.5,72.6c0,43.3-27.3,78.2-65.2,78.2c-12.7,0-24.7-6.6-28.8-14.4c0,0-6.3,24-7.8,29.9c-2.8,10.9-10.5,24.6-15.6,32.9c11.8,3.6,24.2,5.6,37.2,5.6c70.7,0,128-57.3,128-128C256,57.3,198.7,0,128,0z",
  },
  {
    name: "Bluesky",
    color: "#0085FF",
    path: "M55.49,15.49C82.85,36,112.31,77.59,123.13,99.92c10.82-22.33,40.27-63.92,67.64-84.43,19.74-14.82,51.74-26.27,51.74,10.21,0,7.29-4.18,61.21-6.63,70-8.51,30.41-39.5,38.18-67.07,33.49,48.2,8.21,60.46,35.39,33.97,62.57-50.31,51.59-72.31-12.94-77.95-29.47-1-3-1.5-4.46-1.5-3.21,0-1.25-.5,.21-1.5,3.21-5.64,16.53-27.64,81.06-77.95,29.47C16.4,164.58,28.66,137.4,76.86,129.19c-27.57,4.69-58.56-3.08-67.07-33.49-2.45-8.79-6.63-62.71-6.63-70C3.16-10.78,35.16,.67,54.9,15.49h.59Z",
  },
  {
    name: "Reddit",
    color: "#FF4500",
    path: "M256,128c0-15.5-12.6-28-28-28c-7.6,0-14.4,3-19.4,7.8c-19.1-13.8-45.4-22.7-74.7-23.9l12.7-59.9l41.6,8.8c0.5,10.6,9.2,19,19.9,19c11,0,20-9,20-20s-9-20-20-20c-7.8,0-14.6,4.5-17.8,11.1L143.7,13c-1.3-0.3-2.6,0-3.7,0.7c-1.1,0.7-1.8,1.8-2.1,3.1l-14.2,66.7c-29.8,1-56.5,9.9-75.9,23.9c-5-5-11.9-7.9-19.5-7.9c-15.5,0-28,12.5-28,28c0,11.4,6.8,21.1,16.5,25.5c-0.4,2.8-0.7,5.7-0.7,8.6c0,43.5,50.6,78.8,113,78.8s113-35.3,113-78.8c0-2.9-0.2-5.7-0.7-8.5C249.2,149.2,256,139.4,256,128z M64,148c0-11,9-20,20-20s20,9,20,20s-9,20-20,20S64,159,64,148z M174.6,206.5c-13.7,13.7-39.9,14.8-47.6,14.8c-7.7,0-34-1.1-47.6-14.8c-2-2-2-5.3,0-7.4c2-2,5.3-2,7.4,0c8.6,8.6,27.1,11.7,40.3,11.7s31.6-3.1,40.3-11.7c2-2,5.3-2,7.4,0C176.7,201.2,176.7,204.5,174.6,206.5z M172,168c-11,0-20-9-20-20s9-20,20-20s20,9,20,20S183,168,172,168z",
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
              <div
                className="h-11 w-11 rounded-md flex items-center justify-center"
                style={{ backgroundColor: `${p.color}14` }}
              >
                <svg viewBox="0 0 256 256" className="h-6 w-6" fill={p.color} aria-hidden>
                  <path d={p.path} />
                </svg>
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
