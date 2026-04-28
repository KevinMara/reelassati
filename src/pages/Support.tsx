import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, BookOpen, MessageCircle } from "lucide-react";
import { MarketingLayout } from "@/components/brand/MarketingLayout";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";

const ease = [0.16, 1, 0.3, 1] as const;
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease } },
};
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

export default function Support() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const prefillSubject = params.get("subject") ?? "";
  const quick = t("support.quick", { returnObjects: true }) as { q: string; a: string }[];
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    // Phase 1: UI-only — wire to backend in later phase.
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    (e.target as HTMLFormElement).reset();
    toast.success(t("support.form.success"));
  };

  return (
    <MarketingLayout>
      <section className="pt-20 md:pt-28 pb-16">
        <div className="container-page max-w-3xl">
          <motion.div initial="hidden" animate="show" variants={stagger}>
            <motion.p variants={fadeUp} className="mono-eyebrow text-primary mb-5">{t("nav.support")}</motion.p>
            <motion.h1 variants={fadeUp} className="text-display-xl font-semibold">
              {t("support.title_lead")} <span className="serif-accent">{t("support.title_accent")}</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-6 text-lg text-foreground/70 max-w-xl leading-relaxed">
              {t("support.sub")}
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Quick deflection */}
      <section className="pb-16">
        <div className="container-page max-w-3xl">
          <h2 className="mono-eyebrow text-foreground/50 mb-5">{t("support.quick_title")}</h2>
          <Accordion type="single" collapsible className="border border-border rounded-lg bg-surface overflow-hidden">
            {quick.map((item, i) => (
              <AccordionItem key={i} value={`q-${i}`} className="border-b border-border last:border-0 px-5 md:px-6">
                <AccordionTrigger className="text-left text-base font-medium py-4 hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-foreground/70 pb-4 text-sm leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Form */}
      <section className="pb-24">
        <div className="container-page max-w-3xl">
          <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-lg p-7 md:p-10 shadow-card space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field name="name" label={t("support.form.name")} required />
              <Field name="email" type="email" label={t("support.form.email")} required />
            </div>
            <Field name="subject" label={t("support.form.subject")} required defaultValue={prefillSubject} />
            <Field name="message" label={t("support.form.message")} required textarea />

            <Button type="submit" variant="primary" size="lg" className="w-full justify-center" disabled={submitting}>
              {submitting ? "..." : t("support.form.submit")}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <div className="mt-10 flex flex-wrap gap-3">
            <a href="#" className="inline-flex items-center gap-2 px-4 h-10 rounded-pill border border-border text-sm hover:bg-foreground/[0.04] transition-colors">
              <BookOpen className="h-4 w-4 text-primary" />
              {t("support.docs")}
            </a>
            <a href="#" className="inline-flex items-center gap-2 px-4 h-10 rounded-pill border border-border text-sm hover:bg-foreground/[0.04] transition-colors">
              <MessageCircle className="h-4 w-4 text-primary" />
              {t("support.community")}
            </a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

function Field({
  name, label, type = "text", required, textarea, defaultValue,
}: { name: string; label: string; type?: string; required?: boolean; textarea?: boolean; defaultValue?: string }) {
  const base =
    "w-full bg-surface-recessed border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-md px-4 py-3 text-base outline-none transition-all duration-200 placeholder:text-foreground/40";
  return (
    <label className="block">
      <span className="mono-eyebrow text-foreground/55 mb-2 block">{label}</span>
      {textarea ? (
        <textarea name={name} required={required} rows={6} className={base} defaultValue={defaultValue} />
      ) : (
        <input name={name} type={type} required={required} className={base} defaultValue={defaultValue} />
      )}
    </label>
  );
}
