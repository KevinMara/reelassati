import {
  mergeCreditReceipt,
  type CreditReceipt,
} from "@contracts/credit-receipt";
import { normalizeEditorChatState } from "@contracts/editor-chat-state";
import { applyAutonomousCaptionTreatment } from "@contracts/editorial-captions";
import { autonomousResultReceipt } from "@/lib/autonomous-result-receipt";
import { autonomousCreditEstimate } from "@/lib/autonomous-credit-estimate";
import { activeEditorProjects, editorRunKey } from "@/lib/editor-run-lock";
import { ConciseResponse } from "./ConciseResponse";
import { editorAudioCatalog } from "@contracts/editor-audio-catalog";
import { resolveChatCatalogAudio } from "@/lib/editor-chat-catalog-audio";
import { StudioSelect } from "@/components/ui/studio-select";
import { getUiLocale, useUiText } from "@/lib/i18n/ui";
import { v4 as createUuid } from "uuid";
import { publishAutonomousSteps } from "@/lib/autonomous-live-publish";
import {
  autonomousPlanCacheKey,
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
  findSavedAutonomousReview,
} from "@/lib/autonomous-preparation";
import {
  EDIT_RECIPES,
  auditAutomatedEdit,
  trimObservedEnding,
  AUTOMATIC_EDIT_DIRECTION,
} from "@/lib/editor-production";
import { ReferenceStylePanel } from "./ReferenceStylePanel";
import { EditStyleTemplates } from "./EditStyleTemplates";
import { editStyleDirection } from "@contracts/edit-style-template";
import { VIDEO_ANALYSIS_SCHEMA_VERSION } from "@contracts/video-analysis";
import { videoReviewFailureMessage } from "@contracts/video-analysis-errors";
import { eligibleAnalyzerOptimization } from "@contracts/analyzer-report";
import { useEffect, useRef, useState } from "react";
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
  PlatformApiError,
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
}: {
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
    project.referenceStyleBrief ?? ""
  );
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
    minimum: number;
    maximum: number;
    images: number;
    videos: number;
  }>();
  const [captions, setCaptions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [finished, setFinished] = useState(false);
  const [failure, setFailure] = useState("");
  const [stage, setStage] = useState("");
  const preparationCache = useRef(createAutonomousPreparationCache());
  const planCache = useRef(createAutonomousPlanCache());
  const stopped = useRef(false);
  const runController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    const cache = planCache.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopped.current = true;
      runController.current?.abort();
      cache.clear();
    };
  }, []);
  useEffect(() => {
    const cache = planCache.current;
    return () => {
      runController.current?.abort();
      cache.clear();
    };
  }, [referenceOwner, referenceBrand, project.id]);
  const sources = workspace.assets.filter(
    a =>
      project.clips.some(c => c.assetId === a.id) &&
      (a.kind === "video" || a.kind === "audio")
  );
  const analysisCost = sources
    .filter(
      a =>
        a.kind === "video" &&
        !findSavedAutonomousReview(
          a,
          project.platform,
          workspace.analyzerReports
        )
    )
    .reduce(
      (sum, a) =>
        sum +
        timedCreditCost(a.duration, AI_CREDIT_COSTS.videoAnalysisPerMinute),
      0
    );
  const transcriptCost = 0;
  const preparationCost =
    AI_CREDIT_COSTS.editPlan + analysisCost + transcriptCost;
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
  const ready =
    capabilities.ai &&
    capabilities.editPlanTransportVersion === "foreground-v1" &&
    capabilities.editingModel === "moonshotai/kimi-k3" &&
    (!sources.some(a => a.kind === "video") ||
      (capabilities.analysis &&
        capabilities.analysisTransportVersion === "foreground-v1" &&
        capabilities.analysisSchemaVersion ===
          VIDEO_ANALYSIS_SCHEMA_VERSION)) &&
    (!transcriptCost || capabilities.transcription);

  async function run(quoteOnly = false) {
    if (activeEditorProjects.has(runKey) || runController.current) return;
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
    let receipts: CreditReceipt[] = [];
    let receiptsComplete = true;
    const savedSteps: string[] = [];
    const saveActivity = async (
      text: string,
      state: "running" | "ready" | "completed" | "failed" | "stopped",
      appliedTypes?: EditOperation["type"][],
      planSummary?: string
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
      const cacheKey = keyFor(workspace, project);
      const inputsStillCurrent = () => {
        const current = getWorkspaceSnapshot();
        const base = current.projects.find(p => p.id === project.id);
        return Boolean(base && keyFor(current, base) === cacheKey);
      };
      const cached = planCache.current.read(cacheKey);
      let result: AutonomousPlanResult;
      if (cached && inputsStillCurrent()) {
        working = cached.working;
        result = cached.result;
      } else {
        planCache.current.clear();
        const prepared = await prepareAutonomousSources({
          project,
          sources,
          captions,
          speechTiming: true,
          context: JSON.stringify([
            destination,
            workspace.profile.contentLanguage,
            getUiLocale(),
          ]),
          cache: preparationCache.current,
          savedReports: workspace.analyzerReports,
          checkpoint,
          review: async asset => {
            setStage(ui("Review"));
            setStatus(`Reviewing ${asset.name}…`);
            const { analyzeMedia } = await import("@/lib/analyze-media");
            checkpoint();
            return analyzeMedia(
              asset,
              project.platform,
              undefined,
              progress,
              signal,
              scope,
              getUiLocale(),
              false,
              onCreditReceipt
            );
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
        const templateDirection = working.editStyleTemplate
          ? editStyleDirection(working.editStyleTemplate.profile)
          : "";
        const captionTreatment =
          working.editStyleTemplate?.profile.captionTreatment;
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
          working = trimObservedEnding(working, workspace.assets);
        const durationDirection = editDurationDirection(
          durationTarget,
          automaticDuration
        );
        setStatus("Building the cut, pacing, captions, and visual treatment…");
        setStage(ui("Edit plan"));
        result = await platformApi.generateEditPlan(
          {
            project: working,
            command: `AUTONOMOUS COMPLETE EDIT. Style: ${style.trim() || AUTOMATIC_EDIT_DIRECTION}. ${templateDirection} Reference style evidence: ${referenceBrief || "No reference supplied"}. ${durationDirection} Brand: ${workspace.brandKit.name}; voice: ${workspace.brandKit.voice}; audience: ${workspace.brandKit.audience}. Observation intervals below use SOURCE timestamps; map them through each clip inPoint/start/speed before editing. Footage observations: ${JSON.stringify(analysis)}. Existing library: ${JSON.stringify(workspace.assets.map(a => ({ id: a.id, name: a.name, kind: a.kind, duration: a.duration })))}. Build the story form that fits this footage and brief; deliver its opening promise and meaningful ending without forcing an advertising structure. Remove only evidenced dead space, preserve speech meaning and all locked clips. ${captions ? "Use existing/transcribed words for captions; never fabricate spoken dialogue." : "Do not add captions."} Use editable graphic operations for motivated text, callouts, counters, arrows and highlights. Keep them clear of faces and existing source captions. Do not duplicate burned-in captions. Reuse appropriate library media. Choose the number of supporting images and video shots from the story and actual coverage gaps; there is no per-edit image, video, or credit cap. Use broll operations with parameters.prompt and parameters.mediaKind. Each generated image is 1K and each generated video is 5 seconds; fit the requested insert to its usable length. Prefer relevant licensed stock or owned footage when it achieves the intended picture. Generated extras are authorized. Mark a generated shot parameters.optional=true only if the core story remains complete without it; required coverage is optional=false. This distinction informs the estimate, never a media quota. Do not add decorative filler just to spend credits. No new voiceover or unpriced generation. For audio, duck existing music under speech. Include executable parameters for every operation.`,
            model,
            stock: true,
            captionStyling: captions,
            effort: "max",
            selectedClipIds: [],
            range: { start: 0, end: working.duration },
          },
          requestOptions
        );
        checkpoint();
        if (inputsStillCurrent())
          planCache.current.write(cacheKey, working, result);
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
        [
          ...workspace.assets,
          ...(result.stockMedia ?? []).map(item => ({
            id: `stock:${item.provider}:${item.id}`,
            name: item.title,
            kind: item.kind,
            status: "ready" as const,
            duration: item.duration,
            url: "",
            size: 0,
            createdAt: "",
            contentType: `${item.kind}/${item.kind === "video" ? "webm" : "jpeg"}`,
          })),
          ...editorAudioCatalog.map(a => ({
            id: `catalog:${a.id}`,
            kind: "audio" as const,
            name: a.name,
            status: "ready" as const,
            duration: a.duration,
            url: "",
            size: 0,
            createdAt: "",
            contentType: "audio/wav",
          })),
        ],
        checkpoint,
        // Analyzer optimization contains generated recommendations, not a
        // verbatim human instruction to add or cover source text.
        {
          request: style.startsWith("ANALYZER OPTIMIZATION BRIEF") ? "" : style,
        }
      );
      changesToApply = graphicReview.changes;
      // Price the validated execution plan. An invalid draft must never be
      // presented as ready, and omitted operations must not buy unused media.
      const estimate = autonomousCreditEstimate(
        changesToApply,
        preparationCost
      );
      const { images, videos } = estimate;
      setQuote({ key: quoteKey, ...estimate });
      if (quoteOnly) {
        await saveActivity(
          ui("Your edit plan is ready."),
          "ready",
          undefined,
          result.summary
        );
        setStatus(ui("Your edit plan is ready."));
        return;
      }
      // Recovery covers local validation only, not already-started media jobs
      // or partially published timelines that need their own execution ledger.
      planCache.current.clear();
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
      for (const op of changesToApply.filter(op => op.type === "sound")) {
        const id = op.parameters?.assetId;
        if (!id?.startsWith("catalog:")) continue;
        setStage(ui("Sound"));
        setStatus(`Adding free sound · ${op.label}`);
        const asset = await resolveChatCatalogAudio(
          id.slice(8),
          [...workspace.assets, ...generatedAssets],
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
      const allAssets = [...workspace.assets, ...generatedAssets];
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
      steps.push({ label: "Saved the finished edit", project: working });
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
      planCache.current.clear();
      const receipt = autonomousResultReceipt(
        result.summary,
        [...appliedOperations, ...preparationCategories],
        graphicReview,
        ui
      );
      savedSteps.push(...receipt.details);
      setCompletedSteps([...savedSteps]);
      await saveActivity(
        receipt.summary,
        "completed",
        [...appliedOperations, ...preparationCategories].map(
          operation => operation.type
        ),
        receipt.planSummary
      );
      setFinished(true);
      setStatus(receipt.summary);
      onFinished(receipt.summary);
    } catch (e) {
      if (signal.aborted) planCache.current.clear();
      if (!mounted.current || runController.current !== controller) return;
      const reviewDetail =
        e instanceof PlatformApiError
          ? videoReviewFailureMessage(e.reason)
          : undefined;
      const failureText = signal.aborted
        ? `Stopped. Provider work already submitted may still finish in your Library; no further steps will start. ${timelineSaveStarted ? "The timeline save had already started; review your project and use Undo if needed." : "Your original timeline is intact."}`
        : e instanceof PlatformApiError
          ? `${ui(e.message)}${reviewDetail ? ` ${ui(reviewDetail)}` : ""} (${e.status})${e.reference ? ` · ${ui("Reference")}: ${e.reference}` : ""}`
          : e instanceof Error
            ? e.message
            : "The edit could not complete. Your original timeline is preserved.";
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
  const host = document.getElementById("editor-autoedit-activity");
  return (
    <>
      {host && activity && createPortal(activity, host)}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="auto-edit-dialog max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle>{ui("Auto-edit")}</DialogTitle>
          <DialogDescription>
            {ui("Choose a direction, or let the footage guide the edit.")}
          </DialogDescription>
          <section className="space-y-4">
            <div className="grid gap-5">
              <div>
                <div className="auto-edit-reference mb-5 rounded-xl border border-primary/25 bg-primary/5 px-4 py-1">
                  <div>
                    {" "}
                    <ReferenceStylePanel
                      key={project.id}
                      projectId={project.id}
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
                                  ? { ...p, referenceStyleBrief: brief }
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
                            setStatus(
                              e instanceof Error
                                ? e.message
                                : "Reference direction could not be saved."
                            );
                        });
                      }}
                      disabled={busy}
                    />
                  </div>
                </div>
                {referenceBrief && (
                  <details className="mb-2 text-xs">
                    <summary>{ui("Saved reference direction")}</summary>
                    <p className="mt-2 whitespace-pre-wrap">{referenceBrief}</p>
                  </details>
                )}
                <div className="mb-4">
                  <EditStyleTemplates
                    project={project}
                    disabled={busy}
                    compact
                  />
                </div>
                <label className="block text-sm font-medium">
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
                    className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm"
                  />
                </label>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    {ui("Presets")}
                  </summary>
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
                        onClick={() => setStyle(`${s}. ${EDIT_RECIPES[s]}`)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </details>
                <details className="auto-edit-options mt-5 border-t border-border pt-3">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    {ui("More options")}
                  </summary>
                  <label className="mt-4 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={automaticDuration}
                      onChange={e => setAutomaticDuration(e.target.checked)}
                    />
                    {ui("Detect ending from content automatically")}
                  </label>
                  <fieldset disabled={busy} className="mt-4 space-y-3 text-sm">
                    <legend className="font-medium">
                      {ui("Edit duration")}
                    </legend>
                    <StudioSelect
                      aria-label={ui("Edit duration")}
                      value={durationMode}
                      onChange={event =>
                        setDurationMode(event.target.value as "none" | "range")
                      }
                      className="w-full rounded-lg border border-border bg-background p-2"
                    >
                      <option value="none">{ui("No target duration")}</option>
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
                </details>
              </div>
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {quote
                        ? `${quote.minimum}–${quote.maximum} ${ui("credits")}`
                        : ui("Cost follows your edit plan")}
                    </p>
                    {quote && quote.minimum !== quote.maximum && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ui("Range covers required and optional shots.")}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {quote
                        ? `${quote.images} ${ui("images")} · ${quote.videos} ${ui("videos")} · ${ui("Only completed work is charged.")}`
                        : `${ui("Review and plan")}: ${preparationCost} ${ui("credits")}. ${ui("Supporting media is estimated after planning.")}`}
                    </p>
                  </div>
                  {quote && (
                    <button
                      type="button"
                      disabled={
                        busy ||
                        !ready ||
                        !project.clips.length ||
                        !durationTarget
                      }
                      onClick={() => void run(true)}
                      className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs"
                    >
                      {ui("Estimate edit")}
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {ui(
                    "Maximum effort · automatic extras · no fixed media limit"
                  )}
                </p>
                <button
                  type="button"
                  disabled={
                    busy || !ready || !project.clips.length || !durationTarget
                  }
                  onClick={() => void run(!quote)}
                  className="ai-magic flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {quote
                    ? failure
                      ? ui("Continue edit")
                      : ui("Build my edit")
                    : ui("Estimate edit")}
                </button>
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
