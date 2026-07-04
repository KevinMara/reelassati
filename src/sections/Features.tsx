import { motion, type Variants } from "framer-motion";
import { Activity, PenLine, Scissors, Send, LineChart, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

const ease = [0.16, 1, 0.3, 1] as const;
const fadeUp: Variants = { hidden: { opacity: 0, y: 14, filter: "blur(6px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease } } };
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
const ICONS = [Activity, PenLine, Scissors, Send, LineChart, Users];
const KEYS = ["neural_analyzer","script_engineering","auto_editor","smart_publisher","analytics_loop","multi_client"];

export function Features() {
  const { t } = useTranslation();
  return (
    <section id="features" className="py-24 md:py-36">
      <div className="container-page">
        <div className="max-w-3xl">
          <p className="mono-eyebrow text-primary mb-4">{t("features.eyebrow")}</p>
          <h2 className="text-display-md font-semibold">{t("features.lead")} <span className="serif-accent">{t("features.accent")}</span></h2>
          <p className="mt-6 text-lg text-foreground/70 leading-relaxed max-w-xl">{t("features.sub")}</p>
        </div>
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {KEYS.map((key, i) => {
            const Icon = ICONS[i];
            return (
              <motion.div key={i} variants={fadeUp} whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 200, damping: 24 }} className="group relative bg-surface border border-border rounded-lg p-7 shadow-card hover:shadow-card-hover transition-shadow duration-300">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Icon className="h-[18px] w-[18px]" strokeWidth={1.75} /></div>
                  <span className="mono-eyebrow text-foreground/40">0{i + 1}</span>
                </div>
                <h3 className="text-xl font-semibold tracking-tight">{t(`features.${key}`)}</h3>
                <p className="mt-3 text-sm text-foreground/65 leading-relaxed">{t(`features.${key}_desc`)}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
