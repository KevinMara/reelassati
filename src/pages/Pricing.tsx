import { useUiText } from "@/lib/i18n/ui";
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

function createPlans(ui: ReturnType<typeof useUiText>): Plan[] {
  return [
    {
      id: "creator",
      name: "Creator",
      description: ui(
        "For one creator building a repeatable short-form system."
      ),
      monthlyPrice: PUBLIC_PLAN_PRICING.Creator.monthlyPrice,
      annualMonthlyPrice: annualMonthlyEquivalent("Creator"),
      annualTotal: PUBLIC_PLAN_PRICING.Creator.annualTotal,
      monthlyCredits: PUBLIC_PLAN_PRICING.Creator.monthlyCredits,
      features: [
        ui("1 brand workspace"),
        ui("1 connected social account"),
        ui("Precision Studio and reviewable edit plans"),
        ui("Scripts, Prompt Director, calendar, and analytics"),
        ui("Version history and finished MP4 exports"),
      ],
    },
    {
      id: "pro",
      name: "Pro",
      description: ui("For creators and small teams running several channels."),
      monthlyPrice: PUBLIC_PLAN_PRICING.Pro.monthlyPrice,
      annualMonthlyPrice: annualMonthlyEquivalent("Pro"),
      annualTotal: PUBLIC_PLAN_PRICING.Pro.annualTotal,
      monthlyCredits: PUBLIC_PLAN_PRICING.Pro.monthlyCredits,
      featured: true,
      features: [
        ui("3 brand workspaces"),
        ui("5 connected social accounts"),
        ui("Everything in Creator"),
        ui("Content library and publishing queue"),
        ui("Content activity charts and usage tracking"),
      ],
    },
    {
      id: "studio",
      name: "Studio",
      description: ui("For creators producing a larger volume of content."),
      monthlyPrice: PUBLIC_PLAN_PRICING.Studio.monthlyPrice,
      annualMonthlyPrice: annualMonthlyEquivalent("Studio"),
      annualTotal: PUBLIC_PLAN_PRICING.Studio.annualTotal,
      monthlyCredits: PUBLIC_PLAN_PRICING.Studio.monthlyCredits,
      features: [
        ui("10 brand workspaces"),
        ui("10 connected social accounts"),
        ui("Everything in Pro"),
        ui("Higher generation and publishing allowances"),
        ui("Shared library across creation tools"),
      ],
    },
  ];
}

