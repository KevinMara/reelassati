import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";
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

export function Hero() {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="absolute top-0 right-0 h-[600px] w-[600px] rounded-full opacity-[0.35] blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.18), transparent 60%)" }} />
      <div className="container-page relative pt-20 md:pt-28 pb-16 md:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <motion.div initial="hidden" animate="show" variants={stagger} className="lg:col-span-7">
            <motion.p variants={fadeUp} className="mono-eyebrow text-primary mb-5">{t("hero.eyebrow")}</motion.p>
            <motion.h1 variants={fadeUp} className="text-display-xl font-semibold">
              {t("hero.title")} <span className="serif-accent">{t("hero.accent")}</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-7 text-lg md:text-xl text-foreground/70 leading-relaxed max-w-[520px]">
              {t("hero.body")}
            </motion.p>
            <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-3">
              <Link to="/auth/signup" className="inline-flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover px-6 py-3 rounded-pill transition-colors">
                {t("hero.start_free")} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/pricing" className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground px-4 py-3 rounded-pill hover:bg-foreground/[0.04] transition-colors">
                {t("hero.view_pricing")}
              </Link>
            </motion.div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 40, filter: "blur(8px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} transition={{ duration: 1, ease, delay: 0.3 }} className="lg:col-span-5 relative">
            <HeroCutout chip={t("hero.chip")} />
          </motion.div>
        </div>
      </div>
      <MarqueeBar />
    </section>
  );
}

function HeroCutout({ chip }: { chip: string }) {
  return (
    <div className="relative mx-auto w-full max-w-[420px] aspect-[9/14] cutout">
      <div className="absolute inset-3 rounded-xl overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-foreground/[0.06]">
        <div className="absolute inset-0 grain" />
        <div aria-hidden className="absolute -top-10 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full bg-primary/40 blur-3xl" />
        <div aria-hidden className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[70%] h-[62%]">
          <div className="absolute bottom-0 inset-x-0 h-[78%] rounded-t-[36%] bg-gradient-to-t from-foreground/85 via-foreground/60 to-foreground/30" />
          <div className="absolute bottom-[60%] left-1/2 -translate-x-1/2 h-24 w-24 rounded-full bg-gradient-to-b from-foreground/70 to-foreground/50" />
        </div>
        <div className="absolute inset-x-6 bottom-24 text-center">
          <span className="inline-block font-bold text-foreground bg-background/90 px-2.5 py-1 rounded-md text-sm tracking-tight shadow-subtle">
            La verit&agrave; &egrave; <span className="bg-primary text-primary-foreground px-1.5 rounded-sm">una sola.</span>
          </span>
        </div>
        <div className="absolute top-3 inset-x-3 flex items-center justify-between text-[10px] font-mono text-foreground/60">
          <span>0:00 &middot; 0:42</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />LIVE EDIT</span>
        </div>
        <div className="absolute bottom-3 inset-x-3 flex items-end gap-[2px] h-10 px-1">
          {Array.from({ length: 48 }).map((_, i) => {
            const h = 20 + Math.abs(Math.sin(i * 0.7) * 60) + (i % 5) * 6;
            return <div key={i} className="flex-1 rounded-sm bg-primary/70" style={{ height: `${Math.min(h, 100)}%`, opacity: i < 18 ? 1 : 0.35 }} />;
          })}
        </div>
      </div>
      <div className="absolute -bottom-4 -left-4 bg-foreground text-background rounded-pill px-4 py-2 shadow-cutout">
        <span className="font-mono text-xs uppercase tracking-wider">&#9201; {chip}</span>
      </div>
      <div className="absolute -top-4 -right-3 bg-surface border border-border rounded-pill px-3 py-2 shadow-cutout flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="font-mono text-xs">Hook score</span>
        <span className="font-semibold text-sm tabular">94</span>
      </div>
    </div>
  );
}

function MarqueeBar() {
  const { t } = useTranslation();
  const keys = ["neural_prediction","vertical_auto_edit","native_publishing","synced_captions","tribe_v2","ab_testing","performance_analytics","trend_detection","multi_client","platforms"];
  const doubled = [...keys, ...keys];
  return (
    <div className="relative border-y border-border bg-surface/50 overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap py-4">
        {doubled.map((key, i) => (
          <span key={i} className="inline-flex items-center mx-6 mono-eyebrow text-foreground/50">
            <span className="h-1 w-1 rounded-full bg-primary mr-6" />{t(`marquee.${key}`)}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
