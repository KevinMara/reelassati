import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Coins,
  CreditCard,
  Gauge,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  AI_CREDIT_COSTS,
  CREDIT_TOP_UPS,
  PLAN_NAME_BY_ID,
  isBillingCycle,
  isPlanId,
  type BillingCycle,
  type BillingSummary,
  type CreditTopUpId,
  type PlanId,
} from "@contracts/billing";
import { PUBLIC_PLAN_PRICING } from "@contracts/pricing";
import { platformApi } from "@/lib/platform-api";

const PLAN_IDS: PlanId[] = ["creator", "pro", "studio"];

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function actionLabel(category: string): string {
  const labels: Record<string, string> = {
    subscription: "Plan credits",
    topup: "Credit top-up",
    referral: "Referral reward",
    script: "Script",
    "edit-plan": "Edit plan",
    analysis: "Video analysis",
    transcription: "Transcription",
    speech: "Voice",
    image: "Image",
    video: "Video",
    "trend-research": "Trend research",
    migration: "Balance migration",
  };
  return labels[category] || category.replace(/-/g, " ");
}

export default function BillingPage() {
  const [searchParams] = useSearchParams();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedPlan = searchParams.get("plan") || "";
  const selectedCycle = searchParams.get("cycle") || "";
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    isBillingCycle(selectedCycle) ? selectedCycle : "monthly"
  );
  const checkoutState = searchParams.get("checkout");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await platformApi.billingSummary();
      setSummary(result.billing);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Billing details could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void platformApi
      .billingSummary()
      .then(result => {
        if (active) setSummary(result.billing);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Billing details could not be loaded."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const includedAllocation = summary?.plan?.monthlyCredits || 0;
  const includedPercent = useMemo(
    () =>
      includedAllocation > 0
        ? Math.min(
            100,
            Math.round(
              ((summary?.includedCredits || 0) / includedAllocation) * 100
            )
          )
        : 0,
    [includedAllocation, summary?.includedCredits]
  );

  const openCheckout = async (planId: PlanId) => {
    setBusy(`plan:${planId}`);
    setError(null);
    try {
      const { checkoutUrl } = await platformApi.createSubscriptionCheckout(
        planId,
        billingCycle
      );
      window.location.assign(checkoutUrl);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Checkout could not open."
      );
      setBusy(null);
    }
  };

  const openTopUp = async (topUpId: CreditTopUpId) => {
    setBusy(`topup:${topUpId}`);
    setError(null);
    try {
      const { checkoutUrl } = await platformApi.createTopUpCheckout(topUpId);
      window.location.assign(checkoutUrl);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Checkout could not open."
      );
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setBusy("portal");
    setError(null);
    try {
      const { portalUrl } = await platformApi.createBillingPortal();
      window.location.assign(portalUrl);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Billing portal could not open."
      );
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mono-eyebrow mb-2 text-primary">Plan & credits</p>
          <h1 className="text-3xl font-semibold">Your creative fuel.</h1>
          <p className="mt-2 max-w-2xl text-foreground/60">
            One transparent REELassati balance for every AI tool. Plan credits
            refresh monthly; purchased top-ups roll over.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-pill border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/40 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {checkoutState === "success" ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <p>
            Payment received. Your plan or top-up appears as soon as the signed
            confirmation reaches REELassati—normally within a few seconds.
          </p>
        </div>
      ) : null}
      {checkoutState === "cancelled" ? (
        <div className="mb-5 rounded-xl border border-border bg-surface p-4 text-sm text-foreground/65">
          Checkout was closed. Nothing was charged.
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mb-5 rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}
      {!loading && summary && !summary.configured ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p>
            Secure billing is being activated. Purchases are temporarily paused;
            no payment can be attempted until activation is complete.
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.12] via-surface to-fuchsia-500/[0.06] p-6 shadow-card sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="mono-eyebrow text-primary">Available now</p>
              <div className="mt-3 flex items-center gap-3">
                <Coins className="h-7 w-7 text-primary" />
                <span className="text-5xl font-semibold tracking-tight">
                  {loading
                    ? "—"
                    : (summary?.availableCredits || 0).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-sm text-foreground/55">
                REELassati credits
              </p>
            </div>
            {summary?.plan ? (
              <span className="rounded-pill border border-primary/25 bg-background/70 px-3 py-1.5 text-xs font-medium text-primary backdrop-blur">
                {summary.plan.name} · {summary.plan.status.replace(/_/g, " ")}
              </span>
            ) : null}
          </div>
          <div className="relative mt-7 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-background/55 p-4 backdrop-blur">
              <p className="text-xs text-foreground/45">Plan credits</p>
              <p className="mt-1 text-xl font-semibold">
                {(summary?.includedCredits || 0).toLocaleString()}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${includedPercent}%` }}
                />
              </div>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/55 p-4 backdrop-blur">
              <p className="text-xs text-foreground/45">Rollover top-ups</p>
              <p className="mt-1 text-xl font-semibold">
                {(summary?.topUpCredits || 0).toLocaleString()}
              </p>
              <p className="mt-3 text-[11px] text-foreground/45">
                Extra credits stay in your balance.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium">
                {summary?.plan ? "Current plan" : "Choose a plan"}
              </p>
              <p className="text-xs text-foreground/45">
                Payments secured by Stripe
              </p>
            </div>
          </div>
          {summary?.plan ? (
            <div className="mt-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-semibold">{summary.plan.name}</p>
                  <p className="mt-1 text-sm capitalize text-foreground/50">
                    {summary.plan.billingCycle} billing
                  </p>
                </div>
                <p className="text-right text-xs text-foreground/45">
                  {summary.plan.cancelAtPeriodEnd ? "Ends" : "Renews"}
                  <br />
                  <span className="text-foreground/70">
                    {formatDate(summary.plan.currentPeriodEnd)}
                  </span>
                </p>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-background p-3">
                  <p className="font-semibold">
                    {summary.plan.monthlyCredits.toLocaleString()}
                  </p>
                  <p className="mt-1 text-foreground/40">credits/mo</p>
                </div>
                <div className="rounded-lg bg-background p-3">
                  <p className="font-semibold">{summary.plan.workspaces}</p>
                  <p className="mt-1 text-foreground/40">workspaces</p>
                </div>
                <div className="rounded-lg bg-background p-3">
                  <p className="font-semibold">{summary.plan.socialAccounts}</p>
                  <p className="mt-1 text-foreground/40">socials</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void openPortal()}
                disabled={busy === "portal" || !summary.configured}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-pill border border-border px-5 py-3 text-sm font-medium hover:border-primary/40 disabled:opacity-50"
              >
                {busy === "portal" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Manage plan and invoices
              </button>
            </div>
          ) : (
            <PlanChooser
              billingCycle={billingCycle}
              setBillingCycle={setBillingCycle}
              selectedPlan={isPlanId(selectedPlan) ? selectedPlan : null}
              busy={busy}
              disabled={!summary?.configured}
              onChoose={openCheckout}
            />
          )}
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-medium">Credit top-ups</h2>
            <p className="text-xs text-foreground/45">
              Add more without changing your plan. Top-ups roll over.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {(Object.keys(CREDIT_TOP_UPS) as CreditTopUpId[]).map((id, index) => {
            const pack = CREDIT_TOP_UPS[id];
            const available = summary?.topUps.find(
              item => item.id === id
            )?.available;
            return (
              <button
                key={id}
                type="button"
                onClick={() => void openTopUp(id)}
                disabled={
                  !summary?.canUseCredits || !available || busy !== null
                }
                className="group rounded-xl border border-border bg-background p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card disabled:translate-y-0 disabled:opacity-45"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-semibold">
                      {pack.credits.toLocaleString()}
                    </p>
                    <p className="text-xs text-foreground/45">credits</p>
                  </div>
                  {index === 1 ? (
                    <span className="rounded-pill bg-primary/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-primary">
                      Popular
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <span className="font-medium">€{pack.price}</span>
                  {busy === `topup:${id}` ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-foreground/40">
          Displayed prices include VAT where applicable. Checkout confirms the
          correct tax treatment from your billing details.
        </p>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
        <section className="rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <h2 className="font-medium">Credit guide</h2>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {[
              ["Script", `${AI_CREDIT_COSTS.script}`],
              ["AI edit plan", `${AI_CREDIT_COSTS.editPlan}`],
              ["1K image", `${AI_CREDIT_COSTS.image1K}`],
              ["2K image", `${AI_CREDIT_COSTS.image2K}`],
              [
                "Voice · 1,000 characters",
                `${AI_CREDIT_COSTS.speechPerThousandCharacters}`,
              ],
              [
                "Video analysis · minute",
                `${AI_CREDIT_COSTS.videoAnalysisPerMinute}`,
              ],
              [
                "Transcription · minute",
                `${AI_CREDIT_COSTS.transcriptionPerMinute}`,
              ],
              [
                "15s video · 720p",
                `${AI_CREDIT_COSTS.video720pPerSecond * 15}+`,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 rounded-lg bg-background px-3 py-2.5"
              >
                <span className="text-foreground/60">{label}</span>
                <span className="font-mono text-xs font-medium text-primary">
                  {value} cr
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-medium">Recent credit activity</h2>
          <p className="mt-1 text-xs text-foreground/45">
            Failed AI jobs are released automatically and do not consume
            credits.
          </p>
          <div className="mt-4 divide-y divide-border">
            {loading ? (
              <div className="flex h-28 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : summary?.recentActivity.length ? (
              summary.recentActivity.slice(0, 10).map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {actionLabel(item.category)}
                    </p>
                    <p className="truncate text-xs text-foreground/40">
                      {item.description} · {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`font-mono text-xs font-medium ${item.amount >= 0 ? "text-emerald-500" : item.status === "released" ? "text-foreground/35 line-through" : "text-foreground"}`}
                  >
                    {item.amount > 0 ? "+" : ""}
                    {item.amount.toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-sm text-foreground/40">
                Credit activity will appear here.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function PlanChooser({
  billingCycle,
  setBillingCycle,
  selectedPlan,
  busy,
  disabled,
  onChoose,
}: {
  billingCycle: BillingCycle;
  setBillingCycle: (cycle: BillingCycle) => void;
  selectedPlan: PlanId | null;
  busy: string | null;
  disabled: boolean;
  onChoose: (planId: PlanId) => Promise<void>;
}) {
  return (
    <div className="mt-5">
      <div className="inline-flex rounded-pill border border-border bg-background p-1 text-xs">
        {(["monthly", "annual"] as const).map(cycle => (
          <button
            key={cycle}
            type="button"
            onClick={() => setBillingCycle(cycle)}
            className={`rounded-pill px-3 py-1.5 capitalize ${billingCycle === cycle ? "bg-primary text-primary-foreground" : "text-foreground/50"}`}
          >
            {cycle}
            {cycle === "annual" ? " · 2 months free" : ""}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {PLAN_IDS.map(planId => {
          const name = PLAN_NAME_BY_ID[planId];
          const plan = PUBLIC_PLAN_PRICING[name];
          const price =
            billingCycle === "monthly" ? plan.monthlyPrice : plan.annualTotal;
          return (
            <button
              key={planId}
              type="button"
              onClick={() => void onChoose(planId)}
              disabled={disabled || busy !== null}
              className={`flex w-full items-center justify-between gap-4 rounded-xl border p-4 text-left transition-all hover:border-primary/40 disabled:opacity-50 ${selectedPlan === planId ? "border-primary/45 bg-primary/[0.06]" : "border-border bg-background"}`}
            >
              <div>
                <p className="font-medium">{name}</p>
                <p className="text-xs text-foreground/45">
                  {plan.monthlyCredits.toLocaleString()} credits/month
                </p>
              </div>
              <div className="flex items-center gap-2 text-right">
                <div>
                  <p className="font-semibold">€{price.toLocaleString()}</p>
                  <p className="text-[10px] text-foreground/40">
                    /{billingCycle === "monthly" ? "mo" : "yr"}
                  </p>
                </div>
                {busy === `plan:${planId}` ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <ArrowRight className="h-4 w-4 text-primary" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
