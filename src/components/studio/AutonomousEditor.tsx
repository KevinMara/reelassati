import { mapChatTranscript } from "@/lib/editor-chat-execution";
import { v4 as createUuid } from "uuid";
import { appendEditorRevisions } from "@/lib/editor-history";
import { normalizeReview } from "@contracts/source-review";
import {
  EDIT_RECIPES,
  auditAutomatedEdit,
  trimObservedEnding,
} from "@/lib/editor-production";
import { ReferenceStylePanel } from "./ReferenceStylePanel";
import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Square } from "lucide-react";
import type {
  Asset,
  EditProject,
  EditOperation,
  WorkspaceDocument,
} from "@contracts/workspace";
import {
  AI_CREDIT_COSTS,
  timedCreditCost,
  videoCreditCost,
} from "@contracts/billing";
import { useWorkspace } from "@/providers/workspace";
import {
  captureUploadRequestScope,
  platformApi,
  verifyUploadRequestScope,
} from "@/lib/platform-api";
import { selectedBrand } from "@/lib/workspace-scope";
import { assertAutonomousRunCurrent } from "@/lib/autonomous-run";
import { applyEditOperation, contentDuration } from "@/lib/edit-timeline";

export function AutonomousEditor({
  project,
  onFinished,
}: {
  project: EditProject;
  onFinished: () => void;
}) {
  const { workspace, getWorkspaceSnapshot, updateWorkspace, capabilities } =
    useWorkspace();
  const referenceOwner = workspace.profile.email.toLowerCase();
  const referenceBrand = selectedBrand(referenceOwner);
  const [style, setStyle] = useState(
    `Clean editorial. ${EDIT_RECIPES["Clean editorial"]}`
  );
  const [referenceBrief, setReferenceBrief] = useState(
    project.referenceStyleBrief ?? ""
  );
  const [target, setTarget] = useState(project.duration);
  const [automaticDuration, setAutomaticDuration] = useState(true);
  const targetDuration = automaticDuration
    ? contentDuration(project.clips)
    : target;
  const [images, setImages] = useState(0);
  const [videos, setVideos] = useState(0);
  const [captions, setCaptions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [finished, setFinished] = useState(false);
  const stopped = useRef(false);
  const runController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopped.current = true;
      runController.current?.abort();
    };
  }, []);
  useEffect(
    () => () => runController.current?.abort(),
    [referenceOwner, referenceBrand, project.id]
  );
  const sources = workspace.assets.filter(
    a =>
      project.clips.some(c => c.assetId === a.id) &&
      (a.kind === "video" || a.kind === "audio")
  );
  const analysisCost = sources
    .filter(a => a.kind === "video")
    .reduce(
      (sum, a) =>
        sum +
        timedCreditCost(a.duration, AI_CREDIT_COSTS.videoAnalysisPerMinute),
      0
    );
  const transcriptCost =
    captions && !project.transcript.length
      ? sources.reduce(
          (sum, a) =>
            sum +
            timedCreditCost(a.duration, AI_CREDIT_COSTS.transcriptionPerMinute),
          0
        )
      : 0;
  const mediaCost =
    images * AI_CREDIT_COSTS.image1K +
    videos *
      videoCreditCost({
        duration: 5,
        resolution: "720p",
        generateAudio: false,
        continuation: false,
      });
  const estimate =
    AI_CREDIT_COSTS.editPlan + analysisCost + transcriptCost + mediaCost;
  const ready =
    capabilities.ai &&
    (!sources.some(a => a.kind === "video") || capabilities.analysis) &&
    (!transcriptCost || capabilities.transcription) &&
    (!images || capabilities.imageGeneration) &&
    (!videos || capabilities.videoGeneration);

  async function run() {
    if (runController.current && !runController.current.signal.aborted) return;
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
    setFinished(false);
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
    const originalClips = JSON.stringify(project.clips);
    const generatedAssets: Asset[] = [];
    const resolvedMedia = new Map<string, string>();
    let timelineSaveStarted = false;
    try {
      checkpoint();
      const scope = await captureUploadRequestScope();
      checkpoint();
      if (
        scope.ownerEmail !== destination.ownerEmail ||
        scope.brandId !== destination.brandId
      )
        throw new Error(
          "Your account or brand changed before the edit started. Reopen the intended workspace."
        );
      const requestOptions = { scope, signal };
      const analysis: Array<{
        assetId: string;
        summary: string;
        intervals: Awaited<
          ReturnType<typeof platformApi.analyzeVideo>
        >["retention"];
      }> = [];
      for (const asset of sources) {
        checkpoint();
        if (asset.kind === "video") {
          setStatus(`Reviewing ${asset.name}…`);
          const { analyzeMedia } = await import("@/lib/analyze-media");
          checkpoint();
          const result = await analyzeMedia(
            asset,
            project.platform,
            undefined,
            progress,
            signal,
            scope
          );
          checkpoint();
          working.sourceReviews = [
            ...(working.sourceReviews ?? []).filter(
              r => r.assetId !== asset.id
            ),
            {
              assetId: asset.id,
              reviewedAt: new Date().toISOString(),
              summary: result.summary,
              ...normalizeReview(result.review),
              moments: result.retention,
            },
          ];
          analysis.push({
            assetId: asset.id,
            summary: result.summary,
            intervals: result.retention,
          });
        }
        checkpoint();
        if (
          captions &&
          !project.transcript.length &&
          !working.sourceReviews?.some(
            r => r.assetId === asset.id && r.captions === "present"
          )
        ) {
          setStatus(`Transcribing ${asset.name}…`);
          const { transcribeMedia } = await import("@/lib/transcribe-media");
          checkpoint();
          const result = await transcribeMedia(
            asset,
            workspace.profile.contentLanguage,
            project.id,
            progress,
            signal,
            scope
          );
          checkpoint();
          if (result.provenance)
            working.transcriptProvenance = result.provenance;
          working.transcript.push(
            ...mapChatTranscript(project, asset.id, result.segments)
          );
        }
      }
      checkpoint();
      if (automaticDuration)
        working = trimObservedEnding(working, workspace.assets);
      const plannedDuration = automaticDuration
        ? contentDuration(working.clips)
        : targetDuration;
      setStatus("Building the cut, pacing, captions, and visual treatment…");
      const result = await platformApi.generateEditPlan(
        {
          project: working,
          command: `AUTONOMOUS COMPLETE EDIT. Style: ${style}. Reference style evidence: ${referenceBrief || "No reference supplied"}. Target ${plannedDuration.toFixed(1)}s. ${automaticDuration ? "Automatically end on the last meaningful content; do not pad to the target or cut off a word." : "Respect the requested target without truncating a word."} Brand: ${workspace.brandKit.name}; voice: ${workspace.brandKit.voice}; audience: ${workspace.brandKit.audience}. Observation intervals below use SOURCE timestamps; map them through each clip inPoint/start/speed before editing. Footage observations: ${JSON.stringify(analysis)}. Existing library: ${JSON.stringify(workspace.assets.map(a => ({ id: a.id, name: a.name, kind: a.kind, duration: a.duration })))}. Apply an intentional hook, proof, payoff and ending; remove only evidenced dead space, preserve speech meaning and all locked clips. ${captions ? "Use existing/transcribed words for captions; never fabricate spoken dialogue." : "Do not add captions."} Use editable graphic operations for motivated text, callouts, counters, arrows and highlights. Keep them clear of faces and existing source captions. Do not duplicate burned-in captions. Reuse appropriate library media. You may request up to ${images} new 1K images and ${videos} new 5-second video shots using broll operations with parameters.prompt and parameters.mediaKind. Never exceed those counts. No new voiceover or unpriced generation. For audio, duck existing music under speech. Include executable parameters for every operation.`,
          selectedClipIds: [],
          range: { start: 0, end: working.duration },
        },
        requestOptions
      );
      checkpoint();
      working.proposedChanges = [
        ...working.proposedChanges.filter(c => c.status !== "proposed"),
        ...result.changes,
      ];
      let imagesUsed = 0;
      let videosUsed = 0;
      for (const op of result.changes) {
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
                "A supporting video failed. Completed assets are saved; retry from your Library."
              );
            asset = polled.asset;
          }
          if (!asset)
            throw new Error(
              "The video is still generating. It will remain available in your Library; your timeline is unchanged."
            );
        } else if (op.parameters.mediaKind !== "video" && imagesUsed < images) {
          imagesUsed++;
          setStatus(`Generating supporting image ${imagesUsed}/${images}…`);
          asset = await platformApi.generateImage(
            {
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
      const allAssets = [...workspace.assets, ...generatedAssets];
      const unresolved: EditOperation[] = [];
      // Work backwards for source-time cuts so earlier operations keep their time coordinates.
      const ordered = [...result.changes]
        .filter(
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
        )
        .sort((a, b) => b.start - a.start);
      for (const op of ordered) {
        const execution = resolvedMedia.has(op.id)
          ? {
              ...op,
              parameters: {
                ...op.parameters,
                assetId: resolvedMedia.get(op.id),
              },
            }
          : op;
        const asset = execution.parameters?.assetId
          ? allAssets.find(a => a.id === execution.parameters?.assetId)
          : undefined;
        if (
          op.type === "broll" &&
          (!asset || (asset.duration && asset.duration < op.end - op.start))
        ) {
          unresolved.push(op);
          continue;
        }
        try {
          working = applyEditOperation(working, execution);
        } catch {
          unresolved.push(op);
        }
      }
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
      await updateWorkspace(w => {
        checkpoint(w);
        return {
          ...w,
          projects: w.projects.map(p => {
            if (p.id !== project.id) return p;
            if (
              JSON.stringify(p.clips) !== originalClips ||
              JSON.stringify(p.transcript) !==
                JSON.stringify(project.transcript)
            )
              throw new Error(
                "Your timeline changed during the edit. AI media is saved; run again on the current version."
              );
            const before = {
              id: createUuid(),
              label: "Before autonomous edit",
              createdAt: new Date().toISOString(),
              clips: p.clips,
              transcript: p.transcript,
              duration: p.duration,
              captionStyle: p.captionStyle,
              captionAppearance: p.captionAppearance,
              aspectRatio: p.aspectRatio,
              frameRate: p.frameRate,
              trackSettings: structuredClone(p.trackSettings),
              transcriptProvenance: p.transcriptProvenance,
            };
            const after = {
              id: createUuid(),
              label: "Autonomous edit",
              createdAt: new Date().toISOString(),
              clips: working.clips,
              transcript: working.transcript,
              duration: contentDuration(working.clips),
              captionStyle: p.captionStyle,
              captionAppearance: p.captionAppearance,
              aspectRatio: p.aspectRatio,
              frameRate: p.frameRate,
              trackSettings: structuredClone(p.trackSettings),
            };
            const hasChanges =
              JSON.stringify([
                before.clips,
                before.transcript,
                before.duration,
              ]) !==
              JSON.stringify([after.clips, after.transcript, after.duration]);
            return {
              ...working,
              updatedAt: new Date().toISOString(),
              captionStyle: p.captionStyle,
              captionAppearance: p.captionAppearance,
              ...(hasChanges
                ? appendEditorRevisions(p, [before, after], before)
                : { revisions: p.revisions, revisionIndex: p.revisionIndex }),
              lastCommand: style,
            };
          }),
        };
      });
      checkpoint();
      setFinished(true);
      setStatus(
        `${result.summary}${unresolved.length ? ` ${unresolved.length} suggestions need review in AI assistant.` : ""} Your original edit is available with Undo.`
      );
    } catch (e) {
      if (!mounted.current || runController.current !== controller) return;
      setStatus(
        signal.aborted
          ? `Stopped. Provider work already submitted may still finish in your Library; no further steps will start. ${timelineSaveStarted ? "The timeline save had already started; review your project and use Undo if needed." : "Your original timeline is intact."}`
          : e instanceof Error
            ? e.message
            : "The edit could not complete. Your original timeline is preserved."
      );
    } finally {
      if (runController.current === controller) {
        runController.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  }
  return (
    <section className="mb-4 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 to-surface p-6">
      <div className="mb-4 flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Let AI build your edit</h2>
          <p className="text-sm text-foreground/70">
            Footage review → captions → cut and pacing → supporting shots →
            editable timeline.
          </p>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {referenceBrief && (
            <details className="mb-2 text-xs">
              <summary>Saved reference direction</summary>
              <p className="mt-2 whitespace-pre-wrap">{referenceBrief}</p>
            </details>
          )}
          <label className="block text-sm font-medium">
            Describe the style and outcome
            <textarea
              disabled={busy}
              aria-label="Autonomous editing style"
              rows={4}
              value={style}
              onChange={e => setStyle(e.target.value)}
              placeholder="Premium skincare demo. Clean editorial captions, a fast before/after opening, subtle fades, warm colour, and a quiet product close-up at the end."
              className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              Object.keys(EDIT_RECIPES) as Array<keyof typeof EDIT_RECIPES>
            ).map(s => (
              <button
                disabled={busy}
                key={s}
                type="button"
                onClick={() => setStyle(`${s}. ${EDIT_RECIPES[s]}`)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                {s}
              </button>
            ))}
          </div>
          <details className="mt-4 rounded-xl border border-border bg-surface p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Match a reference style or video · optional
            </summary>
            <div className="mt-3">
              {" "}
              <ReferenceStylePanel
                key={project.id}
                projectId={project.id}
                onChange={brief => {
                  const current = getWorkspaceSnapshot();
                  if (
                    !mounted.current ||
                    current.profile.email.toLowerCase() !== referenceOwner ||
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
                        "The reference workspace changed. Reopen the intended project."
                      );
                    await verifyUploadRequestScope(scope);
                    await updateWorkspace(w => {
                      if (
                        !mounted.current ||
                        w.profile.email.toLowerCase() !== referenceOwner ||
                        selectedBrand(referenceOwner) !== referenceBrand ||
                        !w.projects.some(p => p.id === project.id)
                      )
                        throw new Error(
                          "The reference project changed before saving."
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
                      latest.profile.email.toLowerCase() === referenceOwner &&
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
          </details>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={busy}
              checked={automaticDuration}
              onChange={e => setAutomaticDuration(e.target.checked)}
            />
            Detect ending from content automatically
          </label>
          <label className="mt-4 block text-sm">
            Target duration · {targetDuration.toFixed(1)}s
            <input
              disabled={busy || automaticDuration}
              aria-label="AI target duration"
              type="range"
              min={1}
              max={Math.max(180, project.duration)}
              step={1}
              value={target}
              onChange={e => setTarget(Number(e.target.value))}
              className="mt-2 w-full accent-primary"
            />
          </label>
        </div>
        <div className="space-y-3 rounded-xl border border-primary/20 bg-background/60 p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              disabled={busy}
              type="checkbox"
              checked={captions}
              onChange={e => setCaptions(e.target.checked)}
            />
            Transcribe and caption footage
          </label>
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer text-sm">
              Create extra images or videos · optional
            </summary>
            <p className="my-3 text-xs leading-relaxed text-foreground/60">
              Your own footage is used by default. Allow paid new assets only
              when you want supporting shots.
            </p>
            <div className="space-y-3">
              {" "}
              <label className="flex items-center justify-between gap-2 text-sm">
                New images, up to
                <input
                  disabled={busy}
                  aria-label="Maximum generated images"
                  type="number"
                  min={0}
                  value={images}
                  onChange={e =>
                    setImages(
                      Math.max(0, Math.floor(Number(e.target.value) || 0))
                    )
                  }
                  className="w-16 rounded border border-border bg-background p-2"
                />
              </label>
              <label className="flex items-center justify-between gap-2 text-sm">
                New 5s videos, up to
                <input
                  disabled={busy}
                  aria-label="Maximum generated videos"
                  type="number"
                  min={0}
                  value={videos}
                  onChange={e =>
                    setVideos(
                      Math.max(0, Math.floor(Number(e.target.value) || 0))
                    )
                  }
                  className="w-16 rounded border border-border bg-background p-2"
                />
              </label>
            </div>
          </details>
          <div className="border-t border-border pt-3">
            <p className="text-2xl font-semibold">
              Up to {estimate.toLocaleString()} credits
            </p>
            <p className="mt-1 text-xs text-foreground/70">
              Review {analysisCost} · speech timing {transcriptCost} · plan{" "}
              {AI_CREDIT_COSTS.editPlan} · optional media {mediaCost}. Only
              requested generations run. Manual editing and local export use no
              AI credits.
            </p>
          </div>

          <button
            type="button"
            disabled={
              busy ||
              !ready ||
              (!style.trim() && !referenceBrief) ||
              !project.clips.length
            }
            onClick={() => void run()}
            className="ai-magic flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Build my edit · ≤ {estimate} credits
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
              Stop remaining steps
            </button>
          )}
        </div>
      </div>
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
          onClick={onFinished}
          className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Review and export my edit
        </button>
      )}
    </section>
  );
}
