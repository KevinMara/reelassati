import { useRef } from "react";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { useTranslation } from "react-i18next";

const ease = [0.16, 1, 0.3, 1] as const;
const fadeUp: Variants = { hidden: { opacity: 0, y: 14, filter: "blur(6px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease } } };
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };

export function HowItWorks() {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.4"] });
  const morphRotate = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const morphScale = useTransform(scrollYProgress, [0, 1], [1, 0.7]);

  const steps = [
    { num: "01", titleKey: "how.upload", descKey: "how.upload_desc" },
    { num: "02", titleKey: "how.review", descKey: "how.review_desc" },
    { num: "03", titleKey: "how.publish", descKey: "how.publish_desc" },
  ];

  return (
    <section ref={ref} className="py-24 md:py-36 bg-surface/40 border-y border-border">
      <div className="container-page">
        <div className="max-w-3xl">
          <p className="mono-eyebrow text-primary mb-4">{t("how.eyebrow")}</p>
          <h2 className="text-display-md font-semibold">{t("how.lead")} <span className="serif-accent">{t("how.accent")}</span></h2>
        </div>

        <div className="mt-16 mx-auto w-full max-w-md aspect-square flex items-center justify-center">
          <motion.div style={{ rotate: morphRotate, scale: morphScale }} className="origin-center w-full h-20 flex gap-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="flex-1 rounded-md bg-gradient-to-r from-primary/30 to-primary/15 border border-primary/30" />
            ))}
          </motion.div>
        </div>

        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border">
          {steps.map((step, i) => (
            <motion.div key={i} variants={fadeUp} className="bg-background p-8 md:p-10 relative">
              <div className="flex items-baseline justify-between mb-6">
                <span className="font-mono text-xs uppercase tracking-wider text-primary">{step.num}</span>
                <span className="mono-eyebrow text-foreground/30">{t("how.step")}</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-semibold">{t(step.titleKey)}</h3>
              <p className="mt-4 text-sm text-foreground/65 leading-relaxed">{t(step.descKey)}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
