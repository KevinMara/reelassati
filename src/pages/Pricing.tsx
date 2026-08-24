import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

type BillingCycle = "monthly" | "annual";

type Plan = {
  name: string;
  description: string;
  monthlyPrice: number;
  annualMonthlyPrice: number;
  annualTotal: number;
  features: string[];
  featured?: boolean;
};

const PLANS: Record<"en" | "it", Plan[]> = {
  en: [
    {
      name: "Creator",
      description: "For one creator building a repeatable short-form system.",
      monthlyPrice: 29,
      annualMonthlyPrice: 24,
      annualTotal: 288,
      features: [
        "1 brand workspace",
        "2 connected social accounts",
        "Precision Studio and reviewable edit plans",
        "Scripts, Prompt Director, calendar, and analytics",
        "Version history and exports",
      ],
    },
    {
      name: "Pro",
      description: "For creators and small teams running several channels.",
      monthlyPrice: 79,
      annualMonthlyPrice: 67,
      annualTotal: 804,
      featured: true,
      features: [
        "3 brand workspaces",
        "6 connected social accounts",
        "Everything in Creator",
        "Client workflow and publishing queue",
        "Cross-channel analytics and content library",
      ],
    },
    {
      name: "Studio",
      description: "For agencies and operators managing a client portfolio.",
      monthlyPrice: 179,
      annualMonthlyPrice: 152,
      annualTotal: 1824,
      features: [
        "10 brand workspaces",
        "12 connected social accounts",
        "Everything in Pro",
        "Multi-client command view",
        "Consolidated analytics and priority workflow",
      ],
    },
  ],
  it: [
    {
      name: "Creator",
      description:
        "Per un creator che costruisce un sistema short-form ripetibile.",
      monthlyPrice: 29,
      annualMonthlyPrice: 24,
      annualTotal: 288,
      features: [
        "1 workspace brand",
        "2 account social collegati",
        "Studio di precisione e piani di montaggio revisionabili",
        "Script, Prompt Director, calendario e analytics",
        "Cronologia versioni ed export",
      ],
    },
    {
      name: "Pro",
      description: "Per creator e piccoli team che gestiscono più canali.",
      monthlyPrice: 79,
      annualMonthlyPrice: 67,
      annualTotal: 804,
      featured: true,
      features: [
        "3 workspace brand",
        "6 account social collegati",
        "Tutto il piano Creator",
        "Flusso clienti e coda di pubblicazione",
        "Analytics cross-channel e libreria contenuti",
      ],
    },
    {
      name: "Studio",
      description:
        "Per agenzie e operatori che gestiscono un portfolio clienti.",
      monthlyPrice: 179,
      annualMonthlyPrice: 152,
      annualTotal: 1824,
      features: [
        "10 workspace brand",
        "12 account social collegati",
        "Tutto il piano Pro",
        "Vista operativa multi-cliente",
        "Analytics consolidati e flusso prioritario",
      ],
    },
  ],
};

