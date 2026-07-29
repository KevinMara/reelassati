import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Image,
  Loader2,
  RefreshCw,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import type {
  Platform,
  PublishingAccount,
  ScheduledPost,
} from "@contracts/workspace";
import { platformApi, PlatformApiError } from "@/lib/platform-api";
import { useWorkspace } from "@/providers/workspace";

const PLATFORM_META: Record<Platform, { label: string; badge: string }> = {
  tiktok: { label: "TikTok", badge: "bg-black text-white" },
  instagram: {
    label: "Instagram",
    badge: "bg-gradient-to-br from-purple-500 to-pink-500 text-white",
  },
  youtube: { label: "YouTube", badge: "bg-red-600 text-white" },
  twitter: { label: "X / Twitter", badge: "bg-slate-900 text-white" },
  facebook: { label: "Facebook", badge: "bg-blue-600 text-white" },
  linkedin: { label: "LinkedIn", badge: "bg-blue-700 text-white" },
  pinterest: { label: "Pinterest", badge: "bg-red-700 text-white" },
  threads: { label: "Threads", badge: "bg-slate-900 text-white" },
};

function createId(prefix: string) {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomPart}`;
}

function parseHashtags(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map(hashtag => hashtag.trim().replace(/^#+/, ""))
        .filter(Boolean)
    )
  );
}

function describeError(cause: unknown) {
  if (cause instanceof PlatformApiError && cause.missing.length > 0) {
    return `${cause.message} Missing: ${cause.missing.join(", ")}.`;
  }
  return cause instanceof Error
    ? cause.message
    : "The publishing request failed.";
}

export default function PublisherPage() {
  const {
    workspace,
    capabilities,
    updateWorkspace,
    adoptWorkspace,
    refresh,
    saving,
  } = useWorkspace();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [composerPostId, setComposerPostId] = useState(() => createId("post"));
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [mediaAssetId, setMediaAssetId] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [submitting, setSubmitting] = useState<
    "draft" | "schedule" | "publish" | null
  >(null);
  const [reconciling, setReconciling] = useState(false);
  const automaticRefreshStarted = useRef(false);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const connectedAccounts = useMemo(
    () =>
      workspace.accounts.filter(
        account => account.status === "connected" && account.providerId
      ),
    [workspace.accounts]
  );
  const publishableAssets = useMemo(
    () =>
      workspace.assets.filter(
        asset =>
          asset.status === "ready" &&
          (asset.kind === "video" || asset.kind === "image")
      ),
    [workspace.assets]
  );
  const queue = useMemo(
    () =>
      [...workspace.posts].sort((left, right) => {
        const leftDate = left.scheduledAt || left.createdAt;
        const rightDate = right.scheduledAt || right.createdAt;
        return rightDate.localeCompare(leftDate);
      }),
    [workspace.posts]
  );
  const providerQueueKey = useMemo(
    () =>
      workspace.posts
        .filter(
          post =>
            post.providerPostId &&
            post.status !== "draft" &&
            post.status !== "published"
        )
        .map(post => post.providerPostId)
        .sort()
        .join(","),
    [workspace.posts]
  );

  const reconcileStatuses = useCallback(
    async (announce: boolean) => {
      if (!capabilities.publishing || !providerQueueKey) return;
      setReconciling(true);
      try {
        const result = await platformApi.reconcilePublishingStatuses();
        adoptWorkspace(result.workspace);
        if (result.warning) {
          setNotice({ tone: "error", message: result.warning });
        } else if (announce || result.changed > 0) {
          setNotice({
            tone: "success",
            message:
              result.changed > 0
                ? `${result.changed} publication ${
                    result.changed === 1 ? "status" : "statuses"
                  } updated from the provider.`
                : `All ${result.checked} provider ${
                    result.checked === 1 ? "status is" : "statuses are"
                  } current.`,
          });
        }
      } catch (cause) {
        if (announce) {
          setNotice({ tone: "error", message: describeError(cause) });
        }
      } finally {
        setReconciling(false);
      }
    },
    [adoptWorkspace, capabilities.publishing, providerQueueKey]
  );

  useEffect(() => {
    if (automaticRefreshStarted.current || !providerQueueKey) return;
    automaticRefreshStarted.current = true;
    void reconcileStatuses(false);
  }, [providerQueueKey, reconcileStatuses]);

  const toggleAccount = (id: string) => {
    setSelectedAccounts(current =>
      current.includes(id)
        ? current.filter(accountId => accountId !== id)
        : [...current, id]
    );
  };

  const resetComposer = () => {
    setEditingId(null);
    setComposerPostId(createId("post"));
    setCaption("");
    setHashtags("");
    setMediaAssetId("");
    setSelectedAccounts([]);
    setScheduleDate("");
    setScheduleTime("");
  };

  const buildPost = (
    status: ScheduledPost["status"],
    scheduledAt?: string
  ): ScheduledPost => {
    const accounts = selectedAccounts
      .map(id => connectedAccounts.find(account => account.id === id))
      .filter((account): account is PublishingAccount => Boolean(account));
    return {
      id: editingId || composerPostId,
      caption: caption.trim(),
      hashtags: parseHashtags(hashtags),
      mediaAssetId: mediaAssetId || undefined,
      accountIds: accounts.map(account => account.id),
      platforms: Array.from(new Set(accounts.map(account => account.platform))),
      scheduledAt,
      status,
      createdAt:
        workspace.posts.find(post => post.id === editingId)?.createdAt ||
        new Date().toISOString(),
    };
  };

  const persistPost = async (post: ScheduledPost, replacedId = post.id) => {
    const activityLabel =
      post.status === "draft"
        ? "Publication draft saved"
        : post.status === "scheduled"
          ? "Post scheduled"
          : post.status === "published"
            ? "Post published"
            : "Publication status updated";
    await updateWorkspace(current => ({
      ...current,
      posts: [
        ...current.posts.filter(
          item => item.id !== post.id && item.id !== replacedId
        ),
        post,
      ],
      activity: [
        {
          id: createId("event"),
          type: "publish" as const,
          label: activityLabel,
          detail: post.caption.slice(0, 120) || "Untitled publication",
          createdAt: new Date().toISOString(),
        },
        ...current.activity,
      ].slice(0, 100),
    }));
  };

  const saveDraft = async () => {
    if (!caption.trim()) return;
    setSubmitting("draft");
    setNotice(null);
    try {
      await persistPost(buildPost("draft"));
      setNotice({ tone: "success", message: "Draft saved to your workspace." });
      resetComposer();
    } catch (cause) {
      setNotice({ tone: "error", message: describeError(cause) });
    } finally {
      setSubmitting(null);
    }
  };

  const sendPost = async (publishNow: boolean) => {
    if (!caption.trim() || selectedAccounts.length === 0) return;
    if (!capabilities.publishing) {
      setNotice({
        tone: "error",
        message:
          "Publishing is not configured. Connect the server-side Zernio integration first.",
      });
      return;
    }

    let scheduledAt: string | undefined;
    if (!publishNow) {
      if (!scheduleDate || !scheduleTime) return;
      const date = new Date(`${scheduleDate}T${scheduleTime}`);
      if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
        setNotice({
          tone: "error",
          message: "Choose a valid future date and time.",
        });
        return;
      }
      scheduledAt = date.toISOString();
      if (
        mediaAssetId &&
        date.getTime() - Date.now() > 6 * 24 * 60 * 60 * 1000
      ) {
        setNotice({
          tone: "error",
          message:
            "Media posts can be scheduled up to 6 days ahead because the publishing provider uses temporary uploads.",
        });
        return;
      }
    }

    setSubmitting(publishNow ? "publish" : "schedule");
    setNotice(null);
    const draft = buildPost(
      publishNow ? "publishing" : "scheduled",
      scheduledAt
    );
    try {
      const result = await platformApi.publish(draft, publishNow);
      if (result.workspace) {
        adoptWorkspace(result.workspace);
      } else {
        await refresh();
      }
      setNotice({
        tone: result.post.status === "failed" ? "error" : "success",
        message:
          result.warning ||
          (result.post.status === "failed"
            ? "The publishing provider returned a failed delivery state."
            : publishNow
              ? "The provider accepted your publication."
              : result.post.status === "scheduled"
                ? `Scheduled for ${new Date(result.post.scheduledAt || scheduledAt!).toLocaleString()}.`
                : "The provider accepted the schedule request and is still confirming its state."),
      });
      if (result.workspace && result.post.status !== "failed") resetComposer();
    } catch (cause) {
      setNotice({
        tone: "error",
        message: describeError(cause),
      });
    } finally {
      setSubmitting(null);
    }
  };

  const loadDraft = (post: ScheduledPost) => {
    setEditingId(post.id);
    setComposerPostId(post.id);
    setCaption(post.caption);
    setHashtags(post.hashtags.map(tag => `#${tag}`).join(" "));
    setMediaAssetId(post.mediaAssetId || "");
    setSelectedAccounts(post.accountIds);
    if (post.scheduledAt) {
      const local = new Date(post.scheduledAt);
      const offset = local.getTimezoneOffset() * 60_000;
      const localIso = new Date(local.getTime() - offset)
        .toISOString()
        .slice(0, 16);
      setScheduleDate(localIso.slice(0, 10));
      setScheduleTime(localIso.slice(11, 16));
    } else {
      setScheduleDate("");
      setScheduleTime("");
    }
    setNotice(null);
  };

  const deleteDraft = async (id: string) => {
    await updateWorkspace(current => ({
      ...current,
      posts: current.posts.filter(post => post.id !== id),
    }));
    if (editingId === id) resetComposer();
  };

  const busy = Boolean(submitting) || saving;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="mono-eyebrow mb-2 text-primary">Distribution control</p>
        <h1 className="text-3xl font-semibold">Publisher</h1>
        <p className="mt-2 max-w-2xl text-foreground/60">
          Keep drafts, destinations and timing in one persisted queue. Nothing
          is marked published until the provider accepts it.
        </p>
      </div>

      {!capabilities.publishing && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm text-foreground/65">
            Drafting works now. To schedule or publish, configure Zernio and
            connect at least one destination in Social Hub.
          </p>
        </div>
      )}

      {notice && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 flex items-start gap-2 rounded-xl border p-4 text-sm ${
            notice.tone === "success"
              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600"
              : "border-red-500/20 bg-red-500/5 text-red-500"
          }`}
        >
          {notice.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {notice.message}
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-xl border border-border bg-surface p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-medium">
              <Send className="h-4 w-4 text-primary" />
              {editingId ? "Edit draft" : "New publication"}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetComposer}
                className="text-xs text-foreground/45 hover:text-foreground"
              >
                Clear draft
              </button>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Destinations ({selectedAccounts.length})
              </label>
              {connectedAccounts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {connectedAccounts.map(account => {
                    const selected = selectedAccounts.includes(account.id);
                    return (
                      <button
                        type="button"
                        key={account.id}
                        onClick={() => toggleAccount(account.id)}
                        className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                          selected
                            ? PLATFORM_META[account.platform].badge
                            : "border border-border bg-background text-foreground/55 hover:border-primary/45"
                        }`}
                      >
                        {account.accountName}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-background px-4 py-3 text-sm text-foreground/45">
                  No connected accounts. Drafts can still be saved.
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="publisher-caption"
                className="mb-2 block text-sm font-medium"
              >
                Caption
              </label>
              <textarea
                id="publisher-caption"
                value={caption}
                onChange={event => setCaption(event.target.value)}
                placeholder="Write the final caption in your brand voice…"
                rows={6}
                className="w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/30"
              />
              <p className="mt-1 text-right text-xs text-foreground/35">
                {caption.length.toLocaleString()} characters
              </p>
            </div>

            <div>
              <label
                htmlFor="publisher-hashtags"
                className="mb-2 block text-sm font-medium"
              >
                Hashtags
              </label>
              <input
                id="publisher-hashtags"
                value={hashtags}
                onChange={event => setHashtags(event.target.value)}
                placeholder="#productdesign #creatortips"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="mt-1 text-xs text-foreground/35">
                Use only tags relevant to this post; REELassati does not invent
                “optimal” tags without audience evidence.
              </p>
            </div>

            <div>
              <label
                htmlFor="publisher-media"
                className="mb-2 block text-sm font-medium"
              >
                Media
              </label>
              <select
                id="publisher-media"
                value={mediaAssetId}
                onChange={event => setMediaAssetId(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm"
              >
                <option value="">Text-only publication</option>
                {publishableAssets.map(asset => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} · {asset.kind}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-foreground/35">
                Selected media is transferred to the publishing provider only
                when you publish or schedule. Media schedules are limited to 6
                days because provider uploads are temporary.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="publisher-date"
                  className="mb-2 block text-sm font-medium"
                >
                  Date
                </label>
                <input
                  id="publisher-date"
                  type="date"
                  value={scheduleDate}
                  onChange={event => setScheduleDate(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="publisher-time"
                  className="mb-2 block text-sm font-medium"
                >
                  Time
                </label>
                <input
                  id="publisher-time"
                  type="time"
                  value={scheduleTime}
                  onChange={event => setScheduleTime(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm"
                />
              </div>
            </div>
            <p className="-mt-3 text-xs text-foreground/35">
              Entered in your browser timezone; workspace preference:{" "}
              {workspace.profile.timezone}.
            </p>

            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={busy || !caption.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-background disabled:opacity-40"
              >
                {submitting === "draft" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save draft
              </button>
              <button
                type="button"
                onClick={() => void sendPost(false)}
                disabled={
                  busy ||
                  !caption.trim() ||
                  selectedAccounts.length === 0 ||
                  !scheduleDate ||
                  !scheduleTime ||
                  !capabilities.publishing
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
              >
                {submitting === "schedule" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
                Schedule
              </button>
              <button
                type="button"
                onClick={() => void sendPost(true)}
                disabled={
                  busy ||
                  !caption.trim() ||
                  selectedAccounts.length === 0 ||
                  !capabilities.publishing
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-35"
              >
                {submitting === "publish" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Publish now
              </button>
            </div>
          </div>
        </section>

        <aside className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-medium">
              <Clock className="h-4 w-4 text-primary" />
              Workspace queue
            </h2>
            {providerQueueKey && capabilities.publishing && (
              <button
                type="button"
                onClick={() => void reconcileStatuses(true)}
                disabled={reconciling}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground/55 hover:border-primary/40 hover:text-primary disabled:opacity-40"
              >
                <RefreshCw
                  className={`h-3 w-3 ${reconciling ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            )}
          </div>
          {queue.length > 0 ? (
            <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
              {queue.map(post => (
                <article
                  key={post.id}
                  className="rounded-lg border border-border bg-background p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                        post.status === "published"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : post.status === "scheduled"
                            ? "bg-primary/10 text-primary"
                            : post.status === "failed"
                              ? "bg-red-500/10 text-red-500"
                              : "bg-foreground/5 text-foreground/45"
                      }`}
                    >
                      {post.status}
                    </span>
                    {post.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => void deleteDraft(post.id)}
                        className="rounded p-1 text-foreground/30 hover:bg-red-500/10 hover:text-red-500"
                        aria-label="Delete draft"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="line-clamp-3 text-sm font-medium">
                    {post.caption || "Untitled draft"}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-foreground/40">
                    {post.mediaAssetId ? (
                      <Image className="h-3.5 w-3.5" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {post.platforms.length > 0
                        ? post.platforms
                            .map(platform => PLATFORM_META[platform].label)
                            .join(", ")
                        : "No destination"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-foreground/35">
                    {post.scheduledAt
                      ? new Date(post.scheduledAt).toLocaleString()
                      : new Date(post.createdAt).toLocaleDateString()}
                  </p>
                  {post.statusCheckedAt && (
                    <p className="mt-1 text-[10px] text-foreground/30">
                      Provider checked{" "}
                      {new Date(post.statusCheckedAt).toLocaleString()}
                    </p>
                  )}
                  {post.failureReason && (
                    <p className="mt-2 rounded-md bg-red-500/5 px-2 py-1.5 text-[11px] text-red-500">
                      {post.failureReason}
                    </p>
                  )}
                  {post.publishedUrls?.map((publishedUrl, index) => (
                    <a
                      key={publishedUrl}
                      href={publishedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block text-xs font-medium text-primary hover:underline"
                    >
                      Open live post
                      {post.publishedUrls!.length > 1 ? ` ${index + 1}` : ""}
                    </a>
                  ))}
                  {post.status === "draft" && (
                    <button
                      type="button"
                      onClick={() => loadDraft(post)}
                      className="mt-3 text-xs font-medium text-primary hover:underline"
                    >
                      Open in composer
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-foreground/40">
              <Clock className="mx-auto mb-2 h-8 w-8" />
              <p className="text-sm">No drafts or scheduled posts yet.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
