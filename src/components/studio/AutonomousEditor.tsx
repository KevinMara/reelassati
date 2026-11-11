import { sharedCatalogPlanningAssets } from "@contracts/shared-media-catalog";
import { resolveSharedCatalogAsset } from "@/lib/shared-media-catalog";
import {
  mergeCreditReceipt,
  type CreditReceipt,
} from "@contracts/credit-receipt";
import { normalizeEditorChatState } from "@contracts/editor-chat-state";
import { applyAutonomousCaptionTreatment } from "@contracts/editorial-captions";
import { preflightEditColorLuts } from "@/lib/catalog-color-lut-preflight";
import {
  resolveAutonomousSourceMetadata,
  mergeAutonomousSourceMetadata,
} from "@/lib/autonomous-source-metadata";
import {
  autonomousReceiptReview,
  autonomousResultReceipt,
} from "@/lib/autonomous-result-receipt";
import {
  autonomousCreditEstimate,
  autonomousSourceReviewCost,
} from "@/lib/autonomous-credit-estimate";
import { activeEditorProjects, editorRunKey } from "@/lib/editor-run-lock";
import { ConciseResponse } from "./ConciseResponse";
import { editPlanQualityAssets } from "@contracts/edit-plan-quality";
import { buildEditPlanningContext } from "@contracts/edit-planning-context";
import {
  reviewAppliedEditorialCoverage,
  type EditorialCoverageReview,
} from "@contracts/editorial-coverage";
import { resolveChatCatalogAudio } from "@/lib/editor-chat-catalog-audio";
import { StudioSelect } from "@/components/ui/studio-select";
import { getUiLocale, useUiText } from "@/lib/i18n/ui";
import { v4 as createUuid } from "uuid";
import { publishAutonomousSteps } from "@/lib/autonomous-live-publish";
import {
  autonomousPlanCacheKey,
  autonomousQuoteKey,
  createAutonomousPlanCache,
  type AutonomousPlanResult,
} from "@/lib/autonomous-plan-cache";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  createAutonomousPreparationCache,
  prepareAutonomousSources,
} from "@/lib/autonomous-preparation";
import {
  EDIT_RECIPES,
  auditAutomatedEdit,
  trimObservedEnding,
  AUTOMATIC_EDIT_DIRECTION,
} from "@/lib/editor-production";
import { ReferenceStylePanel } from "./ReferenceStylePanel";
import { EditStyleTemplates } from "./EditStyleTemplates";
import { editStyleSourceAssetIds } from "@contracts/edit-style-template";
import {
  pendingStyleExampleAssets,
  saveStyleExampleReview,
} from "@/lib/style-example-preparation";
import { VIDEO_ANALYSIS_SCHEMA_VERSION } from "@contracts/video-analysis";
import { editorFailureMessage } from "@contracts/editor-errors";
import {
  eligibleAnalyzerOptimization,
  checkpointAnalyzerReport,
  type SavedAnalyzerReport,
} from "@contracts/analyzer-report";
import { useEffect, useRef, useState } from "react";
import { workspaceSaveError } from "@/lib/workspace-save-error";
import { AlertCircle, Loader2, Sparkles, Square } from "lucide-react";
import type {
  Asset,
  EditOperation,
  EditProject,
  WorkspaceDocument,
} from "@contracts/workspace";
import { AI_CREDIT_COSTS, timedCreditCost } from "@contracts/billing";
import { useWorkspace } from "@/providers/workspace";
import {
  captureUploadRequestScope,
  platformApi,
  verifyUploadRequestScope,
} from "@/lib/platform-api";
import { selectedBrand } from "@/lib/workspace-scope";
import { assertAutonomousRunCurrent } from "@/lib/autonomous-run";
import { contentDuration } from "@/lib/edit-timeline";
import {
  editDurationDirection,
  resolveEditDurationTarget,
} from "@/lib/edit-duration-target";
import {
  executeAutonomousPlan,
  assertAutonomousMediaBudget,
  preflightAutonomousPlan,
} from "@/lib/autonomous-execution";

