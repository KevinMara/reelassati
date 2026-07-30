import { useEffect, useState } from "react";
import {
  Check,
  Coins,
  Copy,
  Gift,
  Link2,
  Loader2,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  platformApi,
  type ReferralStats,
} from "@/lib/platform-api";
import { useWorkspace } from "@/providers/workspace";

export default function ReferralPage() {
  const { workspace } = useWorkspace();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [claimCode, setClaimCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await platformApi.referralStats());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Referral details could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void platformApi
      .referralStats()
      .then((result) => {
        if (active) setStats(result);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Referral details could not be loaded.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const totalCredits = workspace.profile.credits + (stats?.creditsEarned ?? 0);

  const copyValue = async (kind: "link" | "code", value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const share = async () => {
    if (!stats) return;
    if (navigator.share) {
      await navigator.share({
        title: "REELassati",
        text: `Join REELassati with my creator link. I earn ${stats.rewardCredits} credits (${stats.rewardDollarValue} of product value) when you join.`,
        url: stats.shareUrl,
      });
      return;
    }
    await copyValue("link", stats.shareUrl);
  };

  const applyCode = async () => {
    if (!claimCode.trim()) return;
    setClaiming(true);
    setError(null);
    setNotice(null);
    try {
      const result = await platformApi.claimReferral(claimCode.trim());
      setNotice(
        result.alreadyClaimed
          ? "This creator referral was already attached to your account."
          : "Referral applied. The creator received 500 credits ($5.00 of product value).",
      );
      setClaimCode("");
      await loadStats();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The code could not be applied.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <p className="mono-eyebrow mb-2 text-primary">Creator rewards</p>
        <h1 className="text-3xl font-semibold">Refer creators. Earn studio credits.</h1>
        <p className="mt-2 max-w-2xl text-foreground/60">
          Each creator who joins through your unique link adds 500 credits to
          your balance—equivalent to $5.00 of REELassati product usage.
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Metric
          icon={Users}
          label="Successful referrals"
          value={loading ? "—" : String(stats?.completedReferrals ?? 0)}
          detail="One verified account can reward one creator."
        />
        <Metric
          icon={Coins}
          label="Available credits"
          value={totalCredits.toLocaleString()}
          detail={`${stats?.creditsEarned.toLocaleString() ?? 0} earned through referrals.`}
          tone="emerald"
        />
        <Metric
          icon={Gift}
          label="Referral value earned"
          value={stats?.dollarValue ?? "$0.00"}
          detail="Product value only; not withdrawable cash."
          tone="primary"
        />
      </div>

      <section className="mb-6 rounded-xl border border-primary/20 bg-surface p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Your creator link</h2>
            <p className="text-xs text-foreground/45">
              Share the full link or the short creator code.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : stats ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={stats.shareUrl}
                onFocus={(event) => event.currentTarget.select()}
                aria-label="Referral link"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm"
              />
              <button
                type="button"
                onClick={() => void copyValue("link", stats.shareUrl)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium hover:border-primary/50"
              >
                {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === "link" ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => void share()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary-hover"
              >
                <Send className="h-4 w-4" /> Share
              </button>
            </div>
            <button
              type="button"
              onClick={() => void copyValue("code", stats.code)}
              className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 font-mono text-xs text-primary"
            >
              {stats.code}
              {copied === "code" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-medium">Reward history</h2>
          <p className="mt-1 text-xs text-foreground/45">
            Persistent, account-verified referral events.
          </p>
          <div className="mt-5 divide-y divide-border">
            {stats?.referrals.length ? (
              stats.referrals.map((referral) => (
                <div key={referral.id} className="flex items-center gap-3 py-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
                    <Check className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{referral.referredDisplay}</p>
                    <p className="text-xs text-foreground/40">
                      {new Date(referral.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-500">
                      +{referral.creditsAwarded}
                    </p>
                    <p className="text-xs text-foreground/40">{referral.dollarValue}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-sm text-foreground/45">
                Your first successful referral will appear here.
              </div>
            )}
          </div>
        </section>

        <section className="h-fit rounded-xl border border-border bg-surface p-6">
          <h2 className="font-medium">Have a creator code?</h2>
          <p className="mt-1 text-xs leading-relaxed text-foreground/45">
            Apply it once. Self-referrals and duplicate claims are blocked.
          </p>
          <input
            value={claimCode}
            onChange={(event) => setClaimCode(event.target.value.toUpperCase())}
            placeholder="REEL-XXXXXXXX"
            className="mt-4 w-full rounded-lg border border-border bg-background px-4 py-3 font-mono text-sm uppercase"
          />
          <button
            type="button"
            onClick={() => void applyCode()}
            disabled={!claimCode.trim() || claiming}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-45"
          >
            {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            Apply code
          </button>
          {notice ? <p className="mt-3 text-xs text-emerald-500">{notice}</p> : null}
          {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
          <div className="mt-5 flex gap-2 border-t border-border pt-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <p className="text-[11px] leading-relaxed text-foreground/40">
              Credits pay for REELassati usage. The dollar amount communicates
              equivalent product value; it is not cash or a withdrawal balance.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "emerald" | "primary";
}) {
  const iconClass =
    tone === "emerald"
      ? "text-emerald-500"
      : tone === "primary"
        ? "text-primary"
        : "text-foreground/60";
  return (
    <div className={`rounded-xl border bg-surface p-5 ${tone === "primary" ? "border-primary/20" : "border-border"}`}>
      <Icon className={`mb-3 h-5 w-5 ${iconClass}`} />
      <p className={`text-3xl font-semibold ${tone === "primary" ? "text-primary" : ""}`}>
        {value}
      </p>
      <p className="text-sm text-foreground/50">{label}</p>
      <p className="mt-2 text-xs text-foreground/35">{detail}</p>
    </div>
  );
}
