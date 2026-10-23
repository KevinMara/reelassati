import { useUiText } from "@/lib/i18n/ui";
import { AnalyzerWorkspace } from "@/components/studio/AnalyzerWorkspace";
import { videoReviewFailureMessage } from "@contracts/video-analysis-errors";
import {
  normalizeSavedAnalyzerReports,
  attachReportAudience,
  requiresAnalysisQuoteReview,
  type AudienceResponse,
  type AnalyzerOptimization,
  type SavedAnalyzerReport,
} from "@contracts/analyzer-report";
import {
  VIDEO_ANALYSIS_SCHEMA_VERSION,
  scoreVideoInsights,
} from "@contracts/video-analysis";
import { useTranslation } from "react-i18next";
import { StudioSelect } from "@/components/ui/studio-select";
import { resolveVideoMetadata } from "@/lib/media-metadata";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
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
import {
  platformApi,
  captureUploadRequestScope,
  verifyUploadRequestScope,
  PlatformApiError,
} from "@/lib/platform-api";
import {
  validateDirectVideoUrl,
  DIRECT_VIDEO_HELP,
} from "@contracts/public-video";
import { importDirectVideo } from "@/lib/direct-video-import";
import { selectedBrand } from "@/lib/workspace-scope";
import type { UploadRequestScope } from "@/lib/platform-api";
import { mapSourceAnalysisToProject } from "@/lib/analysis-project-mapping";
import { useWorkspace } from "@/providers/workspace";
import { useFileDropZone } from "@/hooks/useFileDropZone";
import { AiProvenanceBadge } from "@/components/compliance/AiProvenanceBadge";
import { validateFileSelection } from "@/lib/file-validation";
import posthog from "@/lib/posthog";
import { AI_CREDIT_COSTS, timedCreditCost } from "@contracts/billing";
import { Link } from "react-router-dom";

type AnalysisResult = Awaited<ReturnType<typeof platformApi.analyzeVideo>>;
type SourceMode = "upload" | "url";

const ANALYSIS_PLATFORMS: Array<{ value: Platform; label: string }> = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram Reels" },
  { value: "youtube", label: "YouTube Shorts" },
];

function confidencePercent(confidence: number) {
  const normalized = confidence <= 1 ? confidence * 100 : confidence;
  return Math.round(Math.max(0, Math.min(100, normalized)));
}

