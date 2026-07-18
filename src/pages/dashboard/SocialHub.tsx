import { useState } from "react";
import { Link2, Unlink, CheckCircle, AlertCircle, TrendingUp, ArrowUpRight, ArrowDownRight, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { trpc } from "@/providers/trpc";

const PLATFORM_META: Record<string, { name: string; color: string; icon: string }> = {
  tiktok: { name: "TikTok", color: "bg-black", icon: "T" },
  instagram: { name: "Instagram", color: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400", icon: "I" },
  youtube: { name: "YouTube", color: "bg-red-600", icon: "Y" },
  x: { name: "X / Twitter", color: "bg-slate-900", icon: "X" },
  facebook: { name: "Facebook", color: "bg-blue-600", icon: "F" },
  linkedin: { name: "LinkedIn", color: "bg-blue-700", icon: "L" },
  pinterest: { name: "Pinterest", color: "bg-red-700", icon: "P" },
  threads: { name: "Threads", color: "bg-slate-900", icon: "Th" },
  reddit: { name: "Reddit", color: "bg-orange-600", icon: "R" },
  bluesky: { name: "Bluesky", color: "bg-sky-500", icon: "B" },
  telegram: { name: "Telegram", color: "bg-sky-600", icon: "Tg" },
  discord: { name: "Discord", color: "bg-indigo-500", icon: "D" },
};

const DEMO_PLATFORMS = [
  { id: "tiktok", name: "TikTok", followers: "45.2K", posts: 156, growth: "+12.5%", connected: true },
  { id: "instagram", name: "Instagram", followers: "31.2K", posts: 203, growth: "+8.3%", connected: true },
  { id: "youtube", name: "YouTube", followers: "18.5K", posts: 89, growth: "-2.1%", connected: true },
];

export default function SocialHub() {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState("");

  // ── Fetch connected accounts from DB ───────────────────────────────────────
  const utils = trpc.useUtils();
  const accountsQuery = trpc.platform.list.useQuery(undefined, {
    retry: false,
  });
  const accounts = accountsQuery.data || [];

  // ── Zernio config check ────────────────────────────────────────────────────
  const configQuery = trpc.platform.config.useQuery(undefined, { retry: false });
  const zernioEnabled = configQuery.data?.enabled ?? false;
  const availablePlatforms = configQuery.data?.platforms || [];

  // ── Mutations ──────────────────────────────────────────────────────────────
  const initiateConnect = trpc.platform.initiateConnect.useMutation({
    onSuccess: (data) => {
      // Redirect to the platform's OAuth page
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
      setConnecting(null);
    },
    onError: (err) => {
      setError(err.message);
      setConnecting(null);
    },
  });

  const disconnect = trpc.platform.disconnect.useMutation({
    onSuccess: () => {
      utils.platform.list.invalidate();
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleConnect = (platform: string) => {
    setError("");
    setConnecting(platform);
    initiateConnect.mutate({ platform: platform as any });
  };

  const handleDisconnect = (id: number) => {
    if (window.confirm("Disconnect this account?")) {
      disconnect.mutate({ id });
    }
  };

  // Build a merged view: connected accounts from DB + available platforms not yet connected
  const connectedIds = new Set(accounts.map((a) => a.platform));
  const unconnectedPlatforms = availablePlatforms
    .filter((p: any) => p.posting && !connectedIds.has(p.id))
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      meta: PLATFORM_META[p.id] || { name: p.name, color: "bg-surface", icon: "?" },
      connected: false,
    }));

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="mono-eyebrow text-primary mb-2">Social Hub</p>
        <h1 className="text-3xl font-semibold">Connected Accounts</h1>
        <p className="text-foreground/60 mt-2">
          Connect your social media accounts to publish content across 12+ platforms
        </p>
      </div>

      {/* Zernio Status */}
      <div className={`mb-6 p-4 rounded-xl border ${zernioEnabled ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${zernioEnabled ? "bg-emerald-500" : "bg-amber-500"}`} />
          <p className="text-sm">
            {zernioEnabled ? (
              <span className="text-emerald-500 font-medium">Zernio API connected</span>
            ) : (
              <span className="text-amber-500">
                Zernio API key not configured — add <code className="text-xs bg-amber-500/10 px-1.5 py-0.5 rounded">ZERNIO_API_KEY</code> to your .env to enable publishing
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-3xl font-semibold">{accounts.length}</p>
          <p className="text-sm text-foreground/50">Connected accounts</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-3xl font-semibold">
            {accounts.reduce((a, acc) => a + (acc.followers || 0), 0).toLocaleString()}
          </p>
          <p className="text-sm text-foreground/50">Total followers</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-3xl font-semibold text-emerald-500 flex items-center gap-1">
            +8.4% <TrendingUp className="h-5 w-5" />
          </p>
          <p className="text-sm text-foreground/50">Avg. monthly growth</p>
        </div>
      </div>

      {/* Connected Accounts */}
      {accounts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-foreground/50 mb-4 uppercase tracking-wider">Connected</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => {
              const meta = PLATFORM_META[account.platform] || { name: account.platform, color: "bg-surface", icon: "?" };
              return (
                <motion.div
                  key={account.id}
                  whileHover={{ y: -2 }}
                  className="bg-surface border border-border rounded-xl p-5"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg ${meta.color} flex items-center justify-center text-white font-bold text-xs`}>
                        {meta.icon}
                      </div>
                      <div>
                        <h3 className="font-medium">{meta.name}</h3>
                        <p className="text-xs text-foreground/50">{account.accountHandle || account.accountName}</p>
                      </div>
                    </div>
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground/60">Followers</span>
                      <span className="font-medium">{(account.followers || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground/60">Status</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
                        {account.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button className="flex-1 py-2 text-xs border border-border rounded-lg hover:bg-background transition-colors flex items-center justify-center gap-1">
                      <ExternalLink className="h-3 w-3" /> View Profile
                    </button>
                    <button
                      onClick={() => handleDisconnect(account.id)}
                      className="p-2 border border-border rounded-lg hover:bg-red-500/5 hover:border-red-500/30 transition-colors"
                      title="Disconnect"
                    >
                      <Unlink className="h-3.5 w-3.5 text-foreground/40" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Platforms (Not Connected) */}
      {unconnectedPlatforms.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-foreground/50 mb-4 uppercase tracking-wider">Available Platforms</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unconnectedPlatforms.map((platform) => (
              <motion.div
                key={platform.id}
                whileHover={{ y: -2 }}
                className="bg-surface border border-dashed border-border/50 rounded-xl p-5 opacity-80 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg ${platform.meta.color} flex items-center justify-center text-white font-bold text-xs`}>
                      {platform.meta.icon}
                    </div>
                    <div>
                      <h3 className="font-medium">{platform.name}</h3>
                      <p className="text-xs text-foreground/50">Not connected</p>
                    </div>
                  </div>
                  <AlertCircle className="h-5 w-5 text-foreground/20" />
                </div>

                <p className="text-sm text-foreground/50 mb-4">
                  Connect your {platform.name} account to publish content
                </p>

                <button
                  onClick={() => handleConnect(platform.id)}
                  disabled={!zernioEnabled || connecting === platform.id}
                  className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {connecting === platform.id ? (
                    <>
                      <span className="animate-spin h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full" />
                      Redirecting...
                    </>
                  ) : (
                    <><Link2 className="h-3.5 w-3.5" /> Connect {platform.name}</>
                  )}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Demo fallback: show placeholder platforms if Zernio not configured */}
      {!zernioEnabled && accounts.length === 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-foreground/50 mb-4 uppercase tracking-wider">Supported Platforms (Preview Mode)</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEMO_PLATFORMS.map((platform) => (
              <motion.div
                key={platform.id}
                whileHover={{ y: -2 }}
                className="bg-surface border border-dashed border-border/50 rounded-xl p-5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg ${PLATFORM_META[platform.id]?.color || "bg-surface"} flex items-center justify-center text-white font-bold text-xs`}>
                      {PLATFORM_META[platform.id]?.icon || "?"}
                    </div>
                    <div>
                      <h3 className="font-medium">{platform.name}</h3>
                      <p className="text-xs text-foreground/50">{platform.followers} followers</p>
                    </div>
                  </div>
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="space-y-2 opacity-60">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground/60">Posts</span>
                    <span className="font-medium">{platform.posts}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground/60">Growth</span>
                    <span className={`font-medium flex items-center gap-0.5 ${platform.growth.startsWith("+") ? "text-emerald-500" : "text-red-500"}`}>
                      {platform.growth.startsWith("+") ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {platform.growth}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-6 p-4 rounded-xl border border-border bg-surface text-center">
            <p className="text-sm text-foreground/50">
              Add your <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">ZERNIO_API_KEY</code> to enable real connections across 12+ platforms
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
