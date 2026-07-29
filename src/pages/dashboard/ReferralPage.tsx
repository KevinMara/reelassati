import { useMemo } from "react";
import {
  Coins,
  Gift,
  Info,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useWorkspace } from "@/providers/workspace";

const RETAIL_VALUE_PER_CREDIT = 0.01;

function stableReferralCode(email: string) {
  let hash = 0x811c9dc5;
  for (const character of email.trim().toLowerCase()) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return `REEL-${(hash >>> 0).toString(36).toUpperCase().padStart(7, "0")}`;
}

export default function ReferralPage() {
  const { workspace } = useWorkspace();
  const referralCode = useMemo(
    () => stableReferralCode(workspace.profile.email),
    [workspace.profile.email],
  );
  const retailEquivalent = (
    workspace.profile.credits * RETAIL_VALUE_PER_CREDIT
  ).toFixed(2);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <p className="mono-eyebrow mb-2 text-primary">Creator network</p>
        <h1 className="text-3xl font-semibold">Referral program readiness</h1>
        <p className="mt-2 max-w-2xl text-foreground/60">
          Your creator code is reserved. Invites stay locked until public
          accounts, qualification tracking, and credit billing are connected.
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <Users className="mb-3 h-5 w-5 text-primary" />
          <p className="text-3xl font-semibold">0</p>
          <p className="text-sm text-foreground/50">Tracked referrals</p>
          <p className="mt-2 text-xs text-foreground/35">
            No referral records are stored yet.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <Coins className="mb-3 h-5 w-5 text-emerald-500" />
          <p className="text-3xl font-semibold">
            {workspace.profile.credits.toLocaleString()}
          </p>
          <p className="text-sm text-foreground/50">Current credit balance</p>
          <p className="mt-2 text-xs text-foreground/35">
            Persisted in your workspace profile.
          </p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <Gift className="mb-3 h-5 w-5 text-primary" />
          <p className="text-3xl font-semibold text-primary">
            ${retailEquivalent}
          </p>
          <p className="text-sm text-foreground/50">
            Retail-equivalent product value
          </p>
          <p className="mt-2 text-xs text-foreground/35">
            Not cash and not redeemable for money.
          </p>
        </div>
      </div>

      <section className="mb-8 rounded-xl border border-primary/20 bg-surface p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <LockKeyhole className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Reserved creator code</h2>
            <p className="text-xs text-foreground/45">
              Derived from your account identity; not an active invite yet.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={referralCode}
            onFocus={(event) => event.currentTarget.select()}
            aria-label="Reserved referral code"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-4 py-3 font-mono text-xs"
          />
          <button
            type="button"
            disabled
            className="inline-flex shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-foreground/10 px-5 py-3 text-sm font-medium text-foreground/45"
          >
            <LockKeyhole className="h-4 w-4" />
            Invites locked
          </button>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-foreground/45">
          No shareable URL or reward promise is issued in this private build.
          That prevents untracked signups and balances the product cannot yet
          verify.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            1
          </div>
          <h3 className="text-sm font-medium">Connect public accounts</h3>
          <p className="mt-2 text-xs leading-relaxed text-foreground/45">
            Invitees need their own verified identity before attribution can be
            trusted.
          </p>
        </article>
        <article className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 text-sm font-semibold text-blue-500">
            2
          </div>
          <h3 className="text-sm font-medium">Define qualification</h3>
          <p className="mt-2 text-xs leading-relaxed text-foreground/45">
            A billing-backed event must reject self-referrals, duplicates, and
            reversals.
          </p>
        </article>
        <article className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-semibold text-emerald-500">
            3
          </div>
          <h3 className="text-sm font-medium">Activate verified credits</h3>
          <p className="mt-2 text-xs leading-relaxed text-foreground/45">
            Only then should product credits enter the persisted balance and
            become spendable.
          </p>
        </article>
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <div>
          <p className="text-sm font-medium">Clear reward terms</p>
          <p className="mt-1 text-xs leading-relaxed text-foreground/45">
            The current ${retailEquivalent} figure is a retail-equivalent display
            of the existing workspace balance only. Credits have no cash value,
            cannot be withdrawn, and are not financial earnings.
          </p>
        </div>
        <Info className="ml-auto h-4 w-4 shrink-0 text-foreground/25" />
      </div>
    </div>
  );
}
