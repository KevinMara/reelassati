import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Unlink,
} from "lucide-react";
import { motion } from "framer-motion";
import type { Platform, PublishingAccount } from "@contracts/workspace";
import { platformApi, PlatformApiError } from "@/lib/platform-api";
import { useWorkspace } from "@/providers/workspace";

const PLATFORM_META: Record<
  Platform,
  { name: string; badge: string; mark: string }
> = {
  tiktok: { name: "TikTok", badge: "bg-black", mark: "TT" },
  instagram: {
    name: "Instagram",
    badge: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400",
    mark: "IG",
  },
  youtube: { name: "YouTube", badge: "bg-red-600", mark: "YT" },
  twitter: { name: "X / Twitter", badge: "bg-slate-900", mark: "X" },
  facebook: { name: "Facebook", badge: "bg-blue-600", mark: "FB" },
  linkedin: { name: "LinkedIn", badge: "bg-blue-700", mark: "IN" },
  pinterest: { name: "Pinterest", badge: "bg-red-700", mark: "P" },
  threads: { name: "Threads", badge: "bg-slate-900", mark: "TH" },
};

const CONNECTABLE_PLATFORMS = Object.keys(PLATFORM_META) as Platform[];

function accountFingerprint(accounts: PublishingAccount[]) {
  return [...accounts]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(({ id, providerId, platform, accountName, handle, status }) => ({
      id,
      providerId,
      platform,
      accountName,
      handle,
      status,
    }));
}

function errorMessage(cause: unknown) {
  if (cause instanceof PlatformApiError && cause.missing.length > 0) {
    return `${cause.message} Missing: ${cause.missing.join(", ")}.`;
  }
  return cause instanceof Error ? cause.message : "The account request failed.";
}

export default function SocialHub() {
  const { workspace, capabilities, updateWorkspace, saving, loading } =
    useWorkspace();
  const [configured, setConfigured] = useState(capabilities.publishing);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const syncAccounts = useCallback(async () => {
    setSyncing(true);
    setError("");
    try {
      const result = await platformApi.publishingAccounts();
      setConfigured(result.configured);
      setLastSyncedAt(new Date().toISOString());

      if (
        JSON.stringify(accountFingerprint(result.accounts)) !==
        JSON.stringify(accountFingerprint(workspace.accounts))
      ) {
        await updateWorkspace(current => ({
          ...current,
          accounts: result.accounts,
        }));
      }
    } catch (cause) {
      setConfigured(false);
      setError(errorMessage(cause));
    } finally {
      setSyncing(false);
    }
  }, [updateWorkspace, workspace.accounts]);

  useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => {
      void syncAccounts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, syncAccounts]);

  const connectedPlatforms = useMemo(
    () =>
      new Set(
        workspace.accounts
          .filter(account => account.status === "connected")
          .map(account => account.platform)
      ),
    [workspace.accounts]
  );

  const handleConnect = async (platform: Platform) => {
    setConnecting(platform);
    setError("");
    try {
      const { authUrl } = await platformApi.connectPublishingAccount(platform);
      window.location.assign(authUrl);
    } catch (cause) {
      setError(errorMessage(cause));
      setConnecting(null);
    }
  };

  const handleDisconnect = async (account: PublishingAccount) => {
    if (!window.confirm(`Disconnect ${account.accountName}?`)) return;
    setDisconnecting(account.id);
    setError("");
    try {
      await platformApi.disconnectPublishingAccount(account.id);
      await updateWorkspace(current => ({
        ...current,
        accounts: current.accounts.filter(item => item.id !== account.id),
      }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mono-eyebrow mb-2 text-primary">Distribution layer</p>
          <h1 className="text-3xl font-semibold">Social Hub</h1>
          <p className="mt-2 max-w-2xl text-foreground/60">
            Link real publishing accounts through Zernio, then use the same
            verified destinations everywhere in your workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void syncAccounts()}
          disabled={syncing || saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/40 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing" : "Sync accounts"}
        </button>
      </div>

      <div
        className={`mb-6 rounded-xl border p-4 ${
          configured
            ? "border-emerald-500/20 bg-emerald-500/5"
            : "border-amber-500/20 bg-amber-500/5"
        }`}
      >
        <div className="flex items-start gap-3">
          {configured ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          )}
          <div>
            <p className="text-sm font-medium">
              {configured
                ? "Publishing connection is ready"
                : "Publishing setup is incomplete"}
            </p>
            <p className="mt-1 text-xs text-foreground/55">
              {configured
                ? "Account data below comes from Zernio. Follower and growth analytics are not invented or estimated here."
                : "A server-side ZERNIO_API_KEY is required before OAuth connections and account sync can work."}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-3xl font-semibold">
            {
              workspace.accounts.filter(
                account => account.status === "connected"
              ).length
            }
          </p>
          <p className="text-sm text-foreground/50">Connected accounts</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-3xl font-semibold">{connectedPlatforms.size}</p>
          <p className="text-sm text-foreground/50">Active platforms</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-sm font-medium">
            {lastSyncedAt
              ? new Date(lastSyncedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Not synced yet"}
          </p>
          <p className="mt-1 text-sm text-foreground/50">Last provider sync</p>
        </div>
      </div>

      {workspace.accounts.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/45">
            Connected destinations
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspace.accounts.map(account => {
              const meta = PLATFORM_META[account.platform];
              return (
                <motion.article
                  key={account.id}
                  whileHover={{ y: -2 }}
                  className="rounded-xl border border-border bg-surface p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white ${meta.badge}`}
                      >
                        {meta.mark}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-medium">
                          {account.accountName}
                        </h3>
                        <p className="truncate text-xs text-foreground/50">
                          {account.handle || meta.name}
                        </p>
                      </div>
                    </div>
                    <CheckCircle2
                      className={`h-5 w-5 shrink-0 ${
                        account.status === "connected"
                          ? "text-emerald-500"
                          : "text-amber-500"
                      }`}
                    />
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                    <span className="text-xs capitalize text-foreground/50">
                      {account.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDisconnect(account)}
                      disabled={disconnecting === account.id}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-foreground/45 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40"
                    >
                      {disconnecting === account.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Unlink className="h-3.5 w-3.5" />
                      )}
                      Disconnect
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/45">
          Add a destination
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CONNECTABLE_PLATFORMS.map(platform => {
            const meta = PLATFORM_META[platform];
            const alreadyConnected = connectedPlatforms.has(platform);
            return (
              <motion.article
                key={platform}
                whileHover={alreadyConnected ? undefined : { y: -2 }}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-[10px] font-bold text-white ${meta.badge}`}
                  >
                    {meta.mark}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{meta.name}</p>
                    <p className="text-xs text-foreground/45">
                      {alreadyConnected ? "Connected" : "OAuth connection"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleConnect(platform)}
                  disabled={
                    !configured || alreadyConnected || connecting === platform
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {connecting === platform ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  {alreadyConnected ? "Already linked" : "Connect"}
                </button>
              </motion.article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
