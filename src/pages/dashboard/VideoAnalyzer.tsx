import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BarChart3,
  Check,
  ChevronRight,
  Film,
  Gauge,
  Link2,
  Loader2,
  Search,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react";
import type {
  Asset,
  EditOperation,
  Platform,
  QualitySignal,
  WorkspaceEvent,
} from "@contracts/workspace";
import { platformApi } from "@/lib/platform-api";
import { useWorkspace } from "@/providers/workspace";
import { useFileDropZone } from "@/hooks/useFileDropZone";
import { AiProvenanceBadge } from "@/components/compliance/AiProvenanceBadge";
import { validateFileSelection } from "@/lib/file-validation";
import posthog from "@/lib/posthog";
import { AI_CREDIT_COSTS, timedCreditCost } from "@contracts/billing";

type AnalysisResult = Awaited<ReturnType<typeof platformApi.analyzeVideo>>;
type SourceMode = "upload" | "url";

const ANALYSIS_PLATFORMS: Array<{ value: Platform; label: string }> = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram Reels" },
  { value: "youtube", label: "YouTube Shorts" },
];

function validatePublicVideoUrl(value: string) {
  if (!value.trim()) return "Enter a public HTTPS video URL.";
  try {
    const parsed = new URL(value.trim());
    const hostname = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:") return "The video URL must use HTTPS.";
    if (
      hostname === "localhost" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.endsWith(".local") ||
      /^10\./.test(hostname) ||
      /^127\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return "Use a public URL, not a local or private network address.";
    }
    return null;
  } catch {
    return "Enter a valid public HTTPS video URL.";
  }
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score));
}

function confidencePercent(confidence: number) {
  const normalized = confidence <= 1 ? confidence * 100 : confidence;
  return Math.round(clampScore(normalized));
}

function signalColor(score: number) {
  if (score >= 75) return "text-emerald-500";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
}

