import { useUiText } from "@/lib/i18n/ui";
import {
  lazy,
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Files,
  Film,
  Image,
  Captions,
  Music2,
  Shapes,
  SlidersHorizontal,
  Loader2,
  WandSparkles,
  Palette,
  MousePointer2,
} from "lucide-react";
import type { MotionGraphic } from "@contracts/motion-graphics";
import type { GraphicPreset } from "@contracts/editor-presets";
import type { Asset, EditProject } from "@contracts/workspace";
import {
  imageCreditCost,
  speechCreditCost,
  speechCharacterCount,
  videoCreditCost,
} from "@contracts/billing";
import {
  captureUploadRequestScope,
  platformApi,
  verifyUploadRequestScope,
} from "@/lib/platform-api";
import { selectedBrand } from "@/lib/workspace-scope";
import { useWorkspace } from "@/providers/workspace";
import { CompactSelect } from "@/components/ui/compact-select";
import { GraphicComposer } from "./GraphicComposer";
import { AudioGenerator } from "./AudioGenerator";
import { EditorMediaLibrary } from "./EditorMediaLibrary";
import { EditorGenerationTray } from "./EditorGenerationTray";
import { useEditorGenerations } from "./useEditorGenerations";
import { VoiceSelector } from "./VoiceSelector";
import { EditorSoundLibrary } from "./EditorSoundLibrary";
import { EditorPresetLibrary } from "./EditorPresetLibrary";
import { PersonCutoutPanel } from "./PersonCutoutPanel";
import { ImageDepthPanel } from "./ImageDepthPanel";
import { MotionKitLibrary } from "./MotionKitLibrary";
import type { MotionKitDraft } from "@contracts/motion-kits";

const GlbModelComposer = lazy(async () => ({
  default: (await import("./GlbModelComposer")).GlbModelComposer,
}));

export type DockKind =
  | "library"
  | "image"
  | "video"
  | "audio"
  | "captions"
  | "graphics"
  | "effects"
  | "color"
  | "adjust";