function retentionToQualitySignals(
  retention: AnalysisResult["retention"]
): QualitySignal[] {
  return retention.map((segment, index) => ({
    id: `analysis-signal-${crypto.randomUUID()}-${index}`,
    label:
      segment.score >= 75 ? "Editorial strength" : "Editorial review point",
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
  const ui = useUiText();
  const { i18n } = useTranslation("ui");
  const { workspace, capabilities, loading, updateWorkspace } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceMode, setSourceMode] = useState<SourceMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [sourceAsset, setSourceAsset] = useState<Asset | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [focus, setFocus] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [queued, setQueued] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [error, setError] = useState<string | Error | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [analysisStage, setAnalysisStage] = useState("");
  const [analyzedAsset, setAnalyzedAsset] = useState<Asset | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const analyzedScope = useRef<UploadRequestScope | null>(null);
  const owner = workspace.profile.email.toLowerCase();
  const brand = selectedBrand(owner);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
      analyzedScope.current = null;
    },
    [owner, brand]
  );

  const invalidateSourceAuthorization = () => {
    generation.current++;
    controller.current?.abort();
    setAnalyzing(false);
    setError(null);
    setNotice(null);
    setAnalyzedAsset(null);
    analyzedScope.current = null;
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
    const selection = validateFileSelection(files, {
      purpose: "video",
      text: ui,
    });
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
    sourceMode === "url" ? validateDirectVideoUrl(publicUrl) : null;
  const sourceReady =
    sourceMode === "upload"
      ? Boolean(file || sourceAsset)
      : Boolean(sourceAsset || !urlError);
  const analysisReady =
    capabilities.analysis &&
    capabilities.analysisTransportVersion === "foreground-v1" &&
    capabilities.analysisSchemaVersion === VIDEO_ANALYSIS_SCHEMA_VERSION;
  const analysisCreditCost = timedCreditCost(
    sourceAsset?.duration,
    AI_CREDIT_COSTS.videoAnalysisPerMinute
  );

  const saveUploadedAsset = async (asset: Asset, scope: UploadRequestScope) => {
    await updateWorkspace(current => {
      if (
        current.profile.email.toLowerCase() !== scope.ownerEmail ||
        selectedBrand(scope.ownerEmail) !== scope.brandId
      )
        throw new Error(
          ui("The workspace changed before the imported video could be saved.")
        );
      return {
        ...current,
        assets: [
          asset,
          ...current.assets.filter(candidate => candidate.id !== asset.id),
        ],
        activity: [
          createEvent("upload", "Video uploaded for analysis", asset.name),
          ...current.activity,
        ].slice(0, 100),
      };
    });
  };

  const handleAnalyze = async () => {
    if (!sourceReady || !analysisReady || analyzing) return;
    const id = ++generation.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setAnalyzing(true);
    setError(null);
    setNotice(null);
    setAnalysisStage("Preparing source…");
    setResult(null);
    setQueued(false);
    try {
      const scope = await captureUploadRequestScope();
      abort.signal.throwIfAborted();
      if (
        id !== generation.current ||
        scope.ownerEmail !== owner ||
        scope.brandId !== brand
      )
        return;
      let asset = sourceAsset;
      if (!asset) {
        if (sourceMode === "url")
          asset = await importDirectVideo(publicUrl, {
            signal: abort.signal,
            scope,
          });
        else if (file)
          asset = await platformApi.uploadAsset(
            file,
            "video",
            setUploadProgress,
            undefined,
            { scope, signal: abort.signal }
          );
        if (!asset)
          throw new Error(ui("Select a video before running analysis."));
      }
      asset = await resolveVideoMetadata(asset, abort.signal);
      abort.signal.throwIfAborted();
      await verifyUploadRequestScope(scope);
      if (id !== generation.current) return;
      const readyAsset = asset;
      await saveUploadedAsset(readyAsset, scope);
      if (id !== generation.current || abort.signal.aborted) return;
      setSourceAsset(readyAsset);
      // Import/measurement never starts a paid analysis. A second click accepts the actual duration quote.
      if (requiresAnalysisQuoteReview(sourceAsset, readyAsset)) {
        setNotice(
          ui(
            "Source ready · {{seconds}} seconds. Review the measured credit quote, then press Analyze video.",
            { seconds: readyAsset.duration!.toFixed(1) }
          )
        );
        return;
      }
      const analysis = await (
        await import("@/lib/analyze-media")
      ).analyzeMedia(
        readyAsset,
        platform,
        focus.trim() || undefined,
        stage => {
          if (id === generation.current) setAnalysisStage(stage);
        },
        abort.signal,
        scope,
        i18n.resolvedLanguage || i18n.language
      );
      abort.signal.throwIfAborted();
      await verifyUploadRequestScope(scope);
      if (id !== generation.current) return;
      if (
        analysis.schemaVersion !== VIDEO_ANALYSIS_SCHEMA_VERSION ||
        scoreVideoInsights(analysis.insights ?? [], readyAsset.duration!)
          .status !== "complete"
      )
        throw new Error(
          ui(
            "The video review is incomplete. Please refresh before analyzing again."
          )
        );
      analyzedScope.current = scope;
      setAnalyzedAsset(readyAsset);
      setResult(analysis);
      posthog?.capture("video_analysis_completed", {
        source_type: sourceMode,
        platform,
        proposed_changes_count: analysis.changes.length,
        retention_segments_count: analysis.retention.length,
      });
      await updateWorkspace(current => {
        if (
          current.profile.email.toLowerCase() !== scope.ownerEmail ||
          selectedBrand(scope.ownerEmail) !== scope.brandId
        )
          throw new Error(
            ui("The analysis workspace changed before saving its activity.")
          );
        return {
          ...current,
          analyzerReports: normalizeSavedAnalyzerReports([
            {
              assetId: readyAsset.id,
              duration: readyAsset.duration!,
              platform,
              createdAt: new Date().toISOString(),
              result: {
                ...analysis,
                schemaVersion: VIDEO_ANALYSIS_SCHEMA_VERSION,
              },
            },
            ...(current.analyzerReports || []).filter(
              report =>
                report.assetId !== readyAsset.id || report.platform !== platform
            ),
          ]),
          activity: [
            createEvent(
              "generation",
              "Video analysis completed",
              readyAsset.name
            ),
            ...current.activity,
          ].slice(0, 100),
        };
      });
    } catch (cause) {
      if (id === generation.current && !abort.signal.aborted)
        setError(
          cause instanceof Error ? cause : "The video could not be analyzed."
        );
    } finally {
      if (id === generation.current) {
        setAnalyzing(false);
        controller.current = null;
      }
    }
  };

  const restoreReview = async (report: SavedAnalyzerReport) => {
    setError(null);
    const id = generation.current;
    try {
      const scope = await captureUploadRequestScope();
      await verifyUploadRequestScope(scope);
      const asset = workspace.assets.find(
        item =>
          item.id === report.assetId &&
          item.duration &&
          Math.abs(item.duration - report.duration) <= 0.25
      );
      if (id !== generation.current || !asset) return;
      analyzedScope.current = scope;
      setAnalyzedAsset(asset);
      setSourceAsset(asset);
      setPlatform(report.platform as Platform);
      setResult(report.result);
      setNotice(ui("Saved analysis"));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The saved analysis could not be opened."
      );
    }
  };

  const queueChanges = async () => {
    if (
      !result ||
      !selectedProjectId ||
      !analyzedAsset?.duration ||
      !analyzedScope.current
    )
      return;
    const scope = analyzedScope.current;
    const id = generation.current;
    setError(null);
    try {
      await verifyUploadRequestScope(scope);
      if (id !== generation.current) return;
      let count = 0;
      let refused: string[] = [];
      await updateWorkspace(current => {
        if (
          id !== generation.current ||
          current.profile.email.toLowerCase() !== scope.ownerEmail ||
          selectedBrand(scope.ownerEmail) !== scope.brandId ||
          !current.assets.some(a => a.id === analyzedAsset.id)
        )
          throw new Error(
            ui("The analyzed source is no longer in this workspace.")
          );
        if (!current.projects.some(p => p.id === selectedProjectId))
          throw new Error(ui("The selected project is no longer available."));
        return {
          ...current,
          projects: current.projects.map(project => {
            if (project.id !== selectedProjectId) return project;
            const mapped = mapSourceAnalysisToProject(
              project,
              { id: analyzedAsset.id, duration: analyzedAsset.duration! },
              {
                changes: result.changes.map(change => ({
                  ...change,
                  provenance: change.provenance ?? result.provenance,
                })),
                signals: retentionToQualitySignals(result.retention),
              }
            );
            const existing = new Set(
              project.proposedChanges.map(change => change.id)
            );
            const changes = mapped.changes.filter(
              change => !existing.has(change.id)
            );
            count = changes.length;
            refused = mapped.rejected;
            if (!changes.length && mapped.rejected.length)
              throw new Error(
                `No changes were queued. ${mapped.rejected.join("; ")}`
              );
            return {
              ...project,
              status: "editing",
              updatedAt: new Date().toISOString(),
              proposedChanges: [...project.proposedChanges, ...changes],
              qualitySignals: [...project.qualitySignals, ...mapped.signals],
            };
          }),
        };
      });
      if (id !== generation.current) return;
      setQueued(true);
      if (refused.length)
        setError(
          `${count} source-mapped changes queued. Held for an explicit timeline decision: ${refused.join("; ")}`
        );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The edit plan could not be queued."
      );
    }
  };

  const saveAudienceResponse = async (
    audience: AudienceResponse | undefined
  ) => {
    const scope = analyzedScope.current;
    if (!scope || !analyzedAsset) return;
    const id = generation.current;
    await verifyUploadRequestScope(scope);
    await updateWorkspace(current => {
      if (
        id !== generation.current ||
        current.profile.email.toLowerCase() !== scope.ownerEmail ||
        selectedBrand(scope.ownerEmail) !== scope.brandId
      )
        throw new Error(
          "The analysis workspace changed before saving its activity."
        );
      const reports = attachReportAudience(
        current.analyzerReports,
        analyzedAsset.id,
        platform,
        audience
      );
      return { ...current, analyzerReports: reports };
    });
  };

  const createAnalyzedProject = async (optimization?: AnalyzerOptimization) => {
    if (!analyzedAsset?.duration || !analyzedScope.current || creatingProject)
      return;
    const source = analyzedAsset;
    const duration = analyzedAsset.duration;
    const scope = analyzedScope.current;
    const generationId = generation.current;
    const projectId = crypto.randomUUID();
    const now = new Date().toISOString();
    setCreatingProject(true);
    setError(null);
    try {
      await verifyUploadRequestScope(scope);
      await updateWorkspace(current => {
        if (
          generationId !== generation.current ||
          current.profile.email.toLowerCase() !== scope.ownerEmail ||
          selectedBrand(scope.ownerEmail) !== scope.brandId ||
          !current.assets.some(asset => asset.id === source.id)
        )
          throw new Error(
            ui("The analyzed source is no longer in this workspace.")
          );
        return {
          ...current,
          projects: [
            {
              id: projectId,
              ...(optimization ? { analyzerOptimization: optimization } : {}),
              title: source.name.replace(/\.[^.]+$/, "") + " · edit",
              template: "blank",
              status: "editing",
              platform,
              aspectRatio:
                source.width && source.height && source.width > source.height
                  ? "16:9"
                  : source.width === source.height && source.width
                    ? "1:1"
                    : "9:16",
              duration,
              playhead: 0,
              createdAt: now,
              updatedAt: now,
              clips: [
                {
                  id: crypto.randomUUID(),
                  assetId: source.id,
                  track: "video",
                  lane: 1,
                  label: source.name,
                  start: 0,
                  duration,
                  inPoint: 0,
                  outPoint: duration,
                  locked: false,
                  muted: false,
                  speed: 1,
                  volume: 1,
                  fit: "contain",
                  color: "#8b7cf4",
                },
              ],
              activeAssetId: source.id,
              transcript: [],
              proposedChanges: [],
              qualitySignals: [],
              revisions: [],
            },
            ...current.projects,
          ],
        };
      });
      if (generationId === generation.current) {
        setSelectedProjectId(projectId);
        setQueued(false);
        return projectId;
      }
    } catch (cause) {
      if (generationId === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The edit project could not be created."
        );
    } finally {
      setCreatingProject(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="mono-eyebrow mb-2 text-primary">
          {ui("Edit Intelligence")}
        </p>
        <h1 className="text-3xl font-semibold">{ui("Video Analyzer")}</h1>
        <p className="mt-2 max-w-3xl text-foreground/60">
          {ui(
            "Find the moments that earn attention. Review your video, identify hooks and payoffs, and turn the evidence into a sharper short."
          )}
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
              {ui("AI analysis is temporarily unavailable")}
            </p>
            <p className="mt-1 text-xs text-foreground/70">
              {ui(
                "A complete audiovisual review is being updated. Your credits stay available."
              )}
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
                  setSourceAsset(null);
                  invalidateSourceAuthorization();
                }
              }}
              aria-pressed={sourceMode === "upload"}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                sourceMode === "upload"
                  ? "bg-primary text-white"
                  : "text-foreground/70"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              {ui("Upload or asset")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (sourceMode !== "url") {
                  setSourceMode("url");
                  setSourceAsset(null);
                  setFile(null);
                  invalidateSourceAuthorization();
                }
              }}
              aria-pressed={sourceMode === "url"}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                sourceMode === "url"
                  ? "bg-primary text-white"
                  : "text-foreground/70"
              }`}
            >
              <Link2 className="h-3.5 w-3.5" />
              {ui("Public URL")}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label
              className="text-xs text-foreground/70"
              htmlFor="analysis-platform"
            >
              {ui("Optimize for")}
            </label>
            <StudioSelect
              id="analysis-platform"
              value={platform}
              onChange={event => {
                invalidateSourceAuthorization();
                setPlatform(event.target.value as Platform);
              }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
            >
              {ANALYSIS_PLATFORMS.map(item => (
                <option key={item.value} value={item.value}>
                  {ui(item.label)}
                </option>
              ))}
            </StudioSelect>
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
                    {file?.name ?? ui("Choose a video file")}
                  </span>
                  <span className="mt-1 block text-xs text-foreground/70">
                    {file
                      ? ui("{{megabytes}} MB · uploads when analysis starts", {
                          megabytes: (file.size / 1024 / 1024).toFixed(1),
                        })
                      : capabilities.uploads
                        ? isDragging
                          ? ui("Drop it here")
                          : ui("Drop video here, or click · stored privately")
                        : ui("Upload storage is not configured")}
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
                  <p className="mt-1 text-xs text-foreground/70">
                    {ui("Uploading")} {uploadProgress}%
                  </p>
                </div>
              ) : null}
            </div>

            <div>
              <label
                className="mb-2 block text-xs font-medium"
                htmlFor="existing-video"
              >
                {ui("Or select a saved video")}
              </label>
              <StudioSelect
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
                <option value="">{ui("No saved video selected")}</option>
                {videoAssets.map(asset => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </StudioSelect>
              <p className="mt-2 text-xs text-foreground/70">
                {ui("Choose a video from this brand’s Library.")}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <label
              className="mb-2 block text-xs font-medium"
              htmlFor="public-video-url"
            >
              {ui("Public HTTPS video URL")}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/70" />
              <input
                id="public-video-url"
                type="url"
                inputMode="url"
                value={publicUrl}
                onChange={event => {
                  setPublicUrl(event.target.value);
                  setSourceAsset(null);
                  invalidateSourceAuthorization();
                }}
                placeholder="https://cdn.example.com/video.mp4"
                className="w-full rounded-lg border border-border bg-background py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <p
              className={`mt-2 text-xs ${
                publicUrl && urlError ? "text-red-500" : "text-foreground/70"
              }`}
            >
              {publicUrl && urlError ? urlError : DIRECT_VIDEO_HELP}
            </p>
          </div>
        )}

        <label
          className="mt-5 block text-xs font-medium"
          htmlFor="analysis-direction"
        >
          {ui("Optional goal, audience or style")}
        </label>
        <textarea
          id="analysis-direction"
          value={focus}
          maxLength={2000}
          disabled={analyzing}
          onChange={event => {
            setFocus(event.target.value);
            invalidateSourceAuthorization();
          }}
          rows={2}
          placeholder={ui(
            "Leave blank to assess the form and purpose of the footage."
          )}
          className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm"
        />
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
                ? ui("Uploading source")
                : analysisStage || ui("Analyzing edit")}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {sourceAsset?.duration
                ? ui("Analyze video · {{credits}} credits", {
                    credits: analysisCreditCost,
                  })
                : ui("Prepare video · no credits")}
            </>
          )}
        </button>

        {analyzing ? (
          <button
            type="button"
            onClick={() => {
              controller.current?.abort();
              setAnalyzing(false);
              setAnalysisStage("");
            }}
            className="mt-2 w-full rounded-lg border border-border py-2 text-sm"
          >
            {ui("Cancel")}
          </button>
        ) : null}

        {notice ? (
          <p
            className="mt-3 rounded-lg bg-emerald-500/5 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400"
            role="status"
          >
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-red-500" role="alert">
            {typeof error === "string" ? error : ui(error.message)}
            {error instanceof PlatformApiError &&
            videoReviewFailureMessage(error.reason) ? (
              <span className="mt-1 block">
                {ui(videoReviewFailureMessage(error.reason)!)}
              </span>
            ) : null}
            {error instanceof PlatformApiError ? (
              <span className="mt-1 block break-words text-xs">
                {`HTTP ${error.status}`}
                {error.reference ? (
                  <>
                    {" "}
                    · {ui("Reference")}: {error.reference}
                  </>
                ) : null}
              </span>
            ) : null}
          </p>
        ) : null}
      </section>

      {!analyzing && !result && workspace.analyzerReports?.length ? (
        <section className="mb-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-medium">{ui("Saved analysis")}</h2>
          <div className="flex flex-wrap gap-2">
            {workspace.analyzerReports.map(report => {
              const asset = workspace.assets.find(
                item => item.id === report.assetId
              );
              return asset ? (
                <button
                  type="button"
                  key={`${report.assetId}-${report.platform}`}
                  onClick={() => void restoreReview(report)}
                  className="rounded-lg border border-border px-3 py-2 text-left text-xs hover:border-primary"
                >
                  <strong className="block">{asset.name}</strong>
                  <span className="text-foreground/60">
                    {report.platform} ·{" "}
                    {new Date(report.createdAt).toLocaleDateString()} ·{" "}
                    {ui("No AI credits")}
                  </span>
                </button>
              ) : null;
            })}
          </div>
        </section>
      ) : null}

      <AnimatePresence mode="wait">
        {result ? (
          <motion.div
            key="analysis-result"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {analyzedAsset && (
              <AnalyzerWorkspace
                key={analyzedAsset.id}
                asset={analyzedAsset}
                result={result}
                platform={platform}
                onCreateProject={createAnalyzedProject}
                initialAudience={
                  workspace.analyzerReports?.find(
                    report =>
                      report.assetId === analyzedAsset.id &&
                      report.platform === platform
                  )?.audience
                }
                onAudienceChange={saveAudienceResponse}
              />
            )}
            <section className="rounded-xl border border-border bg-surface p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="max-w-3xl">
                  <p className="mono-eyebrow mb-2 text-primary">
                    {ui("AI edit review")}
                  </p>
                  <h2 className="text-xl font-semibold">
                    {ui("Your editorial review")}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/65">
                    {result.summary}
                  </p>
                  <div className="mt-3">
                    <AiProvenanceBadge provenance={result.provenance} />
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-6">
              <section className="rounded-xl border border-border bg-surface p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 font-medium">
                    <WandSparkles className="h-4 w-4 text-primary" />
                    {ui("Actionable edit plan")}
                  </h2>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium uppercase tracking-wider text-primary">
                    {(result.recommendations?.length ?? 0) +
                      result.changes.length}{" "}
                    {ui("recommendations")}
                  </span>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {result.recommendations?.map(recommendation => (
                    <article
                      key={recommendation.id}
                      className="analysis-recommendation rounded-xl border border-border bg-background p-5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-xs text-primary">
                          {recommendation.start.toFixed(1)}s–
                          {recommendation.end.toFixed(1)}s
                        </span>
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {ui(recommendation.priority)}
                        </span>
                      </div>
                      <h3 className="mt-3 text-sm font-semibold">
                        {recommendation.label}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/65">
                        {recommendation.observation}
                      </p>
                      <p className="mt-3 text-sm font-medium leading-relaxed">
                        {recommendation.action}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-foreground/60">
                        {recommendation.reason}
                      </p>
                    </article>
                  ))}
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
                          <p className="mt-1 font-mono text-xs text-foreground/70">
                            {change.start.toFixed(1)}s–{change.end.toFixed(1)}s
                            · {ui(change.type)}
                          </p>
                        </div>
                        <span className="rounded-full bg-foreground/[0.06] px-2 py-1 text-xs text-foreground/70">
                          {confidencePercent(change.confidence)}
                          {ui("% confidence")}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-foreground/60">
                        {change.reason}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-wider text-foreground/70">
                        {ui(change.intensity)}{" "}
                        {ui("intensity · review before accepting")}
                      </p>
                    </article>
                  ))}
                  {result.changes.length === 0 ? (
                    <p className="rounded-lg border border-border bg-background p-4 text-xs text-foreground/70">
                      {result.noChangesReason ||
                        "The recommendations above require an editorial decision; no automatic timeline operation is proposed."}
                    </p>
                  ) : null}
                </div>

                {result.changes.length > 0 ? (
                  <div className="mt-5 border-t border-border pt-5">
                    {workspace.projects.some(project =>
                      project.clips.some(
                        clip => clip.assetId === analyzedAsset?.id
                      )
                    ) ? (
                      <>
                        <label
                          className="mb-2 block text-xs font-medium"
                          htmlFor="analysis-project"
                        >
                          {ui("Queue in project")}
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <StudioSelect
                            id="analysis-project"
                            value={selectedProjectId}
                            onChange={event => {
                              setSelectedProjectId(event.target.value);
                              setQueued(false);
                            }}
                            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                          >
                            <option value="">
                              {ui("Choose an edit project")}
                            </option>
                            {workspace.projects
                              .filter(project =>
                                project.clips.some(
                                  clip => clip.assetId === analyzedAsset?.id
                                )
                              )
                              .map(project => (
                                <option key={project.id} value={project.id}>
                                  {project.title}
                                </option>
                              ))}
                          </StudioSelect>
                          <button
                            type="button"
                            onClick={() => void queueChanges()}
                            disabled={!selectedProjectId || queued}
                            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-45"
                          >
                            {queued ? (
                              <>
                                <Check className="h-4 w-4" />
                                {ui("Queued")}
                              </>
                            ) : (
                              <>
                                {ui("Queue changes")}
                                <ChevronRight className="h-4 w-4" />
                              </>
                            )}
                          </button>
                        </div>
                        {queued && (
                          <Link
                            to={`/dashboard/edit?project=${encodeURIComponent(selectedProjectId)}`}
                            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                          >
                            {ui("Open in Edit")}{" "}
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        )}
                        <p className="mt-2 text-xs text-foreground/70">
                          {ui(
                            "Changes enter the editor as proposed operations. Only occurrences of this exact analyzed source are eligible. Source times follow each clip’s trim and speed; locked or ambiguous changes are held for a timeline decision."
                          )}
                        </p>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void createAnalyzedProject()}
                        disabled={creatingProject}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:opacity-40"
                      >
                        {creatingProject ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Film className="h-4 w-4" />
                        )}
                        {ui("Create edit project from this video")}
                      </button>
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
              {ui("Bring your short into focus")}
            </h2>
            <p className="mt-2 max-w-md text-sm text-foreground/70">
              {ui(
                "Upload or select a video to review its hook, pacing, captions, sound, and call to action."
              )}
            </p>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