export function AutonomousEditor({
  project,
  onFinished,
  open,
  onOpenChange,
  onBusyChange,
  activityHost,
}: {
  activityHost: HTMLElement | null;
  onBusyChange: (busy: boolean) => void;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  project: EditProject;
  onFinished: (summary: string) => void;
}) {
  const ui = useUiText();
  const { workspace, getWorkspaceSnapshot, updateWorkspace, capabilities } =
    useWorkspace();
  const referenceOwner = workspace.profile.email.toLowerCase();
  const referenceBrand = selectedBrand(referenceOwner);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const runKey = editorRunKey(referenceOwner, referenceBrand, project.id);
  const model = "moonshotai/kimi-k3" as const;
  const [style, setStyle] = useState(
    () =>
      eligibleAnalyzerOptimization(
        project.analyzerOptimization,
        workspace.assets.filter(asset =>
          project.clips.some(clip => clip.assetId === asset.id)
        )
      )?.brief ??
      new URLSearchParams(window.location.search).get("style") ??
      ""
  );
  const [referenceBrief, setReferenceBrief] = useState(
    project.editStyleTemplate ? "" : (project.referenceStyleBrief ?? "")
  );
  const [matchMode, setMatchMode] = useState<"style" | "reference" | null>(
    project.editStyleTemplate
      ? "style"
      : project.referenceStyleBrief
        ? "reference"
        : null
  );
  const [matching, setMatching] = useState(false);
  async function chooseMatch(mode: "style" | "reference" | null) {
    if (busy || matching) return;
    setMatchMode(mode);
    if (mode === "style") setReferenceBrief("");
    setMatching(true);
    try {
      await updateWorkspace(w => ({
        ...w,
        projects: w.projects.map(p =>
          p.id === project.id
            ? {
                ...p,
                ...(mode === "reference"
                  ? { editStyleTemplate: undefined }
                  : {}),
                ...(mode === "style" ? { referenceStyleBrief: undefined } : {}),
              }
            : p
        ),
      }));
    } finally {
      setMatching(false);
    }
  }
  const [durationMode, setDurationMode] = useState<"none" | "range">("none");
  const [minimumDuration, setMinimumDuration] = useState(() =>
    String(
      project.duration > 0 ? Number((project.duration / 2).toPrecision(3)) : 15
    )
  );
  const [maximumDuration, setMaximumDuration] = useState(() =>
    String(project.duration > 0 ? Number(project.duration.toPrecision(3)) : 60)
  );
  const [automaticDuration, setAutomaticDuration] = useState(true);
  const durationTarget = resolveEditDurationTarget(
    durationMode,
    minimumDuration,
    maximumDuration
  );
  const [savedQuote, setQuote] = useState<{
    key: string;
    cacheKey: string;
    minimum: number;
    maximum: number;
    images: number;
    videos: number;
  }>();
  const [optionsPanel, setOptionsPanel] = useState<
    "presets" | "options" | null
  >(null);
  const [captions, setCaptions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [finished, setFinished] = useState(false);
  const [failure, setFailure] = useState("");
  const [stage, setStage] = useState("");
  const preparationCache = useRef(createAutonomousPreparationCache());
  const [planCache] = useState(createAutonomousPlanCache);
  const stopped = useRef(false);
  const runController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    const cache = planCache;
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopped.current = true;
      runController.current?.abort();
      cache.clear();
    };
  }, [planCache]);
  useEffect(() => {
    const cache = planCache;
    return () => {
      runController.current?.abort();
      cache.clear();
    };
  }, [referenceOwner, referenceBrand, project.id, planCache]);
  const sources = workspace.assets.filter(
    a =>
      project.clips.some(c => c.assetId === a.id) &&
      (a.kind === "video" || a.kind === "audio")
  );
  const analysisCost = autonomousSourceReviewCost(
    sources,
    project.platform,
    workspace.analyzerReports
  );
  const transcriptCost = 0;
  const unreviewedExamples =
    project.editStyleTemplate?.examples?.filter(
      example =>
        example.source === "reference" &&
        !example.profile &&
        example.feedback !== "exclude"
    ) ?? [];
  const styleExampleCost = unreviewedExamples.reduce(
    (sum, example) =>
      sum +
      timedCreditCost(
        workspace.assets.find(asset => asset.id === example.assetId)?.duration,
        AI_CREDIT_COSTS.videoAnalysisPerMinute
      ),
    0
  );
  const preparationCost =
    AI_CREDIT_COSTS.editPlan + analysisCost + transcriptCost + styleExampleCost;
  // Saves and playhead changes must not invalidate an estimate. Editing inputs do.
  const cacheOptions = {
    model,
    effort: "max",
    stock: true,
    style,
    referenceBrief,
    durationMode,
    minimumDuration,
    maximumDuration,
    automaticDuration,
    captions,
    media: "plan-directed",
  };
  const quoteKey = autonomousPlanCacheKey({
    scope: {
      ownerId: referenceOwner,
      ownerEmail: referenceOwner,
      brandId: referenceBrand,
    },
    project,
    assets: workspace.assets,
    brandKit: workspace.brandKit,
    savedReports: workspace.analyzerReports,
    contentLanguage: workspace.profile.contentLanguage,
    uiLocale: getUiLocale(),
    options: cacheOptions,
  });
  const quote = savedQuote?.key === quoteKey ? savedQuote : undefined;
  const estimatePreparationCost =
    quote && planCache.has(quote.cacheKey) ? 0 : preparationCost;
  const ready =
    capabilities.ai &&
    capabilities.editPlanTransportVersion === "foreground-v1" &&
    capabilities.editingModel === "moonshotai/kimi-k3" &&
    ((!sources.some(a => a.kind === "video") && !unreviewedExamples.length) ||
      (capabilities.analysis &&
        capabilities.analysisTransportVersion === "foreground-v1" &&
        capabilities.analysisSchemaVersion ===
          VIDEO_ANALYSIS_SCHEMA_VERSION)) &&
    (!transcriptCost || capabilities.transcription);

  async function run(quoteOnly = false) {
    if (matching || activeEditorProjects.has(runKey) || runController.current)
      return;
    // Validate before scope capture, paid preparation, or any provider request.
    if (!durationTarget) {
      setFailure(
        ui(
          "Enter a minimum and maximum greater than zero, with the maximum above the minimum."
        )
      );
      return;
    }
    activeEditorProjects.add(runKey);
    stopped.current = false;
    const controller = new AbortController();
    runController.current = controller;
    const signal = controller.signal;
    const destination = {
      ownerEmail: referenceOwner,
      brandId: referenceBrand,
      projectId: project.id,
    };
    setBusy(true);
    onBusyChange(true);
    setCompletedSteps([]);
    if (!quoteOnly) onOpenChange(false);
    setFinished(false);
    setFailure("");
    setStage(ui("Review"));
    setStatus("Examining your footage…");
    const checkpoint = (
      current: WorkspaceDocument = getWorkspaceSnapshot()
    ) => {
      assertAutonomousRunCurrent(
        destination,
        {
          ownerEmail: current.profile.email.toLowerCase(),
          brandId: selectedBrand(current.profile.email.toLowerCase()),
          projectId: project.id,
          projectExists: current.projects.some(p => p.id === project.id),
        },
        signal
      );
    };
    const progress = (stage: string) => {
      if (!signal.aborted && mounted.current) setStatus(stage);
    };
    let working: EditProject = structuredClone(project);
    const generatedAssets: Asset[] = [];
    const resolvedMedia = new Map<string, string>();
    let timelineSaveStarted = false;
    const messageId = createUuid();
    const inputMessage = {
      id: `${messageId}-input`,
      role: "user" as const,
      text: quoteOnly ? ui("Estimate credits") : ui("AI auto-edit"),
      createdAt: new Date().toISOString(),
      inputDetails: [
        {
          label: ui("Describe the style and outcome"),
          value: style.trim() || ui("Automatic"),
        },
        {
          label: ui("Style"),
          value: project.editStyleTemplate?.name || ui("No style"),
        },
        { label: ui("Reference"), value: referenceBrief || ui("None") },
        {
          label: ui("Edit duration"),
          value:
            durationMode === "range"
              ? `${minimumDuration}–${maximumDuration} s`
              : ui("No target duration"),
        },
        {
          label: ui("Detect ending from content automatically"),
          value: ui(automaticDuration ? "On" : "Off"),
        },
        {
          label: ui("Transcribe and caption footage"),
          value: ui(captions ? "On" : "Off"),
        },
        {
          label: ui("Footage"),
          value: sources.map(source => source.name).join("\n"),
        },
      ],
    };
    let receipts: CreditReceipt[] = [];
    let receiptsComplete = true;
    const savedSteps: string[] = [];
    const saveActivity = async (
      text: string,
      state:
        "running" | "ready" | "completed" | "partial" | "failed" | "stopped",
      appliedTypes?: EditOperation["type"][],
      planSummary?: string,
      notices?: string[],
      editorialNotes?: import("@contracts/editorial-notes").EditorialNote[],
      editorialCoverage?: EditorialCoverageReview
    ) => {
      await updateWorkspace(current => {
        // Stop may abort the provider request, while its final visible status still needs saving.
        if (
          current.profile.email.toLowerCase() !== destination.ownerEmail ||
          selectedBrand(destination.ownerEmail) !== destination.brandId
        )
          return current;
        return {
          ...current,
          projects: current.projects.map(p => {
            if (p.id !== project.id) return p;
            const chat = normalizeEditorChatState(p.editorChat) ?? {
              mode: "ask" as const,
              maxCredits: 200,
              preferencesVersion: 2,
              messages: [],
            };
            const previous = chat.messages.find(
              message => message.id === messageId
            );
            const message = {
              ...previous,
              id: messageId,
              role: "assistant" as const,
              text,
              status: state,
              createdAt: previous?.createdAt ?? new Date().toISOString(),
              activity: {
                kind: "auto-edit" as const,
                steps: [...savedSteps],
                ...(appliedTypes
                  ? { appliedTypes: [...new Set(appliedTypes)] }
                  : {}),
                ...(planSummary ? { planSummary } : {}),
                ...(notices?.length ? { notices } : {}),
                ...(editorialNotes?.length ? { editorialNotes } : {}),
                ...(editorialCoverage ? { editorialCoverage } : {}),
              },
              creditReceipts: receipts,
              creditReceiptsComplete:
                state === "running" ? false : receiptsComplete,
            };
            return {
              ...p,
              editorChat: {
                ...chat,
                messages: [
                  ...chat.messages.filter(item => item.id !== messageId),
                  ...(chat.messages.some(item => item.id === inputMessage.id)
                    ? []
                    : [inputMessage]),
                  message,
                ].slice(-60),
              },
            };
          }),
        };
      });
    };
    const onCreditReceipt = (receipt: CreditReceipt | undefined) => {
      if (receipt) receipts = mergeCreditReceipt(receipts, receipt);
      else receiptsComplete = false;
    };
    try {
      await saveActivity(ui("Building your edit"), "running");
      checkpoint();
      if (!ready)
        throw new Error(
          ui(
            "The video review is incomplete. Please refresh before analyzing again."
          )
        );
      const scope = await captureUploadRequestScope();
      checkpoint();
      if (
        scope.ownerEmail !== destination.ownerEmail ||
        scope.brandId !== destination.brandId
      )
        throw new Error(
          ui(
            "Your account or brand changed before the edit started. Reopen the intended workspace."
          )
        );
      const requestOptions = { scope, signal, onCreditReceipt };
      const measuredSources = await resolveAutonomousSourceMetadata(
        project,
        workspace.assets,
        signal
      );
      checkpoint();
      const runWorkspace = {
        ...workspace,
        assets: mergeAutonomousSourceMetadata(
          workspace.assets,
          measuredSources
        ),
      };
      if (measuredSources.length) {
        await updateWorkspace(current => {
          checkpoint(current);
          return {
            ...current,
            assets: mergeAutonomousSourceMetadata(
              current.assets,
              measuredSources
            ),
          };
        });
        checkpoint();
      }
      const pendingStyleExamples = pendingStyleExampleAssets(
        project.editStyleTemplate,
        runWorkspace.assets
      );
      const keyFor = (current: WorkspaceDocument, base: EditProject) =>
        autonomousPlanCacheKey({
          scope,
          project: base,
          assets: current.assets,
          brandKit: current.brandKit,
          savedReports: current.analyzerReports,
          contentLanguage: current.profile.contentLanguage,
          uiLocale: getUiLocale(),
          options: cacheOptions,
        });
      let expectedReports = workspace.analyzerReports;
      let expectedProject = project;
      let cacheKey = keyFor(runWorkspace, project);
      const inputsStillCurrent = () => {
        const current = getWorkspaceSnapshot();
        const base = current.projects.find(p => p.id === project.id);
        return Boolean(base && keyFor(current, base) === cacheKey);
      };
      const cached = planCache.read(cacheKey);
      let result: AutonomousPlanResult;
      if (cached && inputsStillCurrent()) {
        working = cached.working;
        result = cached.result;
      } else {
        planCache.clear();
        const prepared = await prepareAutonomousSources({
          project,
          sources: sources.map(source =>
            runWorkspace.assets.find(asset => asset.id === source.id)!
          ),
          captions,
          speechTiming: true,
          context: JSON.stringify([
            destination,
            workspace.profile.contentLanguage,
            getUiLocale(),
          ]),
          cache: preparationCache.current,
          runId: messageId,
          savedReports: workspace.analyzerReports,
          checkpoint,
          review: async asset => {
            setStage(ui("Review"));
            setStatus(`Reviewing ${asset.name}…`);
            const { analyzeMedia } = await import("@/lib/analyze-media");
            checkpoint();
            const review = await analyzeMedia(
              asset,
              project.platform,
              "Establish source-clock spatial evidence for the full retained footage: protect faces, existing captions/text and meaningful demonstrations with conservative time-bounded regions; transcribe exact readable labels into observedText. Return review.visualProtection with truthful reviewedRanges and coverage. This review prepares editable graphics; do not replace missing layout evidence with general editing advice, and keep unobserved areas unknown.",
              progress,
              signal,
              scope,
              getUiLocale(),
              false,
              onCreditReceipt
            );
            checkpoint();
            const report: SavedAnalyzerReport = {
              assetId: asset.id,
              duration: asset.duration!,
              platform: project.platform,
              createdAt: new Date().toISOString(),
              result: {
                ...review,
                schemaVersion: VIDEO_ANALYSIS_SCHEMA_VERSION,
                insights: review.insights ?? [],
              },
            };
            // Persist paid preparation now, before transcription or planning.
            // A later failure, navigation or reload must not repurchase it.
            await updateWorkspace(current => {
              checkpoint(current);
              return {
                ...current,
                analyzerReports: checkpointAnalyzerReport(
                  current.analyzerReports,
                  report
                ),
              };
            });
            // Account only for our own evidence checkpoint. Concurrent timeline,
            // library or report edits must still invalidate the prepared plan.
            expectedReports = checkpointAnalyzerReport(expectedReports, report);
            cacheKey = keyFor(
              { ...runWorkspace, analyzerReports: expectedReports },
              expectedProject
            );
            return review;
          },
          transcribe: async asset => {
            setStage(ui("Captions"));
            setStatus(`Transcribing ${asset.name}…`);
            const { transcribeMediaLocally } =
              await import("@/lib/local-transcription");
            checkpoint();
            return transcribeMediaLocally(
              asset,
              undefined,
              project.id,
              progress,
              signal,
              scope
            );
          },
        });
        working = prepared.working;
        for (const { example, asset } of pendingStyleExamples) {
          checkpoint();
          setStage(ui("Style examples"));
          setStatus(`Reviewing ${asset.name}…`);
          const { analyzeMedia } = await import("@/lib/analyze-media");
          const review = await analyzeMedia(
            asset,
            project.platform,
            "Observe only the reusable editing style: pacing, framing, color, motion, transitions, caption treatment, graphic density and sound role. Keep unknown traits unknown. Never include source dialogue, names, claims or facts in the style profile.",
            progress,
            signal,
            scope,
            getUiLocale(),
            true,
            onCreditReceipt
          );
          checkpoint();
          const expected = working.editStyleTemplate!;
          const saved = await updateWorkspace(current => {
            checkpoint(current);
            return saveStyleExampleReview(
              current,
              project.id,
              expected,
              example.id,
              review.editingStyle
            );
          });
          checkpoint();
          working.editStyleTemplate = structuredClone(
            saved.projects.find(item => item.id === project.id)!
              .editStyleTemplate
          );
          expectedProject = {
            ...expectedProject,
            editStyleTemplate: working.editStyleTemplate,
          };
          cacheKey = keyFor(
            { ...runWorkspace, analyzerReports: expectedReports },
            expectedProject
          );
        }
        const styleSourceIds = editStyleSourceAssetIds(
          working.editStyleTemplate
        );
        const blueprint = working.editStyleTemplate?.blueprint;
        if (blueprint) {
          working.aspectRatio = blueprint.aspectRatio;
          working.frameRate = blueprint.frameRate;
        }
        const captionTreatment = blueprint?.captionStyle
          ? {
              preset: blueprint.captionStyle,
              appearance: blueprint.captionAppearance,
            }
          : working.editStyleTemplate?.profile.captionTreatment;
        if (
          captionTreatment &&
          !working.sourceReviews?.some(r => r.captions === "present")
        ) {
          working.captionStyle = captionTreatment.preset;
          working.captionAppearance = structuredClone(
            captionTreatment.appearance
          );
        }
        const analysis = prepared.analysis;
        checkpoint();
        if (automaticDuration)
          working = trimObservedEnding(working, runWorkspace.assets);
        const durationDirection = editDurationDirection(
          durationTarget,
          automaticDuration
        );
        setStatus("Building the cut, pacing, captions, and visual treatment…");
        setStage(ui("Edit plan"));
        result = await platformApi.generateEditPlan(
          {
            project: working,
            command: `AUTONOMOUS COMPLETE EDIT. Style: ${style.trim() || AUTOMATIC_EDIT_DIRECTION}. Reference style evidence: ${referenceBrief || "No reference supplied"}. ${durationDirection} Brand: ${workspace.brandKit.name}; voice: ${workspace.brandKit.voice}; audience: ${workspace.brandKit.audience}. Observation intervals below use SOURCE timestamps; map them through each clip inPoint/start/speed before editing. Footage observations: ${JSON.stringify(analysis)}. Existing library: ${JSON.stringify(runWorkspace.assets.filter(a => !styleSourceIds.has(a.id) || working.clips.some(clip => clip.assetId === a.id)).map(a => ({ id: a.id, name: a.name, kind: a.kind, duration: a.duration })))}. Build the story form that fits this footage and brief; deliver its opening promise and meaningful ending without forcing an advertising structure. Remove only evidenced dead space, preserve speech meaning and all locked clips. ${captions ? "Use existing/transcribed words for captions; never fabricate spoken dialogue." : "Do not add captions."} Use editable graphic operations for motivated text, callouts, counters, arrows and highlights. Keep them clear of faces and existing source captions. Do not duplicate burned-in captions. Reuse appropriate library media. Choose the number of supporting images and video shots from the story and actual coverage gaps; there is no per-edit image, video, or credit cap. Use broll operations with parameters.prompt and parameters.mediaKind. Each generated image is 1K and each generated video is 5 seconds; fit the requested insert to its usable length. Prefer relevant licensed stock or owned footage when it achieves the intended picture. Generated extras are authorized. Mark a generated shot parameters.optional=true only if the core story remains complete without it; required coverage is optional=false. This distinction informs the estimate, never a media quota. Do not add decorative filler just to spend credits. No new voiceover or unpriced generation. For audio, duck existing music under speech. Include executable parameters for every operation.`,
            model,
            stock: true,
            captionStyling: captions,
            contentReview: true,
            graphicRequest: style.startsWith("ANALYZER OPTIMIZATION BRIEF")
              ? ""
              : style,
            effort: "max",
            selectedClipIds: [],
            range: { start: 0, end: working.duration },
          },
          requestOptions
        );
        checkpoint();
        if (inputsStillCurrent()) planCache.write(cacheKey, working, result);
      }
      checkpoint();
      if (captions)
        working = applyAutonomousCaptionTreatment(
          working,
          result.captionTreatment
        );
      const preparationCategories: Array<{ type: "trim" | "caption" }> = [];
      if (JSON.stringify(working.clips) !== JSON.stringify(project.clips))
        preparationCategories.push({ type: "trim" });
      if (
        JSON.stringify([
          working.transcript,
          working.captionStyle,
          working.captionAppearance,
        ]) !==
        JSON.stringify([
          project.transcript,
          project.captionStyle,
          project.captionAppearance,
        ])
      )
        preparationCategories.push({ type: "caption" });
      assertAutonomousMediaBudget(result.changes);
      let changesToApply = result.changes.filter(
        op =>
          op.type !== "caption" ||
          (captions &&
            !project.clips.some(
              c =>
                c.start < op.end &&
                c.start + c.duration > op.start &&
                working.sourceReviews?.some(
                  r => r.assetId === c.assetId && r.captions === "present"
                )
            ))
      );
      const graphicReview = preflightAutonomousPlan(
        working,
        changesToApply,
        editPlanQualityAssets(
          [
            ...runWorkspace.assets,
            ...sharedCatalogPlanningAssets(result.sharedCatalog ?? []),
          ],
          result.stockMedia ?? []
        ),
        checkpoint,
        // Analyzer optimization contains generated recommendations, not a
        // verbatim human instruction to add or cover source text.
        {
          request: style.startsWith("ANALYZER OPTIMIZATION BRIEF") ? "" : style,
        }
      );
      changesToApply = graphicReview.changes;
      await preflightEditColorLuts(changesToApply, signal);
      checkpoint();
      const editorialCoverage = reviewAppliedEditorialCoverage(
        result.editorialCoverage,
        working,
        buildEditPlanningContext(working, runWorkspace.assets),
        changesToApply,
        [
          ...runWorkspace.assets,
          ...sharedCatalogPlanningAssets(result.sharedCatalog ?? []),
        ]
      );
      const receiptReview = autonomousReceiptReview(
        graphicReview,
        result.qualityReview?.withdrawn
      );
      // A fresh user-initiated run must not reuse a proposal that still failed
      // actual execution checks (including an older server response).
      if (graphicReview.omitted.length || graphicReview.omittedSounds?.length)
        planCache.clear();
      // Price the validated execution plan. An invalid draft must never be
      // presented as ready, and omitted operations must not buy unused media.
      const estimate = autonomousCreditEstimate(
        changesToApply,
        preparationCost
      );
      const { images, videos } = estimate;
      setQuote({
        cacheKey,
        key: autonomousQuoteKey(cacheKey),
        ...estimate,
      });
      if (quoteOnly) {
        const previewReceipt = autonomousResultReceipt(
          "",
          [],
          receiptReview,
          ui,
          editorialCoverage,
          result.stockReview
        );
        const previewStatus =
          previewReceipt.status === "partial"
            ? previewReceipt.details.join(" ")
            : ui("Your edit plan is ready.");
        await saveActivity(
          previewStatus,
          "ready",
          undefined,
          result.summary,
          previewReceipt.details,
          result.editorialNotes,
          editorialCoverage
        );
        setStatus(previewStatus);
        return;
      }
      // Recovery covers local validation only, not already-started media jobs
      // or partially published timelines that need their own execution ledger.
      planCache.clear();
      working.proposedChanges = [
        ...working.proposedChanges.filter(c => c.status !== "proposed"),
        ...result.changes,
      ];
      for (const item of result.stockMedia ?? []) {
        checkpoint();
        setStage(ui("Supporting shots"));
        setStatus(`Importing licensed stock · ${item.title}`);
        let asset = await platformApi.importStock(item, signal, scope);
        if (asset.kind === "video") {
          const { resolveVideoMetadata } = await import("@/lib/media-metadata");
          asset = await resolveVideoMetadata(
            {
              ...asset,
              duration: undefined,
              width: undefined,
              height: undefined,
            },
            signal
          );
        }
        checkpoint();
        generatedAssets.push(asset);
        for (const op of changesToApply)
          if (op.parameters?.assetId === `stock:${item.provider}:${item.id}`)
            resolvedMedia.set(op.id, asset.id);
        await updateWorkspace(w => {
          checkpoint(w);
          return {
            ...w,
            assets: [asset, ...w.assets.filter(a => a.id !== asset.id)],
          };
        });
      }
      for (const op of changesToApply) {
        const id = op.parameters?.assetId;
        if (!id?.startsWith("shared:")) continue;
        const item = result.sharedCatalog?.find(
          item => `shared:${item.id}` === id
        );
        if (!item)
          throw new Error(
            "This shared catalog selection is not available in the verified plan."
          );
        checkpoint();
        setStatus(`Adding catalog media · ${item.name}`);
        const asset = await resolveSharedCatalogAsset(
          item.id,
          [...runWorkspace.assets, ...generatedAssets],
          signal
        );
        checkpoint();
        generatedAssets.push(asset);
        resolvedMedia.set(op.id, asset.id);
        await updateWorkspace(w => {
          checkpoint(w);
          return {
            ...w,
            assets: [asset, ...w.assets.filter(a => a.id !== asset.id)],
          };
        });
      }
      for (const op of changesToApply.filter(op => op.type === "sound")) {
        const id = op.parameters?.assetId;
        if (!id?.startsWith("catalog:")) continue;
        setStage(ui("Sound"));
        setStatus(`Adding free sound · ${op.label}`);
        const asset = await resolveChatCatalogAudio(
          id.slice(8),
          [...runWorkspace.assets, ...generatedAssets],
          file =>
            platformApi.uploadAsset(
              file,
              "audio",
              undefined,
              undefined,
              requestOptions
            ),
          (url, init) =>
            fetch(url, {
              ...init,
              signal: init?.signal
                ? AbortSignal.any([signal, init.signal])
                : signal,
            })
        );
        checkpoint();
        generatedAssets.push(asset);
        resolvedMedia.set(op.id, asset.id);
        await updateWorkspace(w => {
          checkpoint(w);
          return {
            ...w,
            assets: [asset, ...w.assets.filter(a => a.id !== asset.id)],
          };
        });
      }
      let imagesUsed = 0;
      let videosUsed = 0;
      for (const op of changesToApply) {
        checkpoint();
        if (
          op.type !== "broll" ||
          op.parameters?.assetId ||
          !op.parameters?.prompt
        )
          continue;
        let asset: Asset | undefined;
        if (op.parameters.mediaKind === "video" && videosUsed < videos) {
          videosUsed++;
          setStatus(`Generating supporting video ${videosUsed}/${videos}…`);
          const created = await platformApi.createVideo(
            {
              requestId: createUuid(),
              assetName: op.label,
              prompt: op.parameters.prompt,
              duration: 5,
              aspectRatio: project.aspectRatio,
              resolution: "720p",
              generateAudio: false,
              projectId: project.id,
              rightsConfirmed: true,
              referenceContainsRealPerson: false,
              realPersonConsentConfirmed: false,
            },
            requestOptions
          );
          checkpoint();
          const deadline = Date.now() + 20 * 60_000;
          while (!asset && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            checkpoint();
            const polled = await platformApi.videoJob(
              created.job.id,
              requestOptions
            );
            checkpoint();
            if (polled.job.status === "failed")
              throw new Error(
                ui(
                  "A supporting video failed. Completed assets are saved; retry from your Library."
                )
              );
            asset = polled.asset;
          }
          if (!asset)
            throw new Error(
              ui(
                "The video is still generating. It will remain available in your Library; your timeline is unchanged."
              )
            );
        } else if (op.parameters.mediaKind !== "video" && imagesUsed < images) {
          imagesUsed++;
          setStatus(`Generating supporting image ${imagesUsed}/${images}…`);
          asset = await platformApi.generateImage(
            {
              requestId: createUuid(),
              prompt: op.parameters.prompt,
              assetName: op.label,
              aspectRatio: project.aspectRatio,
              resolution: "1K",
              rightsConfirmed: true,
              referenceContainsRealPerson: false,
              realPersonConsentConfirmed: false,
            },
            requestOptions
          );
          checkpoint();
        }
        if (asset) {
          generatedAssets.push(asset);
          // Keep the signed AI recommendation immutable; resolve assets only at execution.
          await verifyUploadRequestScope(scope);
          checkpoint();
          await updateWorkspace(w => {
            checkpoint(w);
            return {
              ...w,
              assets: [...w.assets.filter(a => a.id !== asset!.id), asset!],
            };
          });
          checkpoint();
          resolvedMedia.set(op.id, asset.id);
        }
      }
      checkpoint();
      setStatus("Applying the edit to your timeline…");
      setStage(ui("Timeline"));
      const allAssets = [...runWorkspace.assets, ...generatedAssets];
      const executable = changesToApply.map(op =>
        resolvedMedia.has(op.id)
          ? {
              ...op,
              parameters: {
                ...op.parameters,
                assetId: resolvedMedia.get(op.id),
              },
            }
          : op
      );
      const steps: Array<{ label: string; project: EditProject }> = [];
      const appliedOperations: Array<Pick<EditOperation, "type">> = [];
      working = executeAutonomousPlan(
        working,
        executable,
        allAssets,
        checkpoint,
        (snapshot, operation) => {
          steps.push({ label: operation.label, project: snapshot });
          appliedOperations.push({ type: operation.type });
        }
      );
      const problems = auditAutomatedEdit(project, working, allAssets);
      if (problems.length)
        throw new Error(
          `The AI edit needs correction: ${problems.slice(0, 3).join("; ")}. Your original timeline is intact.`
        );
      working.duration = contentDuration(working.clips);
      working.playhead = Math.min(working.playhead ?? 0, working.duration);
      checkpoint();
      await verifyUploadRequestScope(scope);
      checkpoint();
      timelineSaveStarted = true;
      working.lastCommand = style.trim() || AUTOMATIC_EDIT_DIRECTION;
      const receipt = autonomousResultReceipt(
        result.summary,
        [...appliedOperations, ...preparationCategories],
        receiptReview,
        ui,
        editorialCoverage,
        result.stockReview
      );
      steps.push({
        label:
          receipt.status === "partial"
            ? ui("Partial edit saved.")
            : "Saved the finished edit",
        project: working,
      });
      await publishAutonomousSteps({
        original: project,
        steps,
        update: updateWorkspace,
        checkpoint,
        onStep: label => {
          savedSteps.push(label);
          setCompletedSteps([...savedSteps]);
          setStatus(label);
        },
      });
      checkpoint();
      planCache.clear();
      setCompletedSteps([...savedSteps]);
      await saveActivity(
        receipt.summary,
        receipt.status,
        [...appliedOperations, ...preparationCategories].map(
          operation => operation.type
        ),
        receipt.planSummary,
        receipt.details,
        result.editorialNotes,
        editorialCoverage
      );
      setFinished(true);
      setStatus(receipt.summary);
      onFinished(receipt.summary);
    } catch (e) {
      if (signal.aborted) planCache.clear();
      if (!mounted.current || runController.current !== controller) return;
      const failureText = signal.aborted
        ? `Stopped. Provider work already submitted may still finish in your Library; no further steps will start. ${timelineSaveStarted ? "The timeline save had already started; review your project and use Undo if needed." : "Your original timeline is intact."}`
        : ui(editorFailureMessage(e));
      setFailure(failureText);
      await saveActivity(
        failureText,
        signal.aborted ? "stopped" : "failed"
      ).catch(() => undefined);
      setStatus("");
    } finally {
      activeEditorProjects.delete(runKey);
      if (runController.current === controller) {
        runController.current = null;
        if (mounted.current) {
          setBusy(false);
          onBusyChange(false);
        }
      }
    }
  }
  const activity = busy && !finished && !failure && (
    <section
      aria-label={ui("Auto-edit activity")}
      className="reel-activity space-y-3 py-3"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        {busy && <Loader2 size={14} className="animate-spin" />}
        {ui(
          busy ? "Building your edit" : finished ? "Edit ready" : "Edit paused"
        )}
      </p>
      <div role="status" aria-live="polite">
        <ConciseResponse text={failure || ui(status)} />
      </div>
      {!!completedSteps.length && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {completedSteps.length} {ui("steps")}
          </summary>
          <ol className="mt-2 space-y-2 border-l border-border pl-3">
            {completedSteps.map((label, index) => (
              <li key={index}>✓ {label}</li>
            ))}
          </ol>
        </details>
      )}
      {busy ? (
        <button
          type="button"
          onClick={() => {
            stopped.current = true;
            runController.current?.abort();
          }}
          className="flex items-center gap-2 text-xs"
        >
          <Square size={12} />
          {ui("Stop remaining steps")}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => (finished ? setFinished(false) : onOpenChange(true))}
          className="text-xs text-primary"
        >
          {ui(finished ? "Close" : "Review options")}
        </button>
      )}
    </section>
  );
  return (
    <>
      {activityHost && activity && createPortal(activity, activityHost)}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="auto-edit-dialog max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle>{ui("Auto-edit")}</DialogTitle>
          <DialogDescription className="-mt-3 text-xs">
            {ui(
              "AI edits your footage using your reference, style or direction."
            )}
          </DialogDescription>
          <section className="space-y-4">
            <div className="grid gap-5">
              <div>
                <details
                  open={matchMode === "style"}
                  className="auto-edit-template mb-3 rounded-xl border border-sky-400/25 bg-sky-400/5 p-3"
                >
                  <summary
                    onClick={event => {
                      event.preventDefault();
                      void chooseMatch(
                        matchMode === "style" ? null : "style"
                      ).catch(() => undefined);
                    }}
                    className="cursor-pointer text-xs font-semibold"
                  >
                    {ui("Match a style")}
                  </summary>
                  <div className="mt-3">
                    <EditStyleTemplates
                      project={project}
                      disabled={busy || matching}
                      onSelect={() => setReferenceBrief("")}
                      compact
                    />
                  </div>
                </details>
                <div className="auto-edit-reference mb-4 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1">
                  <div>
                    {" "}
                    <ReferenceStylePanel
                      key={`${project.id}-${Boolean(project.editStyleTemplate)}`}
                      projectId={project.id}
                      open={matchMode === "reference"}
                      onOpenChange={next =>
                        void chooseMatch(next ? "reference" : null).catch(
                          () => undefined
                        )
                      }
                      onChange={brief => {
                        const current = getWorkspaceSnapshot();
                        if (
                          !mounted.current ||
                          current.profile.email.toLowerCase() !==
                            referenceOwner ||
                          selectedBrand(referenceOwner) !== referenceBrand ||
                          !current.projects.some(p => p.id === project.id)
                        )
                          return;
                        setReferenceBrief(brief);
                        void (async () => {
                          const scope = await captureUploadRequestScope();
                          if (
                            scope.ownerEmail !== referenceOwner ||
                            scope.brandId !== referenceBrand
                          )
                            throw new Error(
                              ui(
                                "The reference workspace changed. Reopen the intended project."
                              )
                            );
                          await verifyUploadRequestScope(scope);
                          await updateWorkspace(w => {
                            if (
                              !mounted.current ||
                              w.profile.email.toLowerCase() !==
                                referenceOwner ||
                              selectedBrand(referenceOwner) !==
                                referenceBrand ||
                              !w.projects.some(p => p.id === project.id)
                            )
                              throw new Error(
                                ui(
                                  "The reference project changed before saving."
                                )
                              );
                            return {
                              ...w,
                              projects: w.projects.map(p =>
                                p.id === project.id
                                  ? {
                                      ...p,
                                      referenceStyleBrief: brief,
                                      ...(brief
                                        ? { editStyleTemplate: undefined }
                                        : {}),
                                    }
                                  : p
                              ),
                            };
                          });
                        })().catch(e => {
                          const latest = getWorkspaceSnapshot();
                          if (
                            mounted.current &&
                            latest.profile.email.toLowerCase() ===
                              referenceOwner &&
                            selectedBrand(referenceOwner) === referenceBrand
                          )
                            setStatus(workspaceSaveError(e));
                        });
                      }}
                      disabled={
                        busy || matching || Boolean(project.editStyleTemplate)
                      }
                    />
                  </div>
                </div>
                {referenceBrief && (
                  <details className="mb-2 text-xs">
                    <summary>{ui("Saved reference direction")}</summary>
                    <p className="mt-2 whitespace-pre-wrap">{referenceBrief}</p>
                  </details>
                )}
                <div className="auto-edit-direction border-t border-border pt-4">
                  <div className="rounded-xl border border-border bg-background/30 p-3">
                    <label className="block text-xs font-medium">
                      {ui("Describe the style and outcome")}
                      <textarea
                        disabled={busy}
                        aria-label={ui("Autonomous editing style")}
                        rows={3}
                        value={style}
                        onChange={e => setStyle(e.target.value)}
                        placeholder={ui(
                          "Premium skincare demo. Clean editorial captions, a fast before/after opening, subtle fades, warm colour, and a quiet product close-up at the end."
                        )}
                        className="mt-2 w-full rounded-lg border border-border bg-background p-2.5 text-xs leading-relaxed"
                      />
                    </label>
                    <div className="mt-2 flex gap-2">
                      {(["presets", "options"] as const).map(panel => (
                        <button
                          key={panel}
                          type="button"
                          aria-expanded={optionsPanel === panel}
                          onClick={() =>
                            setOptionsPanel(
                              optionsPanel === panel ? null : panel
                            )
                          }
                          className={`rounded-md border px-2.5 py-1.5 text-xs ${optionsPanel === panel ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                        >
                          {ui(panel === "presets" ? "Presets" : "Specs")}
                        </button>
                      ))}
                    </div>
                    {optionsPanel === "presets" && (
                      <div className="mt-3 rounded-lg border border-border bg-surface p-3">
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(
                            Object.keys(EDIT_RECIPES) as Array<
                              keyof typeof EDIT_RECIPES
                            >
                          ).map(s => (
                            <button
                              disabled={busy}
                              key={s}
                              type="button"
                              onClick={() =>
                                setStyle(`${s}. ${EDIT_RECIPES[s]}`)
                              }
                              className="rounded-lg border border-border px-3 py-1.5 text-xs"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {optionsPanel === "options" && (
                      <div className="auto-edit-options mt-3 rounded-lg border border-border bg-surface p-3">
                        <label className="mt-4 flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            disabled={busy}
                            checked={automaticDuration}
                            onChange={e =>
                              setAutomaticDuration(e.target.checked)
                            }
                          />
                          {ui("Detect ending from content automatically")}
                        </label>
                        <fieldset
                          disabled={busy}
                          className="mt-4 space-y-3 text-sm"
                        >
                          <legend className="font-medium">
                            {ui("Edit duration")}
                          </legend>
                          <StudioSelect
                            aria-label={ui("Edit duration")}
                            value={durationMode}
                            onChange={event =>
                              setDurationMode(
                                event.target.value as "none" | "range"
                              )
                            }
                            className="h-8 min-h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
                          >
                            <option value="none">
                              {ui("No target duration")}
                            </option>
                            <option value="range">
                              {ui("Preferred duration range")}
                            </option>
                          </StudioSelect>
                          {durationMode === "range" ? (
                            <>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label>
                                  {ui("Minimum duration (seconds)")}
                                  <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    inputMode="decimal"
                                    value={minimumDuration}
                                    onChange={event =>
                                      setMinimumDuration(event.target.value)
                                    }
                                    aria-invalid={!durationTarget}
                                    aria-describedby={
                                      durationTarget
                                        ? undefined
                                        : "edit-duration-error"
                                    }
                                    className="mt-1 w-full rounded-lg border border-border bg-background p-2"
                                  />
                                </label>
                                <label>
                                  {ui("Maximum duration (seconds)")}
                                  <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    inputMode="decimal"
                                    value={maximumDuration}
                                    onChange={event =>
                                      setMaximumDuration(event.target.value)
                                    }
                                    aria-invalid={!durationTarget}
                                    aria-describedby={
                                      durationTarget
                                        ? undefined
                                        : "edit-duration-error"
                                    }
                                    className="mt-1 w-full rounded-lg border border-border bg-background p-2"
                                  />
                                </label>
                              </div>
                              <p className="text-xs text-foreground/60">
                                {ui(
                                  "A preference, not a cutoff. Preserve complete speech and meaning; never pad or repeat footage to fill the range."
                                )}
                              </p>
                              {!durationTarget && (
                                <p
                                  id="edit-duration-error"
                                  role="alert"
                                  className="text-xs text-destructive"
                                >
                                  {ui(
                                    "Enter a minimum and maximum greater than zero, with the maximum above the minimum."
                                  )}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-foreground/60">
                              {ui(
                                "The edit follows the footage and story without a requested duration limit."
                              )}
                            </p>
                          )}
                        </fieldset>
                        <label className="mt-4 flex items-center gap-2 text-sm">
                          <input
                            disabled={busy}
                            type="checkbox"
                            checked={captions}
                            onChange={e => setCaptions(e.target.checked)}
                          />
                          {ui("Transcribe and caption footage")}
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={
                    busy || !ready || !project.clips.length || !durationTarget
                  }
                  onClick={() => void run(false)}
                  className="ai-magic flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {failure ? ui("Continue edit") : ui("Build my edit")}
                </button>
                <div className="flex items-center justify-end gap-3">
                  {quote && (
                    <span
                      className="text-xs text-muted-foreground"
                      role="status"
                    >
                      {quote.minimum}–{quote.maximum} {ui("credits")}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={
                      busy || !ready || !project.clips.length || !durationTarget
                    }
                    onClick={() => void run(true)}
                    title={`${ui("Estimating runs paid review and planning: up to {{credits}} credits. Completed preparation is reused.", { credits: estimatePreparationCost })}${unreviewedExamples.length ? ` ${ui("Style example review: {{credits}} credits.", { credits: styleExampleCost })}` : ""}`}
                    className="text-xs text-sky-400 hover:text-sky-300 disabled:opacity-40"
                  >
                    {ui("Estimate credits")} · {estimatePreparationCost}{" "}
                    {ui("credits")}
                  </button>
                </div>
                {busy && (
                  <button
                    type="button"
                    onClick={() => {
                      stopped.current = true;
                      runController.current?.abort();
                    }}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Square className="h-3 w-3" />
                    {ui("Stop remaining steps")}
                  </button>
                )}
              </div>
            </div>
            {failure && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm"
              >
                <p className="mb-1 flex items-center gap-2 font-medium">
                  <AlertCircle size={16} />
                  {ui("Edit paused")} · {stage}
                </p>
                <p className="break-words text-foreground/80">{failure}</p>
                <p className="mt-2 text-xs text-foreground/60">
                  {ui("Completed preparation is reused.")}
                </p>
              </div>
            )}
            {status && (
              <p
                role="status"
                className={`mt-4 text-sm leading-6 ${busy ? "ai-status-text" : ""}`}
              >
                {status}
              </p>
            )}
            {finished && (
              <button
                type="button"
                onClick={() => onFinished(status)}
                className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground"
              >
                {ui("Review and export my edit")}
              </button>
            )}
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}
