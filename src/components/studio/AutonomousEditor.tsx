import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Square } from "lucide-react";
import type { Asset, EditProject, EditOperation } from "@contracts/workspace";
import {
  AI_CREDIT_COSTS,
  timedCreditCost,
  videoCreditCost,
} from "@contracts/billing";
import { useWorkspace } from "@/providers/workspace";
import { platformApi } from "@/lib/platform-api";
import { applyEditOperation, contentDuration } from "@/lib/edit-timeline";

export function AutonomousEditor({
  project,
  onFinished,
}: {
  project: EditProject;
  onFinished: () => void;
}) {
  const { workspace, updateWorkspace, capabilities } = useWorkspace();
  const [style, setStyle] = useState("");
  const [target, setTarget] = useState(Math.round(project.duration));
  const [images, setImages] = useState(0);
  const [videos, setVideos] = useState(0);
  const [captions, setCaptions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [finished, setFinished] = useState(false);
  const stopped = useRef(false);
  useEffect(
    () => () => {
      stopped.current = true;
    },
    []
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
    stopped.current = false;
    setBusy(true);
    setFinished(false);
    setStatus("Examining your footage…");
    const checkpoint = () => {
      if (stopped.current)
        throw new Error(
          "Stopped. Completed media stays in your Library; the original timeline is intact."
        );
    };
    let working: EditProject = structuredClone(project);
    const originalClips = JSON.stringify(project.clips);
    const generatedAssets: Asset[] = [];
    const resolvedMedia = new Map<string, string>();
    try {
      const analysis: Array<{ assetId: string; summary: string }> = [];
      for (const asset of sources) {
        checkpoint();
        if (asset.kind === "video") {
          setStatus(`Reviewing ${asset.name}…`);
          const result = await platformApi.analyzeVideo({
            assetId: asset.id,
            platform: project.platform,
            sourceRightsConfirmed: true,
          });
          analysis.push({ assetId: asset.id, summary: result.summary });
        }
        checkpoint();
        if (captions && !project.transcript.length) {
          setStatus(`Transcribing ${asset.name}…`);
          const { transcribeMedia } = await import("@/lib/transcribe-media");
          const result = await transcribeMedia(
            asset,
            workspace.profile.contentLanguage,
            project.id,
            setStatus
          );
          if (result.provenance)
            working.transcriptProvenance = result.provenance;
          for (const clip of project.clips.filter(
            c => c.assetId === asset.id && !c.muted
          )) {
            const speed = clip.speed ?? 1;
            working.transcript.push(
              ...result.segments
                .filter(
                  s =>
                    s.end > clip.inPoint &&
                    s.start < clip.inPoint + clip.duration * speed
                )
                .map(s => ({
                  ...s,
                  id: `${clip.id}-${s.id}`,
                  start:
                    clip.start + Math.max(0, s.start - clip.inPoint) / speed,
                  end: Math.min(
                    clip.start + clip.duration,
                    clip.start + (s.end - clip.inPoint) / speed
                  ),
                }))
            );
          }
        }
      }
      checkpoint();
      setStatus("Building the cut, pacing, captions, and visual treatment…");
      const result = await platformApi.generateEditPlan({
        project: working,
        command: `AUTONOMOUS COMPLETE EDIT. Style: ${style}. Target ${target}s. Brand: ${workspace.brandKit.name}; voice: ${workspace.brandKit.voice}; audience: ${workspace.brandKit.audience}. Footage observations: ${JSON.stringify(analysis)}. Existing library: ${JSON.stringify(workspace.assets.map(a => ({ id: a.id, name: a.name, kind: a.kind, duration: a.duration })))}. Apply an intentional hook, proof, payoff and ending; remove only evidenced dead space, preserve speech meaning and all locked clips. ${captions ? "Use existing/transcribed words for captions; never fabricate spoken dialogue." : "Do not add captions."} Reuse appropriate library media. You may request up to ${images} new 1K images and ${videos} new 5-second video shots using broll operations with parameters.prompt and parameters.mediaKind. Never exceed those counts. No new voiceover or unpriced generation. For audio, duck existing music under speech. Include executable parameters for every operation.`,
        selectedClipIds: [],
        range: { start: 0, end: project.duration },
      });
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
          const created = await platformApi.createVideo({
            requestId: crypto.randomUUID(),
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
          });
          const deadline = Date.now() + 20 * 60_000;
          while (!asset && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            checkpoint();
            const polled = await platformApi.videoJob(created.job.id);
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
          asset = await platformApi.generateImage({
            prompt: op.parameters.prompt,
            assetName: op.label,
            aspectRatio: project.aspectRatio,
            resolution: "1K",
            rightsConfirmed: true,
            referenceContainsRealPerson: false,
            realPersonConsentConfirmed: false,
          });
        }
        if (asset) {
          generatedAssets.push(asset);
          // Keep the signed AI recommendation immutable; resolve assets only at execution.
          await updateWorkspace(w => ({
            ...w,
            assets: [...w.assets.filter(a => a.id !== asset!.id), asset!],
          }));
          resolvedMedia.set(op.id, asset.id);
        }
      }
      checkpoint();
      setStatus("Applying the edit to your timeline…");
      const allAssets = [...workspace.assets, ...generatedAssets];
      const unresolved: EditOperation[] = [];
      // Work backwards for source-time cuts so earlier operations keep their time coordinates.
      const ordered = [...result.changes].sort((a, b) => b.start - a.start);
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
      checkpoint();
      await updateWorkspace(w => ({
        ...w,
        projects: w.projects.map(p => {
          if (p.id !== project.id) return p;
          if (JSON.stringify(p.clips) !== originalClips)
            throw new Error(
              "Your timeline changed during the edit. AI media is saved; run again on the current version."
            );
          const before = {
            id: crypto.randomUUID(),
            label: "Before autonomous edit",
            createdAt: new Date().toISOString(),
            clips: p.clips,
            transcript: p.transcript,
            duration: p.duration,
            transcriptProvenance: p.transcriptProvenance,
          };
          const after = {
            id: crypto.randomUUID(),
            label: "Autonomous edit",
            createdAt: new Date().toISOString(),
            clips: working.clips,
            transcript: working.transcript,
            duration: contentDuration(working.clips),
          };
          return {
            ...working,
            updatedAt: new Date().toISOString(),
            revisions: [...p.revisions, before, after].slice(-24),
            lastCommand: style,
          };
        }),
      }));
      setFinished(true);
      setStatus(
        `${result.summary}${unresolved.length ? ` ${unresolved.length} suggestions need review in AI assistant.` : ""} Your original edit is available with Undo.`
      );
    } catch (e) {
      setStatus(
        e instanceof Error
          ? e.message
          : "The edit could not complete. Your original timeline is preserved."
      );
    } finally {
      setBusy(false);
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
            {[
              "Fast product demo",
              "Clean editorial",
              "Cinematic story",
              "Natural talking head",
            ].map(s => (
              <button
                disabled={busy}
                key={s}
                type="button"
                onClick={() => setStyle(s)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                {s}
              </button>
            ))}
          </div>
          <label className="mt-4 block text-sm">
            Target duration · {target}s
            <input
              disabled={busy}
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
          <label className="flex items-center justify-between gap-2 text-sm">
            New images, up to
            <input
              disabled={busy}
              aria-label="Maximum generated images"
              type="number"
              min={0}
              value={images}
              onChange={e =>
                setImages(Math.max(0, Math.floor(Number(e.target.value) || 0)))
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
                setVideos(Math.max(0, Math.floor(Number(e.target.value) || 0)))
              }
              className="w-16 rounded border border-border bg-background p-2"
            />
          </label>
          <div className="border-t border-border pt-3">
            <p className="text-2xl font-semibold">
              Up to {estimate.toLocaleString()} credits
            </p>
            <p className="mt-1 text-xs text-foreground/70">
              Review {analysisCost} · captions {transcriptCost} · plan{" "}
              {AI_CREDIT_COSTS.editPlan} · optional media {mediaCost}. Only
              requested generations run. Manual editing and local export use no
              AI credits.
            </p>
          </div>

          <button
            type="button"
            disabled={busy || !ready || !style.trim() || !project.clips.length}
            onClick={() => void run()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-40"
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
              }}
              className="flex items-center gap-2 text-sm"
            >
              <Square className="h-3 w-3" />
              Stop after current step
            </button>
          )}
        </div>
      </div>
      {status && (
        <p role="status" className="mt-4 text-sm leading-6">
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
