import { CreditPlanner } from "@/components/studio/CreditPlanner";
import posthog from "@/lib/posthog";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Coins,
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
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  const sessionId = searchParams.get("session_id");
  const [paymentState, setPaymentState] = useState<string>("checking");

  useEffect(() => {
    if (checkoutState !== "success" || !sessionId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const confirm = async () => {
      try {
        const { status } = await platformApi.checkoutStatus(sessionId);
        if (!active) return;
        setPaymentState(status);
        if (status === "complete") {
          const result = await platformApi.billingSummary();
          if (active) setSummary(result.billing);
          return;
        }
        if (status === "expired") return;
      } catch {
        if (!active) return;
        setPaymentState("unconfirmed");
      }
      if (++attempt < 6)
        timer = setTimeout(
          () => void confirm(),
          Math.min(15_000, 2_000 * 2 ** attempt)
        );
    };
    void confirm();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [checkoutState, sessionId]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await platformApi.billingSummary();
      setSummary(result.billing);
      if (checkoutState === "success" && sessionId) {
        const confirmation = await platformApi
          .checkoutStatus(sessionId)
          .catch(() => null);
        if (confirmation) setPaymentState(confirmation.status);
      }
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
    posthog?.capture("plans_viewed");
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
      posthog?.capture("checkout_opened", {
        kind: "subscription",
        planId,
        billingCycle,
      });
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
      posthog?.capture("checkout_opened", { kind: "topup", topUpId });
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

      {checkoutState === "success" && sessionId ? (
        <div
          role="status"
          className={`mb-5 flex items-start gap-3 rounded-xl border p-4 text-sm ${paymentState === "complete" ? "border-emerald-500/25 bg-emerald-500/10" : "border-primary/25 bg-primary/5"}`}
        >
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            {paymentState === "complete"
              ? "Payment confirmed. Your credits are ready—let’s create something."
              : paymentState === "expired"
                ? "This checkout expired. You can start a new purchase."
                : "Confirming your payment and credits. This page checks automatically; delayed payment methods may take longer."}
          </p>
        </div>
      ) : null}
      {checkoutState === "cancelled" ? (
        <div className="mb-5 rounded-xl border border-border bg-surface p-4 text-sm text-foreground/65">
          Checkout was closed. Your current balance and invoices show any
          completed purchases.
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

      <PlanChooser
        billingCycle={billingCycle}
        setBillingCycle={setBillingCycle}
        selectedPlan={isPlanId(selectedPlan) ? selectedPlan : null}
        busy={busy}
        disabled={!summary?.configured}
        onChoose={openCheckout}
        summary={summary}
        onManage={openPortal}
      />

      <section className="mt-5 rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-medium">Credit top-ups</h2>
            <p className="text-sm text-foreground/70">
              Extra credits at a lower unit price than any plan. Yours to keep
              across renewals, with an active subscription.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {(Object.keys(CREDIT_TOP_UPS) as CreditTopUpId[]).map((id, index) => {
            const pack =
              summary?.topUps.find(item => item.id === id) ||
              CREDIT_TOP_UPS[id];
            const available = summary?.topUps.find(
              item => item.id === id
            )?.available;
            return (
              <article
                key={id}
                className="group rounded-xl border border-border bg-background p-5 text-left transition-all motion-safe:hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-semibold">
                      {pack.credits.toLocaleString()}
                    </p>
                    <p className="text-xs text-foreground/70">credits</p>
                  </div>
                  {index === 2 ? (
                    <span className="rounded-pill bg-primary/10 px-2 py-1 font-mono text-xs uppercase tracking-wide text-primary">
                      Best credit value
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <span className="font-medium">€{pack.price.toFixed(2)}</span>
                  {busy === `topup:${id}` ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" />
                  )}
                </div>
                <p className="mt-3 text-sm text-foreground/70">
                  €{((pack.price / pack.credits) * 1000).toFixed(2)} per 1,000
                  credits
                </p>
                <p className="mt-2 text-sm text-foreground/80">
                  {id === "boost"
                    ? "Covers one 15-second 720p video with audio, plus 100 credits."
                    : id === "momentum"
                      ? "Room for two 15-second 720p videos with audio, plus 200 credits."
                      : "Room for five 15-second 720p videos with audio, plus 500 credits."}
                </p>
                <button
                  type="button"
                  onClick={() => void openTopUp(id)}
                  disabled={
                    !summary?.configured ||
                    !summary?.canUseCredits ||
                    !available ||
                    busy !== null
                  }
                  className="mt-4 w-full rounded-pill bg-primary/15 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy === `topup:${id}`
                    ? "Opening…"
                    : !summary?.configured
                      ? "Purchases opening soon"
                      : !summary?.canUseCredits
                        ? "Active plan required"
                        : "Add credits"}
                </button>
              </article>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-foreground/65">
          Displayed prices include VAT where applicable. Checkout confirms the
          correct tax treatment from your billing details.
        </p>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
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
          {!!summary?.adjustmentDebt && (
            <p className="relative mt-4 text-sm text-foreground/75">
              {summary.adjustmentDebt.toLocaleString()} credits deducted for a
              payment refund or dispute. Your available balance includes this
              adjustment.
            </p>
          )}
          <div className="relative mt-7 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-background/55 p-4 backdrop-blur">
              <p className="text-xs text-foreground/70">Plan credits</p>
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
              <p className="text-xs text-foreground/70">Rollover top-ups</p>
              <p className="mt-1 text-xl font-semibold">
                {(summary?.topUpCredits || 0).toLocaleString()}
              </p>
              <p className="mt-3 text-xs text-foreground/70">
                Extra credits stay in your balance.
              </p>
            </div>
          </div>
        </section>
        <UsageChart summary={summary} loading={loading} />
      </div>

      <CreditPlanner />

      <div className="mt-5 grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
        <section className="rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <h2 className="font-medium">Credit guide</h2>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {[
              ["Script", `${AI_CREDIT_COSTS.script}`],
              ["Trend research · one / both platforms", "8 / 15"],
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
                "15s video · 720p, no audio",
                `${AI_CREDIT_COSTS.video720pPerSecond * 15}`,
              ],
              [
                "15s video · 720p with audio",
                `${AI_CREDIT_COSTS.video720pWithAudioPerSecond * 15}`,
              ],
              [
                "Continue 15s · 720p / 1080p",
                `${AI_CREDIT_COSTS.continuation720p15Seconds} / ${AI_CREDIT_COSTS.continuation1080p15Seconds}`,
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
          <h2 className="font-medium">What can your credits create?</h2>
          <p className="mt-2 text-sm text-foreground/70">
            With your current balance, choose up to one of these:
          </p>
          <div className="my-5 grid grid-cols-2 gap-3">
            {[
              ["scripts", AI_CREDIT_COSTS.script],
              ["1K images", AI_CREDIT_COSTS.image1K],
              [
                "1,000-character voice clips",
                AI_CREDIT_COSTS.speechPerThousandCharacters,
              ],
              [
                "15s 720p videos without audio",
                AI_CREDIT_COSTS.video720pPerSecond * 15,
              ],
            ].map(([label, cost]) => (
              <div
                key={label}
                className="rounded-xl border border-primary/15 bg-primary/5 p-4"
              >
                <p className="text-2xl font-semibold text-primary">
                  {loading
                    ? "—"
                    : Math.floor(
                        (summary?.availableCredits || 0) / Number(cost)
                      ).toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-foreground/75">{label}</p>
              </div>
            ))}
          </div>
          <p className="mb-6 text-xs text-foreground/65">
            Examples are alternatives, not a combined allowance.
          </p>
          <h2 className="font-medium">Recent credit activity</h2>
          <p className="mt-1 text-xs text-foreground/70">
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
                    <p className="truncate text-xs text-foreground/65">
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
              <div className="py-10 text-center text-sm text-foreground/65">
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
  summary,
  onManage,
}: {
  billingCycle: BillingCycle;
  setBillingCycle: (cycle: BillingCycle) => void;
  selectedPlan: PlanId | null;
  busy: string | null;
  disabled: boolean;
  onChoose: (planId: PlanId) => Promise<void>;
  summary: BillingSummary | null;
  onManage: () => Promise<void>;
}) {
  const manageExisting = Boolean(
    summary?.plan &&
    !["canceled", "incomplete_expired", "inactive"].includes(
      summary.plan.status
    )
  );
  return (
    <section aria-labelledby="plans-title">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="plans-title" className="text-2xl font-semibold">
            Find your creative pace.
          </h2>
          <p className="mt-2 text-foreground/70">
            One plan. Every creation tool. Room to keep going.
          </p>
        </div>
        <div
          className="inline-flex rounded-pill border border-border bg-surface p-1 text-sm"
          role="group"
          aria-label="Billing cycle"
        >
          {(["monthly", "annual"] as const).map(cycle => (
            <button
              key={cycle}
              type="button"
              aria-pressed={billingCycle === cycle}
              onClick={() => setBillingCycle(cycle)}
              className={`rounded-pill px-4 py-2 capitalize transition-colors ${billingCycle === cycle ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/75 hover:bg-primary/10"}`}
            >
              {cycle}
              {cycle === "annual" ? " · 2 months free" : ""}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        {PLAN_IDS.map(planId => {
          const name = PLAN_NAME_BY_ID[planId];
          const plan = PUBLIC_PLAN_PRICING[name];
          const current = summary?.plan?.id === planId && summary.canUseCredits;
          const featured = planId === "pro";
          const annual = billingCycle === "annual";
          const price = annual ? plan.annualTotal / 12 : plan.monthlyPrice;
          return (
            <article
              key={planId}
              className={`relative flex flex-col rounded-2xl border p-6 transition-all motion-safe:hover:-translate-y-1 ${featured ? "border-primary/60 bg-gradient-to-br from-primary/15 via-surface to-surface shadow-[0_8px_40px_-16px_hsl(var(--primary)/0.45)]" : "border-border bg-surface hover:border-primary/40"} ${selectedPlan === planId ? "ring-2 ring-primary/30" : ""}`}
            >
              <div className="mb-5 flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-widest text-primary">
                  {planId === "creator"
                    ? "Your first momentum"
                    : featured
                      ? "More room to create"
                      : "Your biggest ideas"}
                </span>
                {(current || featured) && (
                  <span className="rounded-pill bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    {current ? "Current plan" : "Recommended"}
                  </span>
                )}
              </div>
              <h3 className="text-2xl font-semibold">{name}</h3>
              <p className="mt-2 min-h-12 text-sm text-foreground/75">
                {planId === "creator"
                  ? "For one creator finding a consistent rhythm."
                  : featured
                    ? "For frequent creators running several channels."
                    : "For a larger content output across your channels."}
              </p>
              <p className="mt-5">
                <span className="text-4xl font-semibold tracking-tight">
                  €
                  {price.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-sm text-foreground/70"> / month</span>
              </p>
              <p className="mt-2 text-sm text-foreground/70">
                {annual
                  ? `€${plan.annualTotal.toLocaleString()} billed yearly · save €${plan.monthlyPrice * 2}`
                  : "Billed monthly · cancel renewal anytime"}
              </p>
              <div className="my-6 rounded-xl border border-primary/20 bg-primary/10 p-4">
                <p className="text-3xl font-semibold text-primary">
                  {plan.monthlyCredits.toLocaleString()}
                </p>
                <p className="mt-1 text-sm">credits every month</p>
              </div>
              <ul className="space-y-3 text-sm text-foreground/85">
                {[
                  `${plan.workspaces} brand workspace${plan.workspaces === 1 ? "" : "s"}`,
                  `${plan.socialAccounts} connected social accounts`,
                  "AI scripts, images, video and voice",
                  "Video analysis and custom trend research",
                  "Weekly organic short-form trends",
                  "Library, MP4 export and content calendar",
                  "Optional credit top-ups that roll over",
                ].map(detail => (
                  <li key={detail} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {detail}
                  </li>
                ))}
              </ul>
              <p className="my-5 border-t border-border pt-4 text-sm text-foreground/70">
                For example: up to{" "}
                {Math.floor(
                  plan.monthlyCredits / AI_CREDIT_COSTS.image1K
                ).toLocaleString()}{" "}
                1K images if used only for images.
              </p>
              <button
                type="button"
                disabled={
                  (manageExisting ? !summary?.canManageBilling : disabled) ||
                  busy !== null
                }
                onClick={() =>
                  void (manageExisting ? onManage() : onChoose(planId))
                }
                className={`mt-auto flex w-full items-center justify-center gap-2 rounded-pill px-5 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${featured ? "bg-primary text-primary-foreground hover:bg-primary-hover" : "border border-primary/35 bg-primary/10 text-foreground hover:bg-primary/20"}`}
              >
                {busy === `plan:${planId}` || busy === "portal" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {disabled && !manageExisting
                  ? "Purchases opening soon"
                  : current
                    ? "Manage your plan"
                    : manageExisting
                      ? `Explore ${name} in billing`
                      : `Choose ${name}`}
              </button>
            </article>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-foreground/70">
        Prices include VAT where applicable. Annual plans receive credits
        monthly. Plan credits reset; purchased credits roll over.
      </p>
      {(summary?.plan || summary?.canManageBilling) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
          <span>
            {summary.plan ? (
              <>
                {summary.plan.name} · {summary.plan.status.replace(/_/g, " ")} ·{" "}
                {summary.plan.cancelAtPeriodEnd ? "Ends" : "Period ends"}{" "}
                {formatDate(summary.plan.currentPeriodEnd)}
              </>
            ) : (
              "Your billing account"
            )}
          </span>
          <button
            type="button"
            onClick={() => void onManage()}
            disabled={!summary?.canManageBilling || busy !== null}
            className="font-medium text-primary disabled:opacity-60"
          >
            Manage plan and invoices
          </button>
        </div>
      )}
    </section>
  );
}

const USAGE_CATEGORIES = [
  { key: "video", label: "Video", color: "#9879f5" },
  { key: "image", label: "Images", color: "#e678bd" },
  { key: "speech", label: "Voice", color: "#43bba7" },
  { key: "script", label: "Scripts", color: "#599ce8" },
  { key: "analysis", label: "Analysis", color: "#e5a84e" },
  { key: "transcription", label: "Transcription", color: "#a9bc53" },
  { key: "edit-plan", label: "Editing", color: "#c783ee" },
  { key: "trend-research", label: "Research", color: "#ee8577" },
];
function UsageChart({
  summary,
  loading,
}: {
  summary: BillingSummary | null;
  loading: boolean;
}) {
  const [range, setRange] = useState(30);
  const data = useMemo(() => {
    const end = new Date(summary?.usage?.through || new Date().toISOString());
    end.setUTCHours(0, 0, 0, 0);
    return Array.from({ length: range }, (_, i) => {
      const day = new Date(end);
      day.setUTCDate(day.getUTCDate() - range + 1 + i);
      const date = day.toISOString().slice(0, 10);
      const row: Record<string, string | number> = { date };
      for (const category of USAGE_CATEGORIES) row[category.key] = 0;
      for (const entry of summary?.usage?.daily || [])
        if (entry.date === date) row[entry.category] = entry.credits;
      return row;
    });
  }, [summary?.usage, range]);
  const totals = USAGE_CATEGORIES.map(category => ({
    ...category,
    total: data.reduce((sum, row) => sum + Number(row[category.key] || 0), 0),
  }));
  const total = totals.reduce((sum, category) => sum + category.total, 0);
  return (
    <section
      className="min-w-0 rounded-2xl border border-border bg-surface p-6"
      aria-labelledby="usage-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="usage-title" className="text-xl font-semibold">
            Your creative activity
          </h2>
          <p className="mt-2 text-3xl font-semibold">
            {loading || !summary?.usage ? "—" : total.toLocaleString()}{" "}
            <span className="text-sm font-normal text-foreground/70">
              credits used
            </span>
          </p>
        </div>
        <select
          aria-label="Credit usage time range"
          value={range}
          onChange={e => setRange(Number(e.target.value))}
          className="rounded-lg border border-border bg-background p-2 text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>
      <div
        className="mt-5 h-56"
        role="img"
        aria-label={`Daily credit usage by tool over ${range} days: ${total} credits. Exact totals listed below.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            accessibilityLayer
            margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 5"
              vertical={false}
              stroke="currentColor"
              opacity={0.15}
            />
            <XAxis
              dataKey="date"
              tickFormatter={date => String(date).slice(5)}
              minTickGap={28}
              tick={{ fill: "currentColor", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, total === 0 ? 10 : "auto"]}
              allowDecimals={false}
              tick={{ fill: "currentColor", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 12,
              }}
            />
            {USAGE_CATEGORIES.map(category => (
              <Bar
                key={category.key}
                name={category.label}
                dataKey={category.key}
                stackId="usage"
                fill={category.color}
                maxBarSize={22}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {totals.map(category => (
          <div
            key={category.key}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2 text-foreground/80">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: category.color }}
              />
              {category.label}
            </span>
            <span className="font-mono">
              {loading || !summary?.usage
                ? "—"
                : category.total.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-foreground/65">
        {loading
          ? "Loading credit usage…"
          : !summary?.usage
            ? "Usage could not be loaded. Try Refresh."
            : total === 0
              ? "No credits used in this period. Your first creation will appear here."
              : "Completed AI actions · UTC dates · failed and pending jobs excluded."}
      </p>
    </section>
  );
}
