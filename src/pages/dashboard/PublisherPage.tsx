import { useUiText } from "@/lib/i18n/ui";
import { StudioSelect } from "@/components/ui/studio-select";
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
  Sparkles,
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
import {
  extractTextProvenanceToken,
  withoutTextProvenanceMarker,
  type DisclosureLanguage,
  type PublicationComplianceReview,
} from "@contracts/compliance";
import { Link, useSearchParams } from "react-router-dom";
import posthog from "@/lib/posthog";
import {
  automaticPublicationReview,
  publicationSchedule,
} from "@contracts/publication-options";
import { AI_CREDIT_COSTS } from "@contracts/billing";
import { selectedBrand } from "@/lib/workspace-scope";

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
  const [query] = useSearchParams();
  const { workspace } = useWorkspace();
  return (
    <PublisherComposer
      key={`${workspace.profile.email}:${selectedBrand(workspace.profile.email)}:${query.get("draft") || query.get("asset") || "new"}`}
    />
  );
}

function PublisherComposer() {
  const ui = useUiText();
  const {
    workspace,
    capabilities,
    updateWorkspace,
    adoptWorkspace,
    refresh,
    saving,
  } = useWorkspace();
  const [searchParams] = useSearchParams();
  const initialDraft = workspace.posts.find(
    p =>
      p.id === searchParams.get("draft") &&
      (p.status === "draft" || p.status === "failed")
  );
  const initialSchedule = initialDraft?.scheduledAt
    ? new Date(initialDraft.scheduledAt)
    : null;
  const initialLocal =
    initialSchedule && Number.isFinite(initialSchedule.getTime())
      ? new Date(
          initialSchedule.getTime() -
            initialSchedule.getTimezoneOffset() * 60000
        )
          .toISOString()
          .slice(0, 16)
      : "";
  const [editingId, setEditingId] = useState<string | null>(
    initialDraft?.id || null
  );
  const [composerPostId, setComposerPostId] = useState(
    () => initialDraft?.id || createId("post")
  );
  const [caption, setCaption] = useState(initialDraft?.caption || "");
  const [hashtags, setHashtags] = useState(
    initialDraft?.hashtags.map(tag => `#${tag}`).join(" ") || ""
  );
  const [mediaAssetId, setMediaAssetId] = useState(
    searchParams.get("asset") || initialDraft?.mediaAssetId || ""
  );
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    initialDraft?.accountIds || []
  );
  const [targetPlatform, setTargetPlatform] = useState<Platform>(
    initialDraft?.platforms[0] || "tiktok"
  );
  const [scheduleDate, setScheduleDate] = useState(initialLocal.slice(0, 10));
  const [scheduleTime, setScheduleTime] = useState(initialLocal.slice(11, 16));
  const [disclosureLanguage, setDisclosureLanguage] =
    useState<DisclosureLanguage>("en");
  const [includeAiLabel, setIncludeAiLabel] = useState(false);
  const [aiTextUsed, setAiTextUsed] = useState(
    Boolean(initialDraft?.complianceReview?.containsAiGeneratedText)
  );
  const [brief, setBrief] = useState("");
  const [aiFields, setAiFields] = useState({ caption: true, hashtags: false });
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const generationController = useRef<AbortController | null>(null);
  const compositionRevision = useRef(0);
  const submissionTimestamp = useRef<string | null>(null);
  useEffect(
    () => () => {
      generationController.current?.abort();
    },
    []
  );
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
  const selectedAsset = useMemo(
    () => publishableAssets.find(asset => asset.id === mediaAssetId),
    [mediaAssetId, publishableAssets]
  );
  const selectedAssetHasVerifiedAiOrigin = Boolean(
    selectedAsset?.provenance?.marking.status === "verified" &&
    ["ai-assisted", "ai-generated", "ai-manipulated"].includes(
      selectedAsset.provenance.origin
    )
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
                  } updated from the delivery service.`
                : `All ${result.checked} delivery ${
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

  const invalidateReleaseReview = () => {
    compositionRevision.current += 1;
    generationController.current?.abort();
    submissionTimestamp.current = null;
  };

  const toggleAccount = (id: string) => {
    setSelectedAccounts(current =>
      current.includes(id)
        ? current.filter(accountId => accountId !== id)
        : [...current, id]
    );
    invalidateReleaseReview();
  };

  const resetComposer = () => {
    setEditingId(null);
    setComposerPostId(createId("post"));
    setCaption("");
    setHashtags("");
    setMediaAssetId("");
    setSelectedAccounts([]);
    setTargetPlatform("tiktok");
    setScheduleDate("");
    setScheduleTime("");
    setDisclosureLanguage("en");
    setIncludeAiLabel(false);
    setAiTextUsed(false);
    setBrief("");
    invalidateReleaseReview();
  };

  const buildComplianceReview = (): PublicationComplianceReview => {
    submissionTimestamp.current ||= new Date().toISOString();
    return automaticPublicationReview({
      language: disclosureLanguage,
      aiText: aiTextUsed || Boolean(extractTextProvenanceToken(caption)),
      aiMedia: selectedAssetHasVerifiedAiOrigin,
      hasMedia: Boolean(mediaAssetId),
      includeLabel: includeAiLabel,
      submittedAt: submissionTimestamp.current,
    });
  };

  const generateCopy = async () => {
    if (
      generatingCopy ||
      !brief.trim() ||
      (!aiFields.caption && !aiFields.hashtags)
    )
      return;
    const controller = new AbortController();
    generationController.current?.abort();
    generationController.current = controller;
    const revision = compositionRevision.current;
    setGeneratingCopy(true);
    setNotice(null);
    try {
      const result = await platformApi.generatePublicationCopy(
        {
          brief,
          caption: withoutTextProvenanceMarker(caption),
          hashtags: parseHashtags(hashtags),
          platforms: [targetPlatform],
          language: disclosureLanguage,
          fields: Object.entries(aiFields)
            .filter(([, enabled]) => enabled)
            .map(([field]) => field as "caption" | "hashtags"),
        },
        { signal: controller.signal }
      );
      if (controller.signal.aborted || compositionRevision.current !== revision)
        return;
      setCaption(result.caption);
      setHashtags(result.hashtags.map(tag => "#" + tag).join(" "));
      setAiTextUsed(true);
      submissionTimestamp.current = null;
      setNotice({
        tone: "success",
        message:
          "Copy ready. Review or edit it in the preview before publishing.",
      });
      await refresh();
    } catch (cause) {
      if (!controller.signal.aborted)
        setNotice({ tone: "error", message: describeError(cause) });
    } finally {
      if (generationController.current === controller) setGeneratingCopy(false);
    }
  };

  const buildPost = (
    status: ScheduledPost["status"],
    scheduledAt?: string,
    complianceReview?: PublicationComplianceReview
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
      platforms: accounts.length
        ? Array.from(new Set(accounts.map(account => account.platform)))
        : [targetPlatform],
      scheduledAt,
      status,
      createdAt:
        workspace.posts.find(post => post.id === editingId)?.createdAt ||
        new Date().toISOString(),
      ...(complianceReview ? { complianceReview } : {}),
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
      await persistPost(buildPost("draft", undefined, buildComplianceReview()));
      posthog?.capture("publication_draft_saved", {
        has_media: Boolean(mediaAssetId),
        destination_count: selectedAccounts.length,
      });
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
    if (!capabilities.publishing || !capabilities.publicationComposer) {
      setNotice({
        tone: "error",
        message:
          "Publishing is temporarily unavailable. Try again after the managed connection is ready.",
      });
      return;
    }
    let scheduledAt: string | undefined;
    try {
      scheduledAt = publishNow
        ? undefined
        : publicationSchedule(
            scheduleDate,
            scheduleTime,
            Boolean(mediaAssetId)
          );
    } catch (cause) {
      setNotice({ tone: "error", message: describeError(cause) });
      return;
    }

    setSubmitting(publishNow ? "publish" : "schedule");
    setNotice(null);
    const draft = buildPost(
      publishNow ? "publishing" : "scheduled",
      scheduledAt,
      buildComplianceReview()
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
            ? "The publishing service returned a failed delivery state."
            : publishNow
              ? "The publishing service accepted your publication."
              : result.post.status === "scheduled"
                ? `Scheduled for ${new Date(result.post.scheduledAt || scheduledAt!).toLocaleString()}.`
                : "The publishing service accepted the schedule request and is still confirming its state."),
      });
      if (result.post.status !== "failed") {
        posthog?.capture("publication_submitted", {
          submission_type: publishNow ? "publish_now" : "schedule",
          destination_count: selectedAccounts.length,
          platform_count: new Set(result.post.platforms).size,
          has_media: Boolean(mediaAssetId),
        });
      }
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
    setTargetPlatform(post.platforms[0] || "tiktok");
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
    setDisclosureLanguage(
      post.complianceReview?.disclosureLanguage === "it" ? "it" : "en"
    );
    setIncludeAiLabel(
      post.complianceReview?.visibleDisclosure.required === true
    );
    setAiTextUsed(post.complianceReview?.containsAiGeneratedText === true);
    invalidateReleaseReview();
    setNotice(null);
  };

  const deleteDraft = async (id: string) => {
    const draft = workspace.posts.find(post => post.id === id);
    if (
      !draft ||
      !window.confirm(
        `Delete this draft?\n\n${draft.caption.slice(0, 120) || "Untitled publication"}`
      )
    ) {
      return;
    }
    setNotice(null);
    try {
      await updateWorkspace(current => ({
        ...current,
        posts: current.posts.filter(post => post.id !== id),
      }));
      if (editingId === id) resetComposer();
      setNotice({ tone: "success", message: "Draft deleted." });
    } catch (cause) {
      setNotice({
        tone: "error",
        message:
          cause instanceof Error
            ? cause.message
            : "The draft could not be deleted.",
      });
    }
  };

  const busy = Boolean(submitting) || saving || generatingCopy;
  const disclosurePreview = automaticPublicationReview({
    language: disclosureLanguage,
    aiText: aiTextUsed || Boolean(extractTextProvenanceToken(caption)),
    aiMedia: selectedAssetHasVerifiedAiOrigin,
    hasMedia: Boolean(mediaAssetId),
    includeLabel: includeAiLabel,
    submittedAt: "",
  }).visibleDisclosure.text;
  const hashtagPreview = parseHashtags(hashtags)
    .map(tag => `#${tag}`)
    .join(" ");
  const outgoingVisiblePreview = [
    disclosurePreview,
    withoutTextProvenanceMarker(caption).trim(),
    hashtagPreview,
  ]
    .filter(Boolean)
    .join("\n\n");
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="mono-eyebrow mb-2 text-primary">
          {ui("Distribution control")}
        </p>
        <h1 className="text-3xl font-semibold">{ui("Publisher")}</h1>
        <p className="mt-2 max-w-2xl text-foreground/60">
          {ui(
            "Prepare your next post. Choose its destinations, shape the copy, and set the timing."
          )}
        </p>
      </div>

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
              {editingId ? ui("Edit draft") : ui("New publication")}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetComposer}
                className="text-xs text-foreground/70 hover:text-foreground"
              >
                {ui("Clear draft")}
              </button>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <label
                htmlFor="publisher-platform"
                className="mb-2 block text-sm font-medium"
              >
                {ui("Platform")}
              </label>
              <StudioSelect
                className="w-full"
                id="publisher-platform"
                value={targetPlatform}
                onChange={event => {
                  setTargetPlatform(event.target.value as Platform);
                  setSelectedAccounts([]);
                  invalidateReleaseReview();
                }}
              >
                {Object.entries(PLATFORM_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </StudioSelect>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">
                {ui("Destinations (")}
                {selectedAccounts.length})
              </label>
              {connectedAccounts.some(
                account => account.platform === targetPlatform
              ) ? (
                <div className="flex flex-wrap gap-2">
                  {connectedAccounts
                    .filter(account => account.platform === targetPlatform)
                    .map(account => {
                      const selected = selectedAccounts.includes(account.id);
                      return (
                        <button
                          type="button"
                          key={account.id}
                          aria-pressed={selected}
                          onClick={() => toggleAccount(account.id)}
                          className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                            selected
                              ? PLATFORM_META[account.platform].badge
                              : "border border-border bg-background text-foreground/70 hover:border-primary/45"
                          }`}
                        >
                          {account.accountName}
                        </button>
                      );
                    })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-background px-4 py-3 text-sm text-foreground/70">
                  <Link
                    to="/dashboard/social"
                    className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                  >
                    {ui("Connect a publishing account →")}
                  </Link>
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="publisher-caption"
                className="mb-2 block text-sm font-medium"
              >
                {ui("Caption")}
              </label>
              <textarea
                id="publisher-caption"
                value={withoutTextProvenanceMarker(caption)}
                onChange={event => {
                  setCaption(event.target.value);
                  invalidateReleaseReview();
                }}
                placeholder={ui("Write the final caption in your brand voice…")}
                rows={6}
                className="w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/30"
              />
              <p className="mt-1 text-right text-xs text-foreground/70">
                {withoutTextProvenanceMarker(caption).length.toLocaleString()}{" "}
                {ui("characters")}
              </p>
            </div>

            <div>
              <label
                htmlFor="publisher-hashtags"
                className="mb-2 block text-sm font-medium"
              >
                {ui("Hashtags")}
              </label>
              <input
                id="publisher-hashtags"
                value={hashtags}
                onChange={event => {
                  setHashtags(event.target.value);
                  invalidateReleaseReview();
                }}
                placeholder="#productdesign #creatortips"
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label
                htmlFor="publisher-media"
                className="mb-2 block text-sm font-medium"
              >
                {ui("Media")}
              </label>
              <StudioSelect
                id="publisher-media"
                value={mediaAssetId}
                onChange={event => {
                  const nextId = event.target.value;
                  setMediaAssetId(nextId);
                  invalidateReleaseReview();
                }}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm"
              >
                <option value="">{ui("Text-only publication")}</option>
                {publishableAssets.map(asset => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} · {asset.kind}
                    {asset.provenance ? ` · ${asset.provenance.origin}` : ""}
                  </option>
                ))}
              </StudioSelect>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="publisher-language"
                  className="mb-2 block text-sm font-medium"
                >
                  {ui("Audience language")}
                </label>
                <StudioSelect
                  className="w-full"
                  id="publisher-language"
                  value={disclosureLanguage}
                  onChange={e => {
                    setDisclosureLanguage(e.target.value as DisclosureLanguage);
                    invalidateReleaseReview();
                  }}
                >
                  <option value="en">{ui("English")}</option>
                  <option value="it">{ui("Italian")}</option>
                </StudioSelect>
              </div>
              <div>
                <label
                  htmlFor="publisher-ai-label"
                  className="mb-2 block text-sm font-medium"
                >
                  {ui("AI content label")}
                </label>
                <StudioSelect
                  className="w-full"
                  id="publisher-ai-label"
                  value={includeAiLabel ? "include" : "auto"}
                  onChange={e => {
                    setIncludeAiLabel(e.target.value === "include");
                    invalidateReleaseReview();
                  }}
                >
                  <option value="auto">
                    {ui("Automatic · from content origin")}
                  </option>
                  <option value="include">
                    {ui("Include AI assistance label")}
                  </option>
                </StudioSelect>
              </div>
            </div>

            <details className="group rounded-xl border border-border bg-background p-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />{" "}
                {ui("Write with AI")}{" "}
                <span className="ml-auto text-xs text-foreground/60">
                  {ui("Optional")}
                </span>
              </summary>
              <div className="mt-4 space-y-3">
                <label
                  htmlFor="publisher-brief"
                  className="block text-xs font-medium"
                >
                  {ui("What is this post about?")}
                </label>
                <textarea
                  id="publisher-brief"
                  value={brief}
                  onChange={e => {
                    setBrief(e.target.value);
                    invalidateReleaseReview();
                  }}
                  rows={3}
                  placeholder={ui(
                    "Topic, audience, key points, and the action you want viewers to take…"
                  )}
                  className="w-full rounded-lg border border-border bg-surface p-3 text-sm"
                />
                <div className="flex flex-wrap gap-4">
                  {(["caption", "hashtags"] as const).map(field => (
                    <label
                      key={field}
                      className="flex items-center gap-2 text-sm capitalize"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={aiFields[field]}
                        onChange={e => {
                          setAiFields(current => ({
                            ...current,
                            [field]: e.target.checked,
                          }));
                          invalidateReleaseReview();
                        }}
                      />
                      {field}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void generateCopy()}
                  disabled={
                    busy ||
                    !capabilities.ai ||
                    !capabilities.publicationComposer ||
                    !brief.trim() ||
                    (!aiFields.caption && !aiFields.hashtags)
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:opacity-40"
                >
                  {generatingCopy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {ui("Generate selected copy ·")} {AI_CREDIT_COSTS.script}{" "}
                  {ui("credits")}
                </button>
              </div>
            </details>

            <section
              aria-label={ui("Post preview")}
              className="rounded-xl border border-border bg-background p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium">{ui("Post preview")}</h3>
                <span className="text-xs text-foreground/60">
                  {disclosureLanguage === "it" ? ui("Italian") : ui("English")}
                </span>
              </div>
              {selectedAsset ? (
                <div className="mb-3 overflow-hidden rounded-lg bg-surface">
                  {selectedAsset.kind === "video" ? (
                    <video
                      src={selectedAsset.url}
                      controls
                      preload="metadata"
                      className="max-h-72 w-full object-contain"
                    />
                  ) : (
                    <img
                      src={selectedAsset.url}
                      alt={selectedAsset.name}
                      className="max-h-72 w-full object-contain"
                    />
                  )}
                </div>
              ) : null}
              <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                {outgoingVisiblePreview || "Your caption will appear here."}
              </p>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="publisher-date"
                  className="mb-2 block text-sm font-medium"
                >
                  {ui("Date")}
                </label>
                <input
                  id="publisher-date"
                  type="date"
                  value={scheduleDate}
                  onChange={event => {
                    setScheduleDate(event.target.value);
                    invalidateReleaseReview();
                  }}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="publisher-time"
                  className="mb-2 block text-sm font-medium"
                >
                  {ui("Time")}
                </label>
                <input
                  id="publisher-time"
                  type="time"
                  value={scheduleTime}
                  onChange={event => {
                    setScheduleTime(event.target.value);
                    invalidateReleaseReview();
                  }}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm"
                />
              </div>
            </div>
            <p className="-mt-3 text-xs text-foreground/70">
              {ui("Entered in your browser timezone; workspace preference:")}{" "}
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
                {ui("Save draft")}
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
                  !capabilities.publishing ||
                  !capabilities.publicationComposer
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
              >
                {submitting === "schedule" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
                {ui("Schedule")}
              </button>
              <button
                type="button"
                onClick={() => void sendPost(true)}
                disabled={
                  busy ||
                  !caption.trim() ||
                  selectedAccounts.length === 0 ||
                  !capabilities.publishing ||
                  !capabilities.publicationComposer
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-35"
              >
                {submitting === "publish" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {ui("Publish now")}
              </button>
            </div>
          </div>
        </section>

        <aside className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-medium">
              <Clock className="h-4 w-4 text-primary" />
              {ui("Workspace queue")}
            </h2>
            {providerQueueKey && capabilities.publishing && (
              <button
                type="button"
                onClick={() => void reconcileStatuses(true)}
                disabled={reconciling}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground/70 hover:border-primary/40 hover:text-primary disabled:opacity-40"
              >
                <RefreshCw
                  className={`h-3 w-3 ${reconciling ? "animate-spin" : ""}`}
                />
                {ui("Refresh")}
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
                      className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${
                        post.status === "published"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : post.status === "scheduled"
                            ? "bg-primary/10 text-primary"
                            : post.status === "failed"
                              ? "bg-red-500/10 text-red-500"
                              : "bg-foreground/5 text-foreground/70"
                      }`}
                    >
                      {post.status}
                    </span>
                    {post.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => void deleteDraft(post.id)}
                        className="rounded p-1 text-foreground/70 hover:bg-red-500/10 hover:text-red-500"
                        aria-label={ui("Delete draft")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {post.outgoingContent ? (
                    <div>
                      <p className="mb-1 font-mono text-xs uppercase tracking-wide text-foreground/70">
                        {ui("Final delivery content")}
                      </p>
                      <p className="line-clamp-4 whitespace-pre-line text-sm font-medium">
                        {withoutTextProvenanceMarker(post.outgoingContent)}
                      </p>
                    </div>
                  ) : (
                    <p className="line-clamp-3 text-sm font-medium">
                      {post.caption || "Untitled draft"}
                    </p>
                  )}
                  {post.complianceReview ? (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-medium uppercase tracking-wide">
                      <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-600">
                        {ui("Origin label prepared")}
                      </span>
                      <span className="rounded-full bg-foreground/5 px-2 py-1 text-foreground/70">
                        {post.complianceReview.disclosureLanguage === "it"
                          ? ui("Italian disclosure")
                          : post.complianceReview.disclosureLanguage === "en"
                            ? ui("English disclosure")
                            : ui("Disclosure language not recorded")}
                      </span>
                      {post.complianceReview.visibleDisclosure.required ? (
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                          {ui("Visible cue included")}
                        </span>
                      ) : null}
                      {post.outgoingContent &&
                      extractTextProvenanceToken(post.outgoingContent) ? (
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                          {ui("Machine provenance included")}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-3 flex items-center gap-2 text-xs text-foreground/70">
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
                        : ui("No destination")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-foreground/70">
                    {post.scheduledAt
                      ? new Date(post.scheduledAt).toLocaleString()
                      : new Date(post.createdAt).toLocaleDateString()}
                  </p>
                  {post.statusCheckedAt && (
                    <p className="mt-1 text-xs text-foreground/70">
                      {ui("Delivery checked")}{" "}
                      {new Date(post.statusCheckedAt).toLocaleString()}
                    </p>
                  )}
                  {post.failureReason && (
                    <p className="mt-2 rounded-md bg-red-500/5 px-2 py-1.5 text-xs text-red-500">
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
                      {ui("Open live post")}
                      {post.publishedUrls!.length > 1 ? ` ${index + 1}` : ""}
                    </a>
                  ))}
                  {post.status === "draft" && (
                    <button
                      type="button"
                      onClick={() => loadDraft(post)}
                      className="mt-3 text-xs font-medium text-primary hover:underline"
                    >
                      {ui("Open in composer")}
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-foreground/70">
              <Clock className="mx-auto mb-2 h-8 w-8" />
              <p className="text-sm">
                {ui("No drafts or scheduled posts yet.")}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