export function EditorCreationDock({
  project,
  playhead,
  onInsert,
  onAssist,
  activeTool,
  onToolChange,
  captions,
  effects,
  color,
  adjustment,
  onGraphic,
  onMotionKit,
}: {
  onAssist?: (context: string) => void;
  activeTool: DockKind;
  onToolChange: (kind: DockKind) => void;
  captions: ReactNode;
  effects: ReactNode;
  color?: ReactNode;
  adjustment?: ReactNode;
  onGraphic: (graphic: MotionGraphic, seconds: number) => Promise<void>;
  onMotionKit: (draft: MotionKitDraft) => Promise<void>;
  project: EditProject;
  playhead: number;
  onInsert: (asset: Asset, position?: "playhead" | "end") => Promise<void>;
}) {
  const ui = useUiText();
  const { workspace, capabilities, updateWorkspace, getWorkspaceSnapshot } =
    useWorkspace();
  const generation = useEditorGenerations(project.id);
  const [audioMode, setAudioMode] = useState<"voice" | "sounds">("voice");
  const kind =
    activeTool === "audio" && audioMode === "voice" ? "voice" : activeTool;
  const [prompts, setPrompts] = useState({ video: "", image: "", voice: "" });
  const [seconds, setSeconds] = useState(5);
  const [voice, setVoice] = useState("sarah");
  const [count, setCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [imageMode, setImageMode] = useState<"generate" | "cutout" | "depth">(
    "generate"
  );
  const [graphicMode, setGraphicMode] = useState<
    "kits" | "presets" | "custom" | "model"
  >("kits");
  const [graphicPreset, setGraphicPreset] = useState<{
    preset: GraphicPreset;
    revision: number;
  } | null>(null);
  const uploadController = useRef<AbortController | null>(null);
  const activeProject = useRef(project.id);
  useLayoutEffect(() => {
    activeProject.current = project.id;
    return () => uploadController.current?.abort();
  }, [project.id, workspace.profile.email, activeTool, graphicMode]);

  async function prepareModelSave(): Promise<(file: File) => Promise<void>> {
    const targetId = project.id;
    const ownerEmail = workspace.profile.email.toLowerCase();
    const brandId = selectedBrand(ownerEmail);
    if (activeProject.current !== targetId)
      throw new Error(ui("The selected project changed. Save the pose again."));
    uploadController.current?.abort();
    const controller = new AbortController();
    uploadController.current = controller;
    const scope = await captureUploadRequestScope();
    if (scope.ownerEmail !== ownerEmail || scope.brandId !== brandId)
      throw new Error(
        ui(
          "The account or brand changed. Save the pose again in the intended workspace."
        )
      );
    const assertTarget = () => {
      controller.signal.throwIfAborted();
      const latest = getWorkspaceSnapshot();
      if (
        activeProject.current !== targetId ||
        latest.profile.email.toLowerCase() !== scope.ownerEmail ||
        !latest.projects.some(p => p.id === targetId)
      )
        throw new Error(
          ui("The workspace or project changed. Save the pose again.")
        );
    };
    assertTarget();
    return async (file: File) => {
      try {
        assertTarget();
        const asset = await platformApi.uploadAsset(
          file,
          "image",
          undefined,
          undefined,
          { scope, signal: controller.signal }
        );
        await verifyUploadRequestScope(scope);
        assertTarget();
        await updateWorkspace(current => {
          assertTarget();
          return {
            ...current,
            assets: [
              ...current.assets.filter(a => a.id !== asset.id),
              { ...asset, projectId: targetId },
            ],
          };
        });
      } finally {
        if (uploadController.current === controller)
          uploadController.current = null;
      }
    };
  }
  const prompt =
    kind === "video" || kind === "image" || kind === "voice"
      ? prompts[kind]
      : "";
  const unitCost =
    kind === "video"
      ? videoCreditCost({
          duration: seconds,
          resolution: "720p",
          generateAudio: false,
          continuation: false,
        })
      : kind === "voice"
        ? speechCreditCost(speechCharacterCount(prompt.trim()), voice)
        : imageCreditCost("1K");
  const available =
    kind === "image"
      ? capabilities.imageGeneration
      : kind === "voice"
        ? capabilities.speech
        : capabilities.videoGeneration;

  async function generate() {
    if (kind !== "video" && kind !== "image" && kind !== "voice") return;
    const selectedKind = kind;
    const text = prompt.trim();
    if (!text || submitting || !available) return;
    setSubmitting(true);
    setMessage("");
    try {
      await generation.start(
        selectedKind,
        record =>
          selectedKind === "video"
            ? platformApi.createVideo({
                requestId: record.id,
                assetName: record.outputName,
                prompt: text,
                duration: seconds,
                resolution: "720p",
                generateAudio: false,
                aspectRatio: project.aspectRatio,
                projectId: project.id,
                rightsConfirmed: true,
                referenceContainsRealPerson: false,
                realPersonConsentConfirmed: false,
              })
            : selectedKind === "voice"
              ? platformApi.synthesizeSpeech({
                  requestId: record.id,
                  acceptedCredits: unitCost,
                  text,
                  voice,
                  assetName: record.outputName,
                  projectId: project.id,
                  rightsConfirmed: true,
                })
              : platformApi.generateImage({
                  prompt: text,
                  assetName: record.outputName,
                  aspectRatio: project.aspectRatio,
                  resolution: "1K",
                  rightsConfirmed: true,
                  referenceContainsRealPerson: false,
                  realPersonConsentConfirmed: false,
                }),
        count
      );
      setMessage(
        `${count === 1 ? "Generation" : `${count} generations`} started. You can keep creating while your files finish.`
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not start generation."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-label={ui("Create and manage media")} className="min-w-0">
      <div
        role="tablist"
        tabIndex={-1}
        aria-label={ui("Media tools")}
        onKeyDown={e => {
          const tabs = Array.from(
            e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
          );
          const index = tabs.indexOf(e.target as HTMLButtonElement);
          if (index < 0) return;
          const next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? tabs.length - 1
                : ["ArrowRight", "ArrowDown"].includes(e.key)
                  ? (index + 1) % tabs.length
                  : ["ArrowLeft", "ArrowUp"].includes(e.key)
                    ? (index - 1 + tabs.length) % tabs.length
                    : -1;
          if (next < 0) return;
          e.preventDefault();
          e.stopPropagation();
          tabs[next].focus();
          tabs[next].click();
        }}
        className="grid grid-cols-3 gap-1 border-b border-border p-2"
      >
        {(
          [
            ["library", ui("Library"), Files],
            ["video", ui("Video"), Film],
            ["image", ui("Image"), Image],
            ["audio", ui("Audio"), Music2],
            ["captions", ui("Captions"), Captions],
            ["graphics", ui("Graphics"), Shapes],
            ["effects", ui("Transitions"), SlidersHorizontal],
            ["color", ui("Color"), Palette],
            ["adjust", ui("Adjust"), MousePointer2],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            tabIndex={activeTool === id ? 0 : -1}
            aria-selected={activeTool === id}
            aria-controls={`media-panel-${project.id}`}
            onClick={() => {
              onToolChange(id);
              setMessage("");
            }}
            className={`${""} flex min-w-0 items-center justify-center gap-1.5 rounded-lg border px-1.5 py-2 text-sm transition-colors ${activeTool === id ? "border-primary/60 bg-primary/10 text-primary" : "border-transparent text-foreground/65 hover:bg-foreground/5 hover:text-foreground"}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`media-panel-${project.id}`} className="p-3">
        {activeTool === "effects" && effects}
        {activeTool === "audio" && (
          <div
            className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-background p-1"
            role="group"
            aria-label={ui("Audio tools")}
          >
            {(["voice", "sounds"] as const).map(tab => (
              <button
                type="button"
                key={tab}
                aria-pressed={audioMode === tab}
                onClick={() => setAudioMode(tab)}
                className={`rounded-md px-2 py-2 text-sm ${audioMode === tab ? "bg-primary/15 text-primary" : "text-foreground/65"}`}
              >
                {tab === "voice" ? ui("Voiceover") : ui("Music & SFX")}
              </button>
            ))}
          </div>
        )}
        {activeTool === "image" && (
          <div
            role="group"
            aria-label={ui("Image tools")}
            className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-background p-1"
          >
            {(["generate", "cutout", "depth"] as const).map(mode => (
              <button
                type="button"
                key={mode}
                aria-pressed={imageMode === mode}
                onClick={() => setImageMode(mode)}
                className={`rounded-md px-2 py-2 text-xs ${imageMode === mode ? "bg-primary/15 text-primary" : "text-foreground/65"}`}
              >
                {mode === "generate"
                  ? ui("Generate")
                  : mode === "cutout"
                    ? ui("Person cutout")
                    : ui("Image depth")}
              </button>
            ))}
          </div>
        )}
        {onAssist &&
          activeTool !== "captions" &&
          !(activeTool === "image" && imageMode !== "generate") &&
          !(activeTool === "graphics" && graphicMode === "model") && (
            <button
              type="button"
              onClick={() =>
                onAssist(
                  kind === "library"
                    ? "Recommend existing library shots to support this edit, using actual filenames."
                    : kind === "graphics"
                      ? "Propose executable graphic operations for this footage: editable text, callouts, counters, countdowns, arrows or highlights. Base numbers on supplied facts; use observed timestamps and keep faces and captions clear."
                      : `Suggest the best ${kind === "voice" ? "voiceover text and delivery" : kind === "audio" ? "music and sound design" : `${kind} generation prompt`} for this edit. Provide a usable prompt in the summary; do not generate media.`
                )
              }
              className="ai-magic mb-4 ml-auto flex w-fit items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 text-xs text-primary"
            >
              {ui("Ask Reel for suggestions")}
              <WandSparkles size={14} />
            </button>
          )}
        {kind === "captions" ? (
          captions
        ) : kind === "library" ? (
          <EditorMediaLibrary playhead={playhead} onInsert={onInsert} />
        ) : kind === "graphics" ? (
          <div className="space-y-4">
            <div className="flex rounded-lg bg-background/60 p-1">
              <button
                type="button"
                aria-pressed={graphicMode === "kits"}
                onClick={() => setGraphicMode("kits")}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs ${graphicMode === "kits" ? "bg-primary/15 text-primary" : "text-foreground/60"}`}
              >
                {ui("Motion kits")}
              </button>
              <button
                type="button"
                aria-pressed={graphicMode === "presets"}
                onClick={() => setGraphicMode("presets")}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs ${graphicMode === "presets" ? "bg-primary/15 text-primary" : "text-foreground/60"}`}
              >
                {ui("Preset library")}
              </button>
              <button
                type="button"
                aria-pressed={graphicMode === "custom"}
                onClick={() => setGraphicMode("custom")}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs ${graphicMode === "custom" ? "bg-primary/15 text-primary" : "text-foreground/60"}`}
              >
                {ui("Customize")}
              </button>
              <button
                type="button"
                aria-pressed={graphicMode === "model"}
                onClick={() => setGraphicMode("model")}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs ${graphicMode === "model" ? "bg-primary/15 text-primary" : "text-foreground/60"}`}
              >
                {ui("3D pose")}
              </button>
            </div>
            {graphicMode === "kits" && (
              <MotionKitLibrary
                key={project.id}
                project={project}
                assets={workspace.assets}
                onInsert={onMotionKit}
              />
            )}
            {graphicMode === "presets" && (
              <EditorPresetLibrary
                mode="graphics"
                onGraphicPreset={preset => {
                  setGraphicPreset(current => ({
                    preset,
                    revision: (current?.revision ?? 0) + 1,
                  }));
                  setGraphicMode("custom");
                }}
              />
            )}
            {graphicMode === "model" && (
              <Suspense
                fallback={
                  <p role="status" className="text-sm text-foreground/65">
                    {ui("Loading 3D pose tools…")}
                  </p>
                }
              >
                <GlbModelComposer
                  key={project.id}
                  prepareSave={prepareModelSave}
                  onSave={async file => (await prepareModelSave())(file)}
                />
              </Suspense>
            )}
            <div hidden={graphicMode !== "custom"}>
              {graphicPreset && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium">
                    {ui(graphicPreset.preset.name)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setGraphicPreset(null)}
                    className="shrink-0 text-primary"
                  >
                    {ui("Start blank")}
                  </button>
                </div>
              )}
              <GraphicComposer
                key={
                  graphicPreset
                    ? `${project.id}:${graphicPreset.preset.id}:${graphicPreset.revision}`
                    : `${project.id}:blank`
                }
                draft={graphicPreset?.preset.graphic}
                duration={graphicPreset?.preset.duration ?? 3}
                onSave={onGraphic}
              />
            </div>
          </div>
        ) : kind === "color" ? (
          color
        ) : kind === "adjust" ? (
          adjustment
        ) : kind === "image" && imageMode === "cutout" ? (
          <PersonCutoutPanel key={project.id} projectId={project.id} />
        ) : kind === "image" && imageMode === "depth" ? (
          <ImageDepthPanel key={project.id} projectId={project.id} />
        ) : kind === "audio" ? (
          <>
            <AudioGenerator
              onGenerate={input =>
                generation.start(input.kind, record =>
                  platformApi.generateAudio({
                    ...input,
                    requestId: record.id,
                    assetName: record.outputName,
                    projectId: project.id,
                    rightsConfirmed: true,
                  })
                )
              }
            />
            <EditorSoundLibrary />
          </>
        ) : (
          <div className="space-y-3">
            <label
              className="block text-xs font-medium text-foreground/65"
              htmlFor={`generation-prompt-${project.id}`}
            >
              {kind === "voice"
                ? ui("Voiceover script")
                : ui("Describe your {{kind}}", {
                    kind: kind === "image" ? ui("image") : ui("video"),
                  })}
            </label>
            <textarea
              id={`generation-prompt-${project.id}`}
              aria-label={
                kind === "voice"
                  ? ui("Voiceover text")
                  : ui("Generation prompt")
              }
              value={prompt}
              onChange={e =>
                setPrompts(values => ({ ...values, [kind]: e.target.value }))
              }
              rows={4}
              placeholder={
                kind === "voice"
                  ? ui("Write the exact words you want spoken…")
                  : ui("Describe the subject, setting, lighting, and style…")
              }
              className="w-full resize-y rounded-xl border border-border bg-background p-3 text-sm"
            />
            {kind === "video" && (
              <label className="block text-xs">
                {ui("Duration ·")} {seconds.toFixed(1)}s
                <input
                  aria-label={ui("Generated video duration")}
                  type="range"
                  min={3}
                  max={15}
                  value={seconds}
                  onChange={e => setSeconds(Number(e.target.value))}
                  className="mt-2 w-full accent-primary"
                />
              </label>
            )}
            {kind === "voice" && (
              <VoiceSelector value={voice} onChange={setVoice} />
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-foreground/65">
                {ui("Files to create")}
              </span>
              <CompactSelect
                aria-label={ui("Number of generated files")}
                value={String(count)}
                onValueChange={value => setCount(Number(value))}
                options={[1, 2, 3, 4].map(value => ({
                  value: String(value),
                  label: String(value),
                }))}
                className="w-20"
              />
            </div>
            <button
              type="button"
              disabled={submitting || !available || !prompt.trim()}
              onClick={() => void generate()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {ui("Generate")}{" "}
              {count > 1 ? ui("{{count}} files · ", { count }) : "· "}
              {unitCost * count} {ui("credits")}
            </button>
            {!available && (
              <p className="text-xs text-foreground/55">
                {ui(
                  "This generation service is not available yet. Your existing files remain available in Library."
                )}
              </p>
            )}
          </div>
        )}
        {(message || generation.message) && (
          <p
            role="status"
            className="mt-3 text-xs leading-relaxed text-foreground/65"
          >
            {generation.message || message}
          </p>
        )}
        <EditorGenerationTray
          records={generation.records}
          assets={workspace.assets}
          jobs={workspace.jobs}
          checking={generation.checking}
          onCheck={generation.check}
          onRename={generation.rename}
          onRecoverVideo={generation.recoverVideo}
        />
      </div>
    </section>
  );
}
