import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, type Variants } from "framer-motion";
import { Check, Minus, ArrowRight, Sparkles } from "lucide-react";
import { MarketingLayout } from "@/components/brand/MarketingLayout";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease } },
};
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

type TierKey = "solo" | "creator" | "studio";

const TIER_KEYS: TierKey[] = ["solo", "creator", "studio"];

const PRICES_MONTHLY: Record<TierKey, string> = {
  solo: "0",
  creator: "29",
  studio: "99",
};
const PRICES_ANNUAL: Record<TierKey, string> = {
  solo: "0",
  creator: "23",
  studio: "79",
};

export default function Pricing() {
  const { t } = useTranslation();
  const [annual, setAnnual] = useState(false);

  return (
    <MarketingLayout>
      <section className="relative pt-20 md:pt-28 pb-16">
        <div className="container-page">
          <motion.div initial="hidden" animate="show" variants={stagger} className="max-w-3xl">
            <motion.p variants={fadeUp} className="mono-eyebrow text-primary mb-5">
              {t("home.pricing_eyebrow")}
            </motion.p>
            <motion.h1 variants={fadeUp} className="text-display-xl font-semibold">
              {t("pricing.title_lead")} <span className="serif-accent">{t("pricing.title_accent")}</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-6 text-lg md:text-xl text-foreground/70 max-w-xl leading-relaxed">
              {t("pricing.sub")}
            </motion.p>
          </motion.div>

          {/* Billing toggle */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease }}
            className="mt-12 inline-flex items-center gap-1 p-1 bg-surface border border-border rounded-pill"
          >
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                "px-5 h-9 rounded-pill text-sm font-medium transition-colors",
                !annual ? "bg-foreground text-background" : "text-foreground/60 hover:text-foreground",
              )}
            >
              {t("pricing.monthly")}
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                "px-5 h-9 rounded-pill text-sm font-medium transition-colors flex items-center gap-2",
                annual ? "bg-foreground text-background" : "text-foreground/60 hover:text-foreground",
              )}
            >
              {t("pricing.annual")}
              <span className={cn(
                "mono-eyebrow text-[10px] px-1.5 py-0.5 rounded-sm",
                annual ? "bg-primary/30 text-background" : "bg-primary/10 text-primary",
              )}>
                {t("pricing.save_badge")}
              </span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* Tier cards */}
      <section className="pb-24">
        <div className="container-page">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 items-stretch"
          >
            {TIER_KEYS.map((key) => {
              const tier = t(`pricing.tiers.${key}`, { returnObjects: true }) as {
                name: string;
                for: string;
                cta: string;
                features: string[];
              };
              const featured = key === "creator";
              const price = annual ? PRICES_ANNUAL[key] : PRICES_MONTHLY[key];
              return (
                <motion.div
                  key={key}
                  variants={fadeUp}
                  className={cn(
                    "relative bg-surface border rounded-lg p-7 md:p-8 flex flex-col shadow-card",
                    featured ? "border-primary md:scale-[1.02] shadow-card-hover" : "border-border",
                  )}
                >
                  {featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground rounded-pill px-3 py-1 mono-eyebrow flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" />
                      {t("pricing.most_popular")}
                    </div>
                  )}
                  <div>
                    <h3 className="text-2xl font-semibold">{tier.name}</h3>
                    <p className="mt-1 text-sm text-foreground/55">{tier.for}</p>
                  </div>

                  <div className="mt-6 flex items-baseline gap-1">
                    {price === "0" ? (
                      <span className="text-4xl font-semibold">{t("pricing.free")}</span>
                    ) : (
                      <>
                        <span className="text-5xl font-semibold tabular tracking-tight">€{price}</span>
                        <span className="text-foreground/50 text-sm">{t("pricing.per_month")}</span>
                      </>
                    )}
                  </div>

                  <Button
                    asChild
                    variant={featured ? "primary" : "outline"}
                    size="lg"
                    className="mt-7 w-full justify-center"
                  >
                    <Link to={`/auth/signup?tier=${key}`}>{tier.cta}</Link>
                  </Button>

                  <ul className="mt-8 space-y-3.5 text-sm">
                    {tier.features.map((f) => (
                      <li key={f} className="flex gap-3 text-foreground/80">
                        <Check className={cn("h-4 w-4 mt-0.5 shrink-0", featured ? "text-primary" : "text-foreground/50")} strokeWidth={2.5} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Custom / Enterprise card */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-6 bg-surface/60 border border-dashed border-border rounded-lg p-7 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          >
            <div>
              <h3 className="text-xl font-semibold">{t("pricing.enterprise_title")}</h3>
              <p className="mt-2 text-sm text-foreground/65 max-w-xl">{t("pricing.enterprise_sub")}</p>
            </div>
            <Button asChild variant="outline" size="lg">
              <Link to="/support?subject=Custom+plan+inquiry">{t("pricing.contact_us")} <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </motion.div>
        </div>
      </section>

      <ComparisonTable />
      <FAQ />
    </MarketingLayout>
  );
}

/* ───────────────────────── COMPARISON ───────────────────────── */

const COMPARE_ROWS: { group: string; items: { label: string; values: (string | boolean)[] }[] }[] = [
  {
    group: "Contenuti",
    items: [
      { label: "Video / mese", values: ["3", "50", "200"] },
      { label: "Crediti AI / mese", values: ["5", "200", "1000"] },
      { label: "Reference library", values: [false, "100", "Illimitata"] },
    ],
  },
  {
    group: "Pubblicazione",
    items: [
      { label: "Account social", values: ["1", "Tutti", "Illimitati"] },
      { label: "Scheduling", values: [true, true, true] },
      { label: "Integrazione ads", values: [false, false, true] },
    ],
  },
  {
    group: "Analytics",
    items: [
      { label: "Dashboard base", values: [true, true, true] },
      { label: "Pattern broadcast", values: [false, true, true] },
      { label: "A/B test", values: [false, true, true] },
    ],
  },
  {
    group: "Collaborazione",
    items: [
      { label: "Branding per cliente", values: [false, false, true] },
      { label: "Posti team", values: ["1", "1", "5"] },
      { label: "Supporto", values: ["Community", "Email prio.", "Dedicato"] },
    ],
  },
];

function ComparisonTable() {
  const { t } = useTranslation();
  return (
    <section className="py-24 border-t border-border bg-surface/30">
      <div className="container-page">
        <h2 className="text-display-md font-semibold mb-12">{t("pricing.compare_title")}</h2>
        <div className="overflow-x-auto -mx-6 md:mx-0">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-border-strong">
                <th className="text-left mono-eyebrow text-foreground/50 pb-4 pl-6 md:pl-0 w-1/2"> </th>
                {["Solo", "Creator", "Studio"].map((n, i) => (
                  <th
                    key={n}
                    className={cn(
                      "text-left pb-4 px-4 font-semibold text-base",
                      i === 1 && "text-primary",
                    )}
                  >
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((group) => (
                <>
                  <tr key={group.group}>
                    <td colSpan={4} className="pt-8 pb-2 mono-eyebrow text-foreground/40 pl-6 md:pl-0">
                      {group.group}
                    </td>
                  </tr>
                  {group.items.map((row) => (
                    <tr key={row.label} className="border-b border-border/60">
                      <td className="py-3.5 pl-6 md:pl-0 text-sm text-foreground/80">{row.label}</td>
                      {row.values.map((v, i) => (
                        <td key={i} className={cn("py-3.5 px-4 text-sm tabular", i === 1 && "bg-primary/[0.03]")}>
                          {typeof v === "boolean" ? (
                            v ? <Check className="h-4 w-4 text-primary" strokeWidth={2.5} /> : <Minus className="h-4 w-4 text-foreground/25" />
                          ) : (
                            v
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── FAQ ───────────────────────── */

function FAQ() {
  const { t } = useTranslation();
  const faqs = t("pricing.faq", { returnObjects: true }) as { q: string; a: string }[];
  return (
    <section className="py-24 border-t border-border">
      <div className="container-page max-w-3xl">
        <h2 className="text-display-md font-semibold mb-10">{t("pricing.faq_title")}</h2>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-b border-border">
              <AccordionTrigger className="text-left text-base md:text-lg font-medium py-5 hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-foreground/70 leading-relaxed pb-5 text-base">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
