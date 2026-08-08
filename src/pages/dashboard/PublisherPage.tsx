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
  ShieldCheck,
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
  AI_COMPLIANCE_POLICY_VERSION,
  extractTextProvenanceToken,
  requiredDisclosureText,
  withoutTextProvenanceMarker,
  type DisclosureLanguage,
  type PublicationComplianceReview,
  type RightsBasis,
} from "@contracts/compliance";
import posthog from "@/lib/posthog";

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

type TriStateAnswer = "yes" | "no" | "unsure" | "unset";
type MediaRightsAnswer = RightsBasis | "unset";
type ReleaseDisclosureLanguage = DisclosureLanguage | "unset";

function TriStateQuestion({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail?: string;
  value: TriStateAnswer;
  onChange: (value: Exclude<TriStateAnswer, "unset">) => void;
}) {
  const options = [
    { value: "yes" as const, label: "Yes" },
    { value: "no" as const, label: "No" },
    { value: "unsure" as const, label: "Unsure" },
  ];

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs font-medium leading-relaxed">{label}</p>
      {detail ? (
        <p className="mt-1 text-[11px] leading-relaxed text-foreground/45">
          {detail}
        </p>
      ) : null}
      <div
        className="mt-2 grid grid-cols-3 gap-1"
        role="group"
        aria-label={label}
      >
        {options.map(option => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                selected
                  ? option.value === "unsure"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
                    : "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-surface text-foreground/50 hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
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
  const [rightsBasis, setRightsBasis] =
    useState<MediaRightsAnswer>("not-applicable");
  const [aiTextAnswer, setAiTextAnswer] = useState<TriStateAnswer>("unset");
  const [realisticSyntheticAnswer, setRealisticSyntheticAnswer] =
    useState<TriStateAnswer>("unset");
  const [realPersonAnswer, setRealPersonAnswer] =
    useState<TriStateAnswer>("unset");
  const [creativeWorkAnswer, setCreativeWorkAnswer] =
    useState<TriStateAnswer>("unset");
  const [publicInterestAnswer, setPublicInterestAnswer] =
    useState<TriStateAnswer>("unset");
  const [disclosureLanguage, setDisclosureLanguage] =
    useState<ReleaseDisclosureLanguage>("unset");
  const [substantiveHumanReview, setSubstantiveHumanReview] = useState(false);
  const [editorialResponsibilityName, setEditorialResponsibilityName] =
    useState("");
  const [releaseConfirmed, setReleaseConfirmed] = useState(false);
  const [releaseReviewedAt, setReleaseReviewedAt] = useState("");
  const [submitting, setSubmitting] = useState<
    "draft" | "schedule" | "publish" | null
  >(null);
  const [reconciling, setReconciling] = useState(false);
  const automaticRefreshStarted = useRef(false);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const containsAiGeneratedText = aiTextAnswer === "yes";
  const containsRealisticSyntheticMedia =
    mediaAssetId !== "" && realisticSyntheticAnswer === "yes";
  const depictsRealPersonOrVoice =
    mediaAssetId !== "" && realPersonAnswer === "yes";
  const creativeOrFictionalWork =
    mediaAssetId !== "" && creativeWorkAnswer === "yes";
  const publicInterestText = publicInterestAnswer === "yes";

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
  const selectedAssetHasUnverifiedProvenance = Boolean(
    selectedAsset?.provenance &&
    selectedAsset.provenance.marking.status !== "verified"
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

  const invalidateReleaseReview = () => {
    setReleaseConfirmed(false);
    setReleaseReviewedAt("");
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
    setScheduleDate("");
    setScheduleTime("");
    setRightsBasis("not-applicable");
    setAiTextAnswer("unset");
    setRealisticSyntheticAnswer("unset");
    setRealPersonAnswer("unset");
    setCreativeWorkAnswer("unset");
    setPublicInterestAnswer("unset");
    setDisclosureLanguage("unset");
    setSubstantiveHumanReview(false);
    setEditorialResponsibilityName("");
    setReleaseConfirmed(false);
    setReleaseReviewedAt("");
  };

  const buildComplianceReview = (
    releaseDisclosureLanguage: DisclosureLanguage
  ): PublicationComplianceReview => {
    const publicInterestException = Boolean(
      containsAiGeneratedText &&
      publicInterestText &&
      substantiveHumanReview &&
      editorialResponsibilityName.trim()
    );
    const disclosureRequired =
      containsRealisticSyntheticMedia ||
      (containsAiGeneratedText &&
        publicInterestText &&
        !publicInterestException);
    const disclosureText = disclosureRequired
      ? requiredDisclosureText(
          {
            containsRealisticSyntheticMedia,
            publicInterestText: publicInterestText && !publicInterestException,
          },
          releaseDisclosureLanguage
        ) || undefined
      : undefined;
    const disclosureReasons: NonNullable<
      PublicationComplianceReview["visibleDisclosure"]["reasons"]
    > = [];
    if (containsRealisticSyntheticMedia) {
      disclosureReasons.push("realistic-synthetic-media");
    }
    if (
      containsAiGeneratedText &&
      publicInterestText &&
      !publicInterestException
    ) {
      disclosureReasons.push("public-interest-text");
    }
    return {
      policyVersion: AI_COMPLIANCE_POLICY_VERSION,
      reviewedAt: releaseReviewedAt,
      disclosureLanguage: releaseDisclosureLanguage,
      classificationAnswers: {
        aiGeneratedText: containsAiGeneratedText ? "yes" : "no",
        realisticSyntheticMedia: mediaAssetId
          ? containsRealisticSyntheticMedia
            ? "yes"
            : "no"
          : "not-applicable",
        depictsRealPersonOrVoice: mediaAssetId
          ? depictsRealPersonOrVoice
            ? "yes"
            : "no"
          : "not-applicable",
        creativeOrFictionalWork: containsRealisticSyntheticMedia
          ? creativeOrFictionalWork
            ? "yes"
            : "no"
          : "not-applicable",
        publicInterestText: publicInterestText ? "yes" : "no",
      },
      intendedUseConfirmed: true,
      rightsConfirmed: true,
      rightsBasis:
        mediaAssetId && rightsBasis !== "unset"
          ? rightsBasis
          : "not-applicable",
      containsAiGeneratedText,
      containsRealisticSyntheticMedia,
      depictsRealPersonOrVoice,
      creativeOrFictionalWork,
      publicInterestText,
      substantiveHumanReview,
      materialAiEditsAfterReview: false,
      ...(editorialResponsibilityName.trim()
        ? { editorialResponsibilityName: editorialResponsibilityName.trim() }
        : {}),
      visibleDisclosure: {
        required: disclosureRequired,
        reason: containsRealisticSyntheticMedia
          ? "realistic-synthetic-media"
          : disclosureRequired
            ? "public-interest-text"
            : "not-required",
        ...(disclosureReasons.length ? { reasons: disclosureReasons } : {}),
        method: disclosureRequired ? "caption" : "not-required",
        ...(disclosureText ? { text: disclosureText } : {}),
        language: releaseDisclosureLanguage,
      },
    };
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
      platforms: Array.from(new Set(accounts.map(account => account.platform))),
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
      await persistPost(buildPost("draft"));
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
    if (!capabilities.publishing) {
      setNotice({
        tone: "error",
        message:
          "Publishing is not configured. Connect the server-side Zernio integration first.",
      });
      return;
    }
    if (!releaseConfirmed || !releaseReviewedAt) {
      setNotice({
        tone: "error",
        message: "Complete the final release check before publishing.",
      });
      return;
    }
    if (disclosureLanguage === "unset") {
      setNotice({
        tone: "error",
        message:
          "Choose the audience-facing disclosure language for this release.",
      });
      return;
    }
    if (
      mediaAssetId &&
      (rightsBasis === "unset" || rightsBasis === "not-applicable")
    ) {
      setNotice({
        tone: "error",
        message: "Choose the rights basis for the selected media.",
      });
      return;
    }
    if (depictsRealPersonOrVoice && rightsBasis !== "documented-consent") {
      setNotice({
        tone: "error",
        message:
          "A real person's image or voice needs documented consent in this workflow.",
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
      scheduledAt,
      buildComplianceReview(disclosureLanguage)
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
    const review = post.complianceReview;
    if (review) {
      setRightsBasis(
        post.mediaAssetId && review.rightsBasis === "not-applicable"
          ? "unset"
          : review.rightsBasis
      );
      setAiTextAnswer(review.containsAiGeneratedText ? "yes" : "no");
      setRealisticSyntheticAnswer(
        review.containsRealisticSyntheticMedia ? "yes" : "no"
      );
      setRealPersonAnswer(review.depictsRealPersonOrVoice ? "yes" : "no");
      setCreativeWorkAnswer(review.creativeOrFictionalWork ? "yes" : "no");
      setPublicInterestAnswer(review.publicInterestText ? "yes" : "no");
      setDisclosureLanguage(
        review.disclosureLanguage === "en" || review.disclosureLanguage === "it"
          ? review.disclosureLanguage
          : "unset"
      );
      setSubstantiveHumanReview(review.substantiveHumanReview);
      setEditorialResponsibilityName(review.editorialResponsibilityName || "");
      setReleaseConfirmed(false);
      setReleaseReviewedAt("");
    } else {
      setRightsBasis(post.mediaAssetId ? "unset" : "not-applicable");
      setAiTextAnswer("unset");
      setRealisticSyntheticAnswer("unset");
      setRealPersonAnswer("unset");
      setCreativeWorkAnswer("unset");
      setPublicInterestAnswer("unset");
      setDisclosureLanguage("unset");
      setSubstantiveHumanReview(false);
      setEditorialResponsibilityName("");
      setReleaseConfirmed(false);
      setReleaseReviewedAt("");
    }
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

  const busy = Boolean(submitting) || saving;
  const publicInterestException = Boolean(
    containsAiGeneratedText &&
    publicInterestText &&
    substantiveHumanReview &&
    editorialResponsibilityName.trim()
  );
  const disclosurePreview =
    disclosureLanguage !== "unset" &&
    (containsRealisticSyntheticMedia ||
      (containsAiGeneratedText &&
        publicInterestText &&
        !publicInterestException))
      ? requiredDisclosureText(
          {
            containsRealisticSyntheticMedia,
            publicInterestText: publicInterestText && !publicInterestException,
          },
          disclosureLanguage
        )
      : null;
  const answered = (answer: TriStateAnswer) =>
    answer === "yes" || answer === "no";
  const classificationAnswersComplete = Boolean(
    answered(aiTextAnswer) &&
    answered(publicInterestAnswer) &&
    (!mediaAssetId ||
      (answered(realisticSyntheticAnswer) &&
        answered(realPersonAnswer) &&
        (!containsRealisticSyntheticMedia || answered(creativeWorkAnswer))))
  );
  const rightsAnswerComplete = Boolean(
    !mediaAssetId ||
    (rightsBasis !== "unset" &&
      rightsBasis !== "not-applicable" &&
      (!depictsRealPersonOrVoice || rightsBasis === "documented-consent"))
  );
  const releaseFactsReady = Boolean(
    classificationAnswersComplete &&
    disclosureLanguage !== "unset" &&
    rightsAnswerComplete &&
    !selectedAssetHasUnverifiedProvenance &&
    (!substantiveHumanReview || editorialResponsibilityName.trim())
  );
  const releaseReady = Boolean(
    releaseConfirmed && releaseReviewedAt && releaseFactsReady
  );
  const hashtagPreview = parseHashtags(hashtags)
    .map(tag => `#${tag}`)
    .join(" ");
  const outgoingVisiblePreview = [
    disclosurePreview,
    caption.trim(),
    hashtagPreview,
  ]
    .filter(Boolean)
    .join("\n\n");
  const previewLanguage: DisclosureLanguage =
    disclosureLanguage === "it" ? "it" : "en";

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
                onChange={event => {
                  setCaption(event.target.value);
                  invalidateReleaseReview();
                }}
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
                onChange={event => {
                  setHashtags(event.target.value);
                  invalidateReleaseReview();
                }}
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
                onChange={event => {
                  const nextId = event.target.value;
                  setMediaAssetId(nextId);
                  setRightsBasis(nextId ? "unset" : "not-applicable");
                  setRealisticSyntheticAnswer("unset");
                  setRealPersonAnswer("unset");
                  setCreativeWorkAnswer("unset");
                  invalidateReleaseReview();
                }}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm"
              >
                <option value="">Text-only publication</option>
                {publishableAssets.map(asset => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} · {asset.kind}
                    {asset.provenance ? ` · ${asset.provenance.origin}` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-foreground/35">
                Selected media is transferred to the publishing provider only
                when you publish or schedule. Media schedules are limited to 6
                days because provider uploads are temporary.
              </p>
              {selectedAssetHasVerifiedAiOrigin ? (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    AI origin is confirmed by this asset&apos;s verified
                    provenance record. That fact is locked; you still classify
                    whether the result looks realistic.
                  </span>
                </div>
              ) : selectedAssetHasUnverifiedProvenance ? (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    This asset&apos;s provenance is not verified yet. It can
                    stay in a draft, but release remains unavailable.
                  </span>
                </div>
              ) : null}
            </div>

            <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h3 className="text-sm font-semibold">Release check</h3>
                  <p className="mt-1 text-xs leading-relaxed text-foreground/50">
                    A final, contextual check. REELassati adds a short
                    disclosure only when this release actually requires one.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium">Audience disclosure</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/45">
                    Choose the language this release&apos;s audience will see.
                    It is independent of your Studio language.
                  </p>
                </div>
                <div
                  className="grid shrink-0 grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-1"
                  role="group"
                  aria-label="Audience disclosure language"
                >
                  {(
                    [
                      { value: "en", label: "English" },
                      { value: "it", label: "Italiano" },
                    ] as const
                  ).map(option => {
                    const selected = disclosureLanguage === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setDisclosureLanguage(option.value);
                          invalidateReleaseReview();
                        }}
                        className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                          selected
                            ? "bg-primary text-white shadow-sm"
                            : "text-foreground/50 hover:text-foreground"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <TriStateQuestion
                  label="Was the caption materially generated or rewritten with AI?"
                  detail="Minor spelling or formatting assistance alone does not make the caption AI-generated."
                  value={aiTextAnswer}
                  onChange={value => {
                    setAiTextAnswer(value);
                    if (value !== "yes") {
                      setSubstantiveHumanReview(false);
                      setEditorialResponsibilityName("");
                    }
                    invalidateReleaseReview();
                  }}
                />

                {mediaAssetId ? (
                  <TriStateQuestion
                    label="Is the selected media realistic AI-generated or AI-manipulated content?"
                    detail={
                      selectedAssetHasVerifiedAiOrigin
                        ? "AI origin is already verified. Answer only whether viewers could mistake the result for a real person, event, place or scene."
                        : "Answer yes only when both the synthetic origin and realistic presentation apply."
                    }
                    value={realisticSyntheticAnswer}
                    onChange={value => {
                      setRealisticSyntheticAnswer(value);
                      if (value !== "yes") setCreativeWorkAnswer("unset");
                      invalidateReleaseReview();
                    }}
                  />
                ) : null}

                {mediaAssetId ? (
                  <TriStateQuestion
                    label="Does the media depict or imitate an identifiable real person or voice?"
                    detail="This question applies to all selected media, whether or not it is synthetic."
                    value={realPersonAnswer}
                    onChange={value => {
                      setRealPersonAnswer(value);
                      invalidateReleaseReview();
                    }}
                  />
                ) : null}

                <TriStateQuestion
                  label="Does this text inform the public about a matter of public interest?"
                  detail="Examples include health, safety, the environment, elections, public policy or essential services."
                  value={publicInterestAnswer}
                  onChange={value => {
                    setPublicInterestAnswer(value);
                    if (value !== "yes") {
                      setSubstantiveHumanReview(false);
                      setEditorialResponsibilityName("");
                    }
                    invalidateReleaseReview();
                  }}
                />

                {mediaAssetId && containsRealisticSyntheticMedia ? (
                  <TriStateQuestion
                    label="Is it clearly presented as creative, fictional, artistic or satirical?"
                    detail="This affects the appropriate disclosure presentation, not whether disclosure is required."
                    value={creativeWorkAnswer}
                    onChange={value => {
                      setCreativeWorkAnswer(value);
                      invalidateReleaseReview();
                    }}
                  />
                ) : null}
              </div>

              {!classificationAnswersComplete ? (
                <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
                  Answer each applicable item with Yes or No before release.
                  Unsure is safe for a draft, but cannot authorize publishing.
                </p>
              ) : null}

              {containsAiGeneratedText && publicInterestText ? (
                <div className="mt-2 rounded-lg border border-border bg-background p-3 text-xs">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={substantiveHumanReview}
                      onChange={event => {
                        setSubstantiveHumanReview(event.target.checked);
                        invalidateReleaseReview();
                      }}
                      className="mt-0.5 accent-primary"
                    />
                    <span>
                      A human checked the final facts, sources, claims and
                      wording
                    </span>
                  </label>
                  {substantiveHumanReview ? (
                    <input
                      value={editorialResponsibilityName}
                      onChange={event => {
                        setEditorialResponsibilityName(event.target.value);
                        invalidateReleaseReview();
                      }}
                      placeholder="Responsible editor or legal entity"
                      className="mt-3 w-full rounded-md border border-border bg-surface px-3 py-2"
                    />
                  ) : null}
                </div>
              ) : null}

              {mediaAssetId ? (
                <div className="mt-2 rounded-lg border border-border bg-background p-3">
                  <label
                    htmlFor="publisher-rights-basis"
                    className="mb-2 block text-xs font-medium"
                  >
                    Rights basis for selected media
                  </label>
                  <select
                    id="publisher-rights-basis"
                    value={rightsBasis}
                    onChange={event => {
                      setRightsBasis(event.target.value as MediaRightsAnswer);
                      invalidateReleaseReview();
                    }}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-xs"
                  >
                    <option value="unset">Choose a rights basis…</option>
                    <option value="owned-or-licensed">
                      I own it or hold the necessary licence
                    </option>
                    <option value="documented-consent">
                      Documented consent covers this use
                    </option>
                  </select>
                  {depictsRealPersonOrVoice &&
                  rightsBasis !== "documented-consent" ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
                      This workflow requires documented consent when an
                      identifiable person or voice is involved.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3 rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium">
                    {previewLanguage === "it"
                      ? "Anteprima visibile esatta"
                      : "Exact visible post preview"}
                  </p>
                  {disclosurePreview ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      {previewLanguage === "it"
                        ? "Informativa inclusa"
                        : "Disclosure included"}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-surface px-3 py-2.5 text-xs leading-relaxed text-foreground/70">
                  {outgoingVisiblePreview ||
                    (previewLanguage === "it"
                      ? "Scrivi la didascalia per vedere l'anteprima."
                      : "Write the caption to see the preview.")}
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-foreground/40">
                  {disclosurePreview
                    ? previewLanguage === "it"
                      ? "L'informativa è mostrata prima della didascalia, al primo contatto con il contenuto."
                      : "The disclosure appears before the caption, at first exposure to the content."
                    : previewLanguage === "it"
                      ? "Nessuna informativa visibile è richiesta da queste risposte. La provenienza tecnica resta incorporata ove applicabile."
                      : "These answers do not require a visible disclosure. Machine provenance remains embedded where applicable."}
                </p>
              </div>

              <label className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-relaxed">
                <input
                  type="checkbox"
                  checked={releaseConfirmed}
                  disabled={!releaseFactsReady}
                  onChange={event => {
                    const checked = event.target.checked;
                    setReleaseConfirmed(checked);
                    setReleaseReviewedAt(
                      checked ? new Date().toISOString() : ""
                    );
                  }}
                  className="mt-0.5 accent-primary disabled:opacity-40"
                />
                <span>
                  Final version checked for the selected destinations and
                  timing: creative/marketing use, classifications, rights and
                  consent confirmed, with no material AI edits after this
                  review.
                </span>
              </label>
            </section>

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
                  Time
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
                  !capabilities.publishing ||
                  !releaseReady
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
                  !capabilities.publishing ||
                  !releaseReady
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
                  {post.outgoingContent ? (
                    <div>
                      <p className="mb-1 font-mono text-[9px] uppercase tracking-wide text-foreground/35">
                        Exact provider payload
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
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-medium uppercase tracking-wide">
                      <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-600">
                        Release review recorded
                      </span>
                      <span className="rounded-full bg-foreground/5 px-2 py-1 text-foreground/50">
                        {post.complianceReview.disclosureLanguage === "it"
                          ? "Italian disclosure"
                          : post.complianceReview.disclosureLanguage === "en"
                            ? "English disclosure"
                            : "Disclosure language not recorded"}
                      </span>
                      {post.complianceReview.visibleDisclosure.required ? (
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                          Visible cue included
                        </span>
                      ) : null}
                      {post.outgoingContent &&
                      extractTextProvenanceToken(post.outgoingContent) ? (
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                          Machine provenance included
                        </span>
                      ) : null}
                    </div>
                  ) : null}
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
