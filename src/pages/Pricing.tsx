import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { CREDIT_TOP_UPS, type PlanId } from "@contracts/billing";
import {
  ANNUAL_BILLED_MONTHS,
  annualMonthlyEquivalent,
  PUBLIC_PLAN_PRICING,
} from "@contracts/pricing";

type BillingCycle = "monthly" | "annual";

type Plan = {
  id: PlanId;
  name: string;
  description: string;
  monthlyPrice: number;
  annualMonthlyPrice: number;
  annualTotal: number;
  monthlyCredits: number;
  features: string[];
  featured?: boolean;
};

const PLANS: Record<"en" | "it", Plan[]> = {
  en: [
    {
      id: "creator",
      name: "Creator",
      description: "For one creator building a repeatable short-form system.",
      monthlyPrice: PUBLIC_PLAN_PRICING.Creator.monthlyPrice,
      annualMonthlyPrice: annualMonthlyEquivalent("Creator"),
      annualTotal: PUBLIC_PLAN_PRICING.Creator.annualTotal,
      monthlyCredits: PUBLIC_PLAN_PRICING.Creator.monthlyCredits,
      features: [
        "1 brand workspace",
        "2 connected social accounts",
        "Precision Studio and reviewable edit plans",
        "Scripts, Prompt Director, calendar, and analytics",
        "Version history and edit-brief exports",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      description: "For creators and small teams running several channels.",
      monthlyPrice: PUBLIC_PLAN_PRICING.Pro.monthlyPrice,
      annualMonthlyPrice: annualMonthlyEquivalent("Pro"),
      annualTotal: PUBLIC_PLAN_PRICING.Pro.annualTotal,
      monthlyCredits: PUBLIC_PLAN_PRICING.Pro.monthlyCredits,
      featured: true,
      features: [
        "1 brand workspace · multi-brand planned",
        "6 connected social accounts",
        "Everything in Creator",
        "Content library and publishing queue",
        "Content activity charts and usage tracking",
      ],
    },
    {
      id: "studio",
      name: "Studio",
      description: "For creators producing a larger volume of content.",
      monthlyPrice: PUBLIC_PLAN_PRICING.Studio.monthlyPrice,
      annualMonthlyPrice: annualMonthlyEquivalent("Studio"),
      annualTotal: PUBLIC_PLAN_PRICING.Studio.annualTotal,
      monthlyCredits: PUBLIC_PLAN_PRICING.Studio.monthlyCredits,
      features: [
        "1 brand workspace · multi-brand planned",
        "12 connected social accounts",
        "Everything in Pro",
        "Higher generation and publishing allowances",
        "Shared library across creation tools",
      ],
    },
  ],
  it: [
    {
      id: "creator",
      name: "Creator",
      description:
        "Per un creator che costruisce un sistema short-form ripetibile.",
      monthlyPrice: PUBLIC_PLAN_PRICING.Creator.monthlyPrice,
      annualMonthlyPrice: annualMonthlyEquivalent("Creator"),
      annualTotal: PUBLIC_PLAN_PRICING.Creator.annualTotal,
      monthlyCredits: PUBLIC_PLAN_PRICING.Creator.monthlyCredits,
      features: [
        "1 workspace brand",
        "2 account social collegati",
        "Studio di precisione e piani di montaggio revisionabili",
        "Script, Prompt Director, calendario e analytics",
        "Cronologia versioni ed export del piano di montaggio",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      description: "Per creator e piccoli team che gestiscono più canali.",
      monthlyPrice: PUBLIC_PLAN_PRICING.Pro.monthlyPrice,
      annualMonthlyPrice: annualMonthlyEquivalent("Pro"),
      annualTotal: PUBLIC_PLAN_PRICING.Pro.annualTotal,
      monthlyCredits: PUBLIC_PLAN_PRICING.Pro.monthlyCredits,
      featured: true,
      features: [
        "1 workspace brand · multi-brand in arrivo",
        "6 account social collegati",
        "Tutto il piano Creator",
        "Libreria contenuti e coda di pubblicazione",
        "Grafici attività contenuti e utilizzo",
      ],
    },
    {
      id: "studio",
      name: "Studio",
      description: "Per creator che producono un volume maggiore di contenuti.",
      monthlyPrice: PUBLIC_PLAN_PRICING.Studio.monthlyPrice,
      annualMonthlyPrice: annualMonthlyEquivalent("Studio"),
      annualTotal: PUBLIC_PLAN_PRICING.Studio.annualTotal,
      monthlyCredits: PUBLIC_PLAN_PRICING.Studio.monthlyCredits,
      features: [
        "1 workspace brand · multi-brand in arrivo",
        "12 account social collegati",
        "Tutto il piano Pro",
        "Più crediti e account social collegati",
        "Libreria condivisa tra gli strumenti creativi",
      ],
    },
  ],
};

export default function Pricing() {
  const { user } = useAuth();
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
                ? "Ogni piano include strumenti creativi, libreria e pianificazione. Scegli i crediti mensili e il numero di account social. Il rendering finale della timeline e i workspace multi-brand sono in sviluppo."
                : "Every plan includes the creation tools, library, and planning workspace. Choose your monthly credits and connected social account allowance. Final timeline rendering and multi-brand workspaces are in development."}
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
                  ? `Annuale · paghi ${ANNUAL_BILLED_MONTHS} mesi`
                  : `Annual · pay for ${ANNUAL_BILLED_MONTHS} months`}
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
                signedIn={Boolean(user)}
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

          <section className="mx-auto mt-5 max-w-6xl rounded-2xl border border-border bg-surface p-7 md:p-9">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="mono-eyebrow text-primary">
                  {isItalian ? "Ricariche opzionali" : "Optional top-ups"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {isItalian
                    ? "Più crediti, senza cambiare piano."
                    : "More credits, without changing plan."}
                </h2>
              </div>
              <p className="text-xs text-foreground/45">
                {isItalian
                  ? "Richiedono un piano attivo · non scadono"
                  : "Active plan required · credits roll over"}
              </p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {Object.values(CREDIT_TOP_UPS).map(pack => (
                <div
                  key={pack.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-background px-5 py-4"
                >
                  <div>
                    <p className="text-xl font-semibold">
                      {pack.credits.toLocaleString(
                        isItalian ? "it-IT" : "en-IE"
                      )}
                    </p>
                    <p className="text-xs text-foreground/45">
                      {isItalian ? "crediti" : "credits"}
                    </p>
                  </div>
                  <p className="text-2xl font-semibold">€{pack.price}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-foreground/40">
              {isItalian
                ? "I prezzi mostrati includono l'IVA ove applicabile. Il checkout conferma il trattamento fiscale corretto."
                : "Displayed prices include VAT where applicable. Checkout confirms the correct tax treatment."}
            </p>
          </section>
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
  signedIn,
}: {
  plan: Plan;
  billingCycle: BillingCycle;
  isItalian: boolean;
  signedIn: boolean;
}) {
  const price =
    billingCycle === "monthly" ? plan.monthlyPrice : plan.annualMonthlyPrice;
  const priceLabel = new Intl.NumberFormat(isItalian ? "it-IT" : "en-IE", {
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price);
  const creditLabel = new Intl.NumberFormat(
    isItalian ? "it-IT" : "en-IE"
  ).format(plan.monthlyCredits);
  const annualTotalLabel = new Intl.NumberFormat(
    isItalian ? "it-IT" : "en-IE"
  ).format(plan.annualTotal);
  const billingPath = `/dashboard/billing?plan=${plan.id}&cycle=${billingCycle}`;
  const checkoutPath = signedIn
    ? billingPath
    : `/auth/signup?next=${encodeURIComponent(billingPath)}`;

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
        <span className="text-5xl font-semibold tracking-tight">
          €{priceLabel}
        </span>
        <span className="pb-1 text-sm text-foreground/45">
          /{isItalian ? "mese" : "month"}
        </span>
      </div>
      <p className="mt-2 min-h-[20px] text-xs text-foreground/45">
        {billingCycle === "annual"
          ? isItalian
            ? `€${annualTotalLabel} fatturati annualmente`
            : `€${annualTotalLabel} billed annually`
          : isItalian
            ? "Fatturazione mensile"
            : "Billed monthly"}
      </p>
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="text-lg font-semibold leading-none text-foreground">
            {creditLabel}
          </p>
          <p className="mt-1 text-xs text-foreground/55">
            {isItalian ? "crediti ogni mese" : "credits every month"}
          </p>
        </div>
      </div>
      <Link
        to={checkoutPath}
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