function signalBar(score: number) {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function retentionToQualitySignals(
  retention: AnalysisResult["retention"]
): QualitySignal[] {
  return retention.map((segment, index) => ({
    id: `analysis-signal-${crypto.randomUUID()}-${index}`,
    label: segment.score >= 75 ? "Retention strength" : "Retention risk",
    detail: segment.note,
    start: segment.start,
    end: segment.end,
    level:
      segment.score >= 75 ? "good" : segment.score >= 50 ? "attention" : "risk",
  }));
}

function createEvent(
  type: WorkspaceEvent["type"],
  label: string,
  detail: string
): WorkspaceEvent {
  return {
    id: crypto.randomUUID(),
    type,
    label,
    detail,
    createdAt: new Date().toISOString(),
  };
}

export default function VideoAnalyzer() {
  const { workspace, capabilities, loading, updateWorkspace } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceMode, setSourceMode] = useState<SourceMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [sourceAsset, setSourceAsset] = useState<Asset | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidateSourceAuthorization = () => {
    setResult(null);
    setQueued(false);
  };

  const selectVideoFile = (nextFile: File | null) => {
    setFile(nextFile);
    setSourceAsset(null);
    setUploadProgress(0);
    invalidateSourceAuthorization();
  };

  const acceptVideoFiles = (files: File[]) => {
    const selection = validateFileSelection(files, { purpose: "video" });
    if (selection.error) {
      setError(selection.error);
      return;
    }
    setError(null);
    selectVideoFile(selection.files[0]);
  };

  const { isDragging, dropZoneProps } = useFileDropZone({
    disabled: !capabilities.uploads || sourceMode !== "upload" || analyzing,
    onFiles: acceptVideoFiles,
  });

  const videoAssets = useMemo(
    () => workspace.assets.filter(asset => asset.kind === "video"),
    [workspace.assets]
  );
  const urlError =
    sourceMode === "url" ? validatePublicVideoUrl(publicUrl) : null;
  const sourceReady =
    sourceMode === "upload" ? Boolean(file || sourceAsset) : !urlError;
  const analysisReady = capabilities.analysis;
  const analysisCreditCost = timedCreditCost(
    sourceAsset?.duration,
    AI_CREDIT_COSTS.videoAnalysisPerMinute
  );

  const saveUploadedAsset = async (asset: Asset) => {
    await updateWorkspace(current => ({
      ...current,
      assets: [
        asset,
        ...current.assets.filter(candidate => candidate.id !== asset.id),
      ],
      activity: [
        createEvent("upload", "Video uploaded for analysis", asset.name),
        ...current.activity,
      ].slice(0, 100),
    }));
  };

  const resolveSourceAsset = async () => {
    if (sourceAsset) return sourceAsset;
    if (!file) return null;
    const asset = await platformApi.uploadAsset(
      file,
      "video",
      setUploadProgress
    );
    setSourceAsset(asset);
    await saveUploadedAsset(asset);
    return asset;
  };

  const handleAnalyze = async () => {
    if (!sourceReady || !analysisReady || analyzing) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setQueued(false);

    try {
      const asset = sourceMode === "upload" ? await resolveSourceAsset() : null;
      if (sourceMode === "upload" && !asset) {
        throw new Error("Select or upload a video before running analysis.");
      }

      const analysis = await platformApi.analyzeVideo({
        assetId: asset?.id,
        publicUrl: sourceMode === "url" ? publicUrl.trim() : undefined,
        platform,
        sourceRightsConfirmed: true,
      });
      setResult(analysis);
      posthog?.capture("video_analysis_completed", {
        source_type: sourceMode,
        platform,
        proposed_changes_count: analysis.changes.length,
        retention_segments_count: analysis.retention.length,
      });
      await updateWorkspace(current => ({
        ...current,
        activity: [
          createEvent(
            "generation",
            "Video analysis completed",
            asset?.name ?? new URL(publicUrl.trim()).hostname
          ),
          ...current.activity,
        ].slice(0, 100),
      }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The video could not be analyzed."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const queueChanges = async () => {
    if (!result || !selectedProjectId) return;
    setError(null);
    try {
      const signals = retentionToQualitySignals(result.retention);
      await updateWorkspace(current => ({
        ...current,
        projects: current.projects.map(project => {
          if (project.id !== selectedProjectId) return project;
          const existingChangeIds = new Set(
            project.proposedChanges.map(change => change.id)
          );
          const existingSignalIds = new Set(
            project.qualitySignals.map(signal => signal.id)
          );
          return {
            ...project,
            status: "editing",
            updatedAt: new Date().toISOString(),
            proposedChanges: [
              ...project.proposedChanges,
              ...result.changes
                .filter(change => !existingChangeIds.has(change.id))
                .map(change => ({
                  ...change,
                  provenance: change.provenance ?? result.provenance,
                  targetClipIds: project.clips
                    .filter(
                      clip =>
                        clip.start < change.end &&
                        clip.start + clip.duration > change.start
                    )
                    .map(clip => clip.id),
                  status: "proposed" as const,
                })),
            ],
            qualitySignals: [
              ...project.qualitySignals,
              ...signals.filter(signal => !existingSignalIds.has(signal.id)),
            ],
          };
        }),
        activity: [
          createEvent(
            "project",
            "Analysis queued in editor",
            `${result.changes.length} proposed changes`
          ),
          ...current.activity,
        ].slice(0, 100),
      }));
      setQueued(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The edit plan could not be queued."
      );
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="mono-eyebrow mb-2 text-primary">Edit Intelligence</p>
        <h1 className="text-3xl font-semibold">Video Analyzer</h1>
        <p className="mt-2 max-w-3xl text-foreground/60">
          Analyze your footage or a public video, inspect the evidence by time
          range, then queue the returned changes in a real edit project.
        </p>
      </div>

      {!loading && !analysisReady ? (
        <div
          className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4"
          role="status"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-medium">
              AI analysis is temporarily unavailable
            </p>
            <p className="mt-1 text-xs text-foreground/55">
              Uploads and saved assets remain available, but analysis will stay
              disabled until the server-side AI capability is connected.
            </p>
          </div>
        </div>
      ) : null}

      <section className="mb-6 rounded-xl border border-border bg-surface p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-lg border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => {
                if (sourceMode !== "upload") {
                  setSourceMode("upload");
                  invalidateSourceAuthorization();
                }
              }}
              aria-pressed={sourceMode === "upload"}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                sourceMode === "upload"
                  ? "bg-primary text-white"
                  : "text-foreground/55"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload or asset
            </button>
            <button
              type="button"
              onClick={() => {
                if (sourceMode !== "url") {
                  setSourceMode("url");
                  invalidateSourceAuthorization();
                }
              }}
              aria-pressed={sourceMode === "url"}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                sourceMode === "url"
                  ? "bg-primary text-white"
                  : "text-foreground/55"
              }`}
            >
              <Link2 className="h-3.5 w-3.5" />
              Public URL
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label
              className="text-xs text-foreground/45"
              htmlFor="analysis-platform"
            >
              Optimize for
            </label>
            <select
              id="analysis-platform"
              value={platform}
              onChange={event => setPlatform(event.target.value as Platform)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
            >
              {ANALYSIS_PLATFORMS.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {sourceMode === "upload" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={event => {
                  acceptVideoFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                {...dropZoneProps}
                onClick={() => fileInputRef.current?.click()}
                disabled={!capabilities.uploads || analyzing}
                className={`flex min-h-28 w-full items-center justify-center gap-3 rounded-xl border border-dashed p-5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                  isDragging
                    ? "scale-[1.01] border-primary bg-primary/10 shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Upload className="h-5 w-5 text-primary" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {file?.name ?? "Choose a video file"}
                  </span>
                  <span className="mt-1 block text-xs text-foreground/45">
                    {file
                      ? `${(file.size / 1024 / 1024).toFixed(1)} MB · uploads when analysis starts`
                      : capabilities.uploads
                        ? isDragging
                          ? "Drop it here"
                          : "Drop video here, or click · stored privately"
                        : "Upload storage is not configured"}
                  </span>
                </span>
              </button>
              {uploadProgress > 0 && uploadProgress < 100 ? (
                <div className="mt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-foreground/40">
                    Uploading {uploadProgress}%
                  </p>
                </div>
              ) : null}
            </div>

            <div>
              <label
                className="mb-2 block text-xs font-medium"
                htmlFor="existing-video"
              >
                Or select a saved video
              </label>
              <select
                id="existing-video"
                value={sourceAsset?.id ?? ""}
                onChange={event => {
                  const asset =
                    videoAssets.find(
                      candidate => candidate.id === event.target.value
                    ) ?? null;
                  setSourceAsset(asset);
                  setFile(null);
                  invalidateSourceAuthorization();
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm"
              >
                <option value="">No saved video selected</option>
                {videoAssets.map(asset => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-foreground/40">
                Analysis receives the stored asset ID. A browser-only blob URL
                is never sent for AI processing.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <label
              className="mb-2 block text-xs font-medium"
              htmlFor="public-video-url"
            >
              Public HTTPS video URL
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
              <input
                id="public-video-url"
                type="url"
                inputMode="url"
                value={publicUrl}
                onChange={event => {
                  setPublicUrl(event.target.value);
                  invalidateSourceAuthorization();
                }}
                placeholder="https://cdn.example.com/video.mp4"
                className="w-full rounded-lg border border-border bg-background py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <p
              className={`mt-2 text-[11px] ${
                publicUrl && urlError ? "text-red-500" : "text-foreground/40"
              }`}
            >
              {publicUrl && urlError
                ? urlError
                : "Use a URL the analysis service can fetch without browser cookies or local access."}
            </p>
          </div>
        )}

        <div className="mt-5 rounded-lg border border-border bg-background/60 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-foreground/55">
            <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
            REELassati AI analysis
          </p>
          <p className="mt-2 text-xs leading-relaxed text-foreground/55">
            The selected video is processed only when you press Analyze. Use
            media you are allowed to submit; handling is covered by the platform
            terms and privacy information.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleAnalyze()}
          disabled={!sourceReady || analyzing || !analysisReady}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
        >
          {analyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {uploadProgress > 0 && uploadProgress < 100
                ? "Uploading source"
                : "Analyzing edit"}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Analyze video · {analysisCreditCost} credits
            </>
          )}
        </button>

        {error ? (
          <p className="mt-3 text-sm text-red-500" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <AnimatePresence mode="wait">
        {result ? (
          <motion.div
            key="analysis-result"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <section className="rounded-xl border border-border bg-surface p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="max-w-3xl">
                  <p className="mono-eyebrow mb-2 text-primary">
                    AI edit review
                  </p>
                  <h2 className="text-xl font-semibold">
                    What the model found
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/65">
                    {result.summary}
                  </p>
                  <div className="mt-3">
                    <AiProvenanceBadge provenance={result.provenance} />
                  </div>
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-2">
                  {[
                    { label: "Hook", score: result.hook.score },
                    { label: "Pacing", score: result.pacing.score },
                  ].map(signal => (
                    <div
                      key={signal.label}
                      className="min-w-24 rounded-lg border border-border bg-background p-3 text-center"
                    >
                      <p
                        className={`text-2xl font-semibold ${signalColor(signal.score)}`}
                      >
                        {Math.round(signal.score)}
                      </p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-foreground/40">
                        {signal.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {[
                  { label: "Hook assessment", value: result.hook },
                  { label: "Pacing assessment", value: result.pacing },
                ].map(item => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-border bg-background p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{item.label}</span>
                      <span
                        className={`text-xs font-mono ${signalColor(item.value.score)}`}
                      >
                        {Math.round(item.value.score)}/100
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                      <div
                        className={`h-full rounded-full ${signalBar(item.value.score)}`}
                        style={{ width: `${clampScore(item.value.score)}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-foreground/55">
                      {item.value.note}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-foreground/35">
                Scores are the AI model&apos;s assessment of this source, not
                measured reach or a guarantee of performance.
              </p>
            </section>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <section className="rounded-xl border border-border bg-surface p-6">
                <h2 className="flex items-center gap-2 font-medium">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Retention map
                </h2>
                <div className="mt-4 space-y-3">
                  {result.retention.map((segment, index) => (
                    <div
                      key={`${segment.start}-${segment.end}-${index}`}
                      className="rounded-lg border border-border bg-background p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[11px] text-foreground/45">
                          {segment.start.toFixed(1)}s–{segment.end.toFixed(1)}s
                        </span>
                        <span
                          className={`text-xs font-medium ${signalColor(segment.score)}`}
                        >
                          {Math.round(segment.score)}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                        <div
                          className={`h-full rounded-full ${signalBar(segment.score)}`}
                          style={{ width: `${clampScore(segment.score)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-foreground/55">
                        {segment.note}
                      </p>
                    </div>
                  ))}
                  {result.retention.length === 0 ? (
                    <p className="rounded-lg border border-border bg-background p-4 text-xs text-foreground/45">
                      The analyzer did not return time-based retention signals
                      for this source.
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-surface p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 font-medium">
                    <WandSparkles className="h-4 w-4 text-primary" />
                    Actionable edit plan
                  </h2>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
                    {result.changes.length} proposed
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {result.changes.map((change: EditOperation) => (
                    <article
                      key={change.id}
                      className="rounded-lg border border-border bg-background p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{change.label}</p>
                          <p className="mt-1 font-mono text-[10px] text-foreground/40">
                            {change.start.toFixed(1)}s–{change.end.toFixed(1)}s
                            · {change.type}
                          </p>
                        </div>
                        <span className="rounded-full bg-foreground/[0.06] px-2 py-1 text-[10px] text-foreground/50">
                          {confidencePercent(change.confidence)}% confidence
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-foreground/60">
                        {change.reason}
                      </p>
                      <p className="mt-2 text-[10px] uppercase tracking-wider text-foreground/35">
                        {change.intensity} intensity · review before accepting
                      </p>
                    </article>
                  ))}
                  {result.changes.length === 0 ? (
                    <p className="rounded-lg border border-border bg-background p-4 text-xs text-foreground/45">
                      No edit operations were returned. Refine the source or try
                      a different platform target.
                    </p>
                  ) : null}
                </div>

                {result.changes.length > 0 ? (
                  <div className="mt-5 border-t border-border pt-5">
                    {workspace.projects.length > 0 ? (
                      <>
                        <label
                          className="mb-2 block text-xs font-medium"
                          htmlFor="analysis-project"
                        >
                          Queue in project
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <select
                            id="analysis-project"
                            value={selectedProjectId}
                            onChange={event => {
                              setSelectedProjectId(event.target.value);
                              setQueued(false);
                            }}
                            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                          >
                            <option value="">Choose an edit project</option>
                            {workspace.projects.map(project => (
                              <option key={project.id} value={project.id}>
                                {project.title}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void queueChanges()}
                            disabled={!selectedProjectId || queued}
                            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-45"
                          >
                            {queued ? (
                              <>
                                <Check className="h-4 w-4" />
                                Queued
                              </>
                            ) : (
                              <>
                                Queue changes
                                <ChevronRight className="h-4 w-4" />
                              </>
                            )}
                          </button>
                        </div>
                        <p className="mt-2 text-[11px] text-foreground/40">
                          Changes enter the editor as proposed operations.
                          Nothing is applied until you review and accept it.
                        </p>
                      </>
                    ) : (
                      <div className="flex items-start gap-3 rounded-lg bg-background p-4">
                        <Film className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p className="text-xs leading-relaxed text-foreground/55">
                          Create an edit project first, then rerun or reopen
                          this analysis to queue its proposed timeline changes.
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            </div>
          </motion.div>
        ) : (
          <motion.section
            key="analysis-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-border bg-surface p-10 text-center"
          >
            <Gauge className="h-9 w-9 text-primary/40" />
            <h2 className="mt-4 text-lg font-medium text-foreground/65">
              Evidence before edits
            </h2>
            <p className="mt-2 max-w-md text-sm text-foreground/45">
              Analysis starts only after you provide a real source. Results
              include time ranges, model notes, and reviewable edit operations.
            </p>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