export default function Pricing() {
  const { i18n } = useTranslation();
  const isItalian = Boolean(i18n.resolvedLanguage?.startsWith("it"));
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const plans = PLANS[isItalian ? "it" : "en"];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pb-20 pt-28">
        <div className="container-page">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mono-eyebrow text-primary">
              {isItalian ? "Prezzi" : "Pricing"}
            </p>
            <h1 className="mt-5 text-4xl font-semibold md:text-6xl">
              {isItalian ? "Scegli la scala." : "Choose the scale."}{" "}
              <span className="serif-accent">
                {isItalian ? "Mantieni il controllo." : "Keep the control."}
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-foreground/65">
              {isItalian
                ? "Ogni piano include lo Studio completo, modifiche revisionabili e un flusso dall’idea alla pubblicazione. Cambia solo la scala del workspace."
                : "Every plan includes the complete Studio, reviewable changes, and one path from idea to publication. Only the workspace scale changes."}
            </p>

            <div
              className="mx-auto mt-8 inline-flex rounded-pill border border-border bg-surface p-1 shadow-card"
              role="group"
              aria-label={
                isItalian ? "Periodo di fatturazione" : "Billing period"
              }
            >
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                aria-pressed={billingCycle === "monthly"}
                className={`rounded-pill px-5 py-2 text-sm font-medium transition-all ${billingCycle === "monthly" ? "bg-foreground text-background" : "text-foreground/55 hover:text-foreground"}`}
              >
                {isItalian ? "Mensile" : "Monthly"}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                aria-pressed={billingCycle === "annual"}
                className={`rounded-pill px-5 py-2 text-sm font-medium transition-all ${billingCycle === "annual" ? "bg-primary text-primary-foreground" : "text-foreground/55 hover:text-foreground"}`}
              >
                {isItalian
                  ? "Annuale · risparmia fino al 17%"
                  : "Annual · save up to 17%"}
              </button>
            </div>
          </div>

          <div className="mx-auto mt-14 grid max-w-6xl items-stretch gap-5 lg:grid-cols-3">
            {plans.map(plan => (
              <PlanCard
                key={plan.name}
                plan={plan}
                billingCycle={billingCycle}
                isItalian={isItalian}
              />
            ))}
          </div>

          <div className="mx-auto mt-8 grid max-w-6xl gap-5 md:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-2xl border border-border bg-surface p-7 md:p-9">
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="mono-eyebrow text-primary">
                    {isItalian ? "Crediti REELassati" : "REELassati credits"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    {isItalian
                      ? "Un solo saldo per gli strumenti AI."
                      : "One balance for every AI tool."}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/60">
                    {isItalian
                      ? "Video, voce e altri strumenti AI usano crediti REELassati all’interno della piattaforma. Nessun prezzo esterno o dettaglio tecnico da gestire."
                      : "Video, voice, and other AI tools use REELassati credits inside the platform. There are no external prices or technical integration details to manage."}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/25 bg-primary/[0.045] p-7 md:p-9">
              <p className="mono-eyebrow text-primary">
                {isItalian ? "Serve più scala?" : "Need more scale?"}
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                {isItalian
                  ? "Costruiamo il piano giusto."
                  : "We’ll shape the right plan."}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-foreground/60">
                {isItalian
                  ? "Più brand, account o un flusso su misura: partiamo dai volumi reali."
                  : "More brands, accounts, or a tailored workflow: we start from your real volume."}
              </p>
              <a
                href="mailto:support@reelassati.com?subject=REELassati%20Studio%20plan"
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover"
              >
                {isItalian ? "Parliamone" : "Talk to us"}{" "}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function PlanCard({
  plan,
  billingCycle,
  isItalian,
}: {
  plan: Plan;
  billingCycle: BillingCycle;
  isItalian: boolean;
}) {
  const price =
    billingCycle === "monthly" ? plan.monthlyPrice : plan.annualMonthlyPrice;

  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 shadow-card transition-all duration-300 [transform-style:preserve-3d] hover:-translate-y-1 hover:[transform:perspective(1000px)_rotateX(1deg)_translateY(-4px)] hover:shadow-card-hover ${plan.featured ? "border-primary/45 bg-primary/[0.05]" : "border-border bg-surface"}`}
    >
      {plan.featured && (
        <div
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40"
          aria-hidden
        />
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="mono-eyebrow text-primary">{plan.name}</p>
        {plan.featured && (
          <span className="rounded-pill bg-primary px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-primary-foreground">
            {isItalian ? "Consigliato" : "Recommended"}
          </span>
        )}
      </div>
      <p className="mt-4 min-h-[48px] text-sm leading-relaxed text-foreground/55">
        {plan.description}
      </p>
      <div className="mt-6 flex items-end gap-2">
        <span className="text-5xl font-semibold tracking-tight">€{price}</span>
        <span className="pb-1 text-sm text-foreground/45">
          /{isItalian ? "mese" : "month"}
        </span>
      </div>
      <p className="mt-2 min-h-[20px] text-xs text-foreground/45">
        {billingCycle === "annual"
          ? isItalian
            ? `€${plan.annualTotal} fatturati annualmente`
            : `€${plan.annualTotal} billed annually`
          : isItalian
            ? "Fatturazione mensile"
            : "Billed monthly"}
      </p>
      <Link
        to="/auth/signup"
        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-pill px-5 py-3 text-sm font-medium transition-colors ${plan.featured ? "bg-primary text-primary-foreground hover:bg-primary-hover" : "border border-border bg-background text-foreground hover:border-primary/35"}`}
      >
        {isItalian ? `Scegli ${plan.name}` : `Choose ${plan.name}`}{" "}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
      <ul className="mt-6 flex-1 space-y-3 border-t border-border pt-5">
        {plan.features.map(item => (
          <li
            key={item}
            className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/70"
          >
            <Check
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
              aria-hidden
            />{" "}
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}