export default function Pricing() {
  const ui = useUiText();
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || "en";
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const plans = createPlans(ui);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pb-20 pt-24">
        <div className="container-page">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mono-eyebrow text-primary">{ui("Pricing")}</p>
            <h1 className="mt-3 text-4xl font-semibold md:text-5xl">
              {ui("Choose the scale.")}{" "}
              <span className="serif-accent">{ui("Keep the control.")}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-foreground/65">
              {ui(
                "All the creation tools. Choose the credits and social accounts that fit your work."
              )}
            </p>

            <div
              className="mx-auto mt-8 inline-flex rounded-pill border border-border bg-surface p-1 shadow-card"
              role="group"
              aria-label={ui("Billing period")}
            >
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                aria-pressed={billingCycle === "monthly"}
                className={`rounded-pill px-5 py-2 text-sm font-medium transition-all ${billingCycle === "monthly" ? "bg-foreground text-background" : "text-foreground/70 hover:text-foreground"}`}
              >
                {ui("Monthly")}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                aria-pressed={billingCycle === "annual"}
                className={`rounded-pill px-5 py-2 text-sm font-medium transition-all ${billingCycle === "annual" ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:text-foreground"}`}
              >
                {ui("Annual · pay for {{months}} months", {
                  months: ANNUAL_BILLED_MONTHS,
                })}
              </button>
            </div>
          </div>

          <div className="mx-auto mt-8 grid max-w-6xl items-stretch gap-5 lg:grid-cols-3">
            {plans.map(plan => (
              <PlanCard
                key={plan.name}
                plan={plan}
                billingCycle={billingCycle}
                locale={locale}
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
                    {ui("REELassati credits")}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    {ui("One balance for every AI tool.")}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/60">
                    {ui(
                      "Video, voice, and other AI tools use REELassati credits inside the platform. There are no external prices or technical integration details to manage."
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/25 bg-primary/[0.045] p-7 md:p-9">
              <p className="mono-eyebrow text-primary">
                {ui("Need more scale?")}
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                {ui("We’ll shape the right plan.")}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-foreground/60">
                {ui(
                  "More brands, accounts, or a tailored workflow: we start from your real volume."
                )}
              </p>
              <a
                href="mailto:reelassati@gmail.com?subject=REELassati%20Studio%20plan"
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover"
              >
                {ui("Talk to us")}{" "}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </div>

          <section className="mx-auto mt-5 max-w-6xl rounded-2xl border border-border bg-surface p-7 md:p-9">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="mono-eyebrow text-primary">
                  {ui("Optional top-ups")}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {ui("More credits, without changing plan.")}
                </h2>
              </div>
              <p className="text-sm text-foreground/70">
                {ui(
                  "Lower credit prices than every plan · active subscription required"
                )}
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
                      {pack.credits.toLocaleString(locale)}
                    </p>
                    <p className="text-sm text-foreground/70">
                      {ui("credits")}
                    </p>
                  </div>
                  <div className="text-right">
                    <strong className="text-2xl">{pack.price} USD</strong>
                    <p className="mt-1 text-sm text-foreground/70">
                      {((pack.price / pack.credits) * 1000).toLocaleString(
                        locale,
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                      )}
                      USD / {Number(1000).toLocaleString(locale)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-foreground/70">
              {ui(
                "Base prices are in USD, excluding tax. Checkout offers supported local currencies; Stripe calculates and adds applicable taxes."
              )}
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
  locale,
  signedIn,
}: {
  plan: Plan;
  billingCycle: BillingCycle;
  locale: string;
  signedIn: boolean;
}) {
  const ui = useUiText();
  const price =
    billingCycle === "monthly" ? plan.monthlyPrice : plan.annualMonthlyPrice;
  const priceLabel = new Intl.NumberFormat(locale, {
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price);
  const creditLabel = new Intl.NumberFormat(locale).format(plan.monthlyCredits);
  const annualTotalLabel = new Intl.NumberFormat(locale).format(
    plan.annualTotal
  );
  const billingPath = `/dashboard/billing?plan=${plan.id}&cycle=${billingCycle}`;
  const checkoutPath = signedIn
    ? billingPath
    : `/auth/signup?next=${encodeURIComponent(billingPath)}`;

  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover ${plan.featured ? "border-primary/45 bg-primary/[0.05]" : "border-border bg-surface"}`}
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
          <span className="rounded-pill bg-primary px-2.5 py-1 font-mono text-xs uppercase tracking-wider text-primary-foreground">
            {ui("Recommended")}
          </span>
        )}
      </div>
      <p className="mt-4 min-h-[48px] text-sm leading-relaxed text-foreground/70">
        {plan.description}
      </p>
      <div className="mt-6 flex items-end gap-2">
        <span className="text-5xl font-semibold tracking-tight">
          {priceLabel}
        </span>
        <span className="pb-1 text-sm text-foreground/70">
          USD /{ui("month")}
        </span>
      </div>
      <p className="mt-2 min-h-[20px] text-xs text-foreground/70">
        {billingCycle === "annual"
          ? ui("{{total}} USD billed annually", { total: annualTotalLabel })
          : ui("Billed monthly")}
      </p>
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="text-lg font-semibold leading-none text-foreground">
            {creditLabel}
          </p>
          <p className="mt-1 text-xs text-foreground/70">
            {ui("credits every month")}
          </p>
        </div>
        <p className="ml-auto max-w-[130px] text-right text-sm font-medium text-foreground">
          {plan.features[1]}
        </p>
      </div>
      <Link
        to={checkoutPath}
        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-pill px-5 py-3 text-sm font-medium transition-colors ${plan.featured ? "bg-primary text-primary-foreground hover:bg-primary-hover" : "border border-border bg-background text-foreground hover:border-primary/35"}`}
      >
        {ui("Choose {{name}}", { name: plan.name })}{" "}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
      <ul className="mt-6 flex-1 space-y-3 border-t border-border pt-5">
        {plan.features
          .filter((_, index) => index !== 1)
          .map(item => (
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
