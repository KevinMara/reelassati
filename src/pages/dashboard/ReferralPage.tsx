import { useState, useEffect } from "react";
import { Gift, Copy, CheckCircle, Users, DollarSign, CreditCard, TrendingUp } from "lucide-react";
import { trpc } from "@/providers/trpc";

const CREDIT_VALUE = 0.01; // 1 credit = $0.01
const REFERRAL_REWARD = 500; // 500 credits per referral

export default function ReferralPage() {
  const [copied, setCopied] = useState(false);

  const codeQuery = trpc.referral.myCode.useQuery(undefined, { retry: false });
  const statsQuery = trpc.referral.stats.useQuery(undefined, { retry: false });

  const code = codeQuery.data?.code || "";
  const stats = statsQuery.data;

  const referralLink = typeof window !== "undefined"
    ? `${window.location.origin}/auth/signup?ref=${code}`
    : `https://reelassati.vercel.app/auth/signup?ref=${code}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dollarValue = stats?.creditsEarned ? (stats.creditsEarned * CREDIT_VALUE).toFixed(2) : "0.00";
  const potentialValue = ((stats?.totalReferrals || 0) * REFERRAL_REWARD * CREDIT_VALUE).toFixed(2);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="mono-eyebrow text-primary mb-2">Refer & Earn</p>
        <h1 className="text-3xl font-semibold">Invite Friends, Earn Credits</h1>
        <p className="text-foreground/60 mt-2">Share REELassati with creators you know. Both of you get 500 free credits.</p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-xl p-5 text-center">
          <p className="text-3xl font-semibold">{stats?.totalReferrals || 0}</p>
          <p className="text-xs text-foreground/50 mt-1">Total Invites</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5 text-center">
          <p className="text-3xl font-semibold text-emerald-500">{stats?.completedReferrals || 0}</p>
          <p className="text-xs text-foreground/50 mt-1">Completed</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5 text-center">
          <div className="flex items-center justify-center gap-1">
            <CreditCard className="h-5 w-5 text-primary" />
            <p className="text-3xl font-semibold text-primary">{stats?.creditsEarned || 0}</p>
          </div>
          <p className="text-xs text-foreground/50 mt-1">Credits Earned</p>
        </div>
        <div className="bg-surface border border-primary/20 rounded-xl p-5 text-center bg-primary/5">
          <div className="flex items-center justify-center gap-1">
            <DollarSign className="h-5 w-5 text-primary" />
            <p className="text-3xl font-semibold text-primary">{dollarValue}</p>
          </div>
          <p className="text-xs text-foreground/50 mt-1">Value Earned</p>
        </div>
      </div>

      {/* Referral Link */}
      <div className="bg-surface border border-primary/20 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="h-5 w-5 text-primary" />
          <h3 className="font-medium">Your Referral Link</h3>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 px-4 py-3 rounded-lg bg-background border border-border text-sm font-mono truncate">
            {referralLink}
          </div>
          <button
            onClick={copyLink}
            className="px-4 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center gap-2 shrink-0"
          >
            {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy Link"}
          </button>
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-foreground/40">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> You get {REFERRAL_REWARD} credits</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> They get {REFERRAL_REWARD} credits</span>
          <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> = ${(REFERRAL_REWARD * CREDIT_VALUE).toFixed(2)} value each</span>
        </div>
      </div>

      {/* How It Works */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-xl border border-border bg-surface text-center">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Copy className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium mb-1">Share Your Link</p>
          <p className="text-xs text-foreground/40">Copy and send to fellow creators</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-surface text-center">
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <Users className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-sm font-medium mb-1">They Sign Up</p>
          <p className="text-xs text-foreground/40">Friend creates a REELassati account</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-surface text-center">
          <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
            <CreditCard className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-sm font-medium mb-1">Both Get Credits</p>
          <p className="text-xs text-foreground/40">{REFERRAL_REWARD} credits each = ${(REFERRAL_REWARD * CREDIT_VALUE).toFixed(2)}</p>
        </div>
      </div>

      {/* Earning Potential */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Earning Potential
        </h3>
        <div className="space-y-3">
          {[1, 5, 10, 25, 50].map((num) => (
            <div key={num} className="flex items-center justify-between p-3 rounded-lg bg-background">
              <span className="text-sm">{num} referral{num > 1 ? "s" : ""}</span>
              <span className="text-sm font-medium text-primary">
                {num * REFERRAL_REWARD} credits = ${(num * REFERRAL_REWARD * CREDIT_VALUE).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
