import { useState, type ReactNode } from "react";
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
} from "lucide-react";
import type { MotionGraphic } from "@contracts/motion-graphics";
import type { GraphicPreset } from "@contracts/editor-presets";
import type { Asset, EditProject } from "@contracts/workspace";
import {
  imageCreditCost,
  speechCreditCost,
  videoCreditCost,
} from "@contracts/billing";
import { platformApi } from "@/lib/platform-api";
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

export type DockKind =
  "library" | "image" | "video" | "audio" | "captions" | "graphics" | "effects";

export function EditorCreationDock({
  project,
  onAssist,
  activeTool,
  onToolChange,
  captions,
  effects,
  onGraphic,
}: {
  onAssist?: (context: string) => void;
  activeTool: DockKind;
  onToolChange: (kind: DockKind) => void;
  captions: ReactNode;
  effects: ReactNode;
  onGraphic: (graphic: MotionGraphic, seconds: number) => Promise<void>;
  project: EditProject;
  playhead: number;
  onInsert: (asset: Asset) => Promise<void>;
}) {
  const { workspace, capabilities } = useWorkspace();
  const generation = useEditorGenerations(project.id);
  const [audioMode, setAudioMode] = useState<"voice" | "sounds">("voice");
  const kind =
    activeTool === "audio" && audioMode === "voice" ? "voice" : activeTool;
  const [prompts, setPrompts] = useState({ video: "", image: "", voice: "" });
  const [seconds, setSeconds] = useState(5);
  const [voice, setVoice] = useState("English_Graceful_Lady");
  const [count, setCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [graphicMode, setGraphicMode] = useState<"presets" | "custom">(
    "presets"
  );
  const [graphicPreset, setGraphicPreset] = useState<{
    preset: GraphicPreset;
    revision: number;
  } | null>(null);
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
        ? speechCreditCost(prompt.length)
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
    <section aria-label="Create and manage media" className="h-full min-w-0">
      <div
        role="tablist"
        tabIndex={-1}
        aria-label="Media tools"
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
            ["library", "Library", Files],
            ["video", "Video", Film],
            ["image", "Image", Image],
            ["audio", "Audio", Music2],
            ["captions", "Captions", Captions],
            ["graphics", "Graphics", Shapes],
            ["effects", "Looks & transitions", SlidersHorizontal],
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
            className={`${id === "effects" ? "col-span-3" : ""} flex min-w-0 items-center justify-center gap-1.5 rounded-lg border px-1.5 py-2 text-sm transition-colors ${activeTool === id ? "border-primary/60 bg-primary/10 text-primary" : "border-transparent text-foreground/65 hover:bg-foreground/5 hover:text-foreground"}`}
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
            aria-label="Audio tools"
          >
            {(["voice", "sounds"] as const).map(tab => (
              <button
                type="button"
                key={tab}
                aria-pressed={audioMode === tab}
                onClick={() => setAudioMode(tab)}
                className={`rounded-md px-2 py-2 text-sm ${audioMode === tab ? "bg-primary/15 text-primary" : "text-foreground/65"}`}
              >
                {tab === "voice" ? "Voiceover" : "Music & SFX"}
              </button>
            ))}
          </div>
        )}
        {onAssist && activeTool !== "captions" && (
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
            className="ai-magic mb-4 inline-flex items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 text-xs text-primary"
          >
            Ask Reel for suggestions
            <WandSparkles size={14} />
          </button>
        )}
        {kind === "captions" ? (
          captions
        ) : kind === "library" ? (
          <EditorMediaLibrary />
        ) : kind === "graphics" ? (
          <div className="space-y-4">
            <div className="flex rounded-lg bg-background/60 p-1">
              <button
                type="button"
                onClick={() => setGraphicMode("presets")}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs ${graphicMode === "presets" ? "bg-primary/15 text-primary" : "text-foreground/60"}`}
              >
                Preset library
              </button>
              <button
                type="button"
                onClick={() => setGraphicMode("custom")}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs ${graphicMode === "custom" ? "bg-primary/15 text-primary" : "text-foreground/60"}`}
              >
                Customize
              </button>
            </div>
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
            <div hidden={graphicMode !== "custom"}>
              {graphicPreset && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium">
                    {graphicPreset.preset.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setGraphicPreset(null)}
                    className="shrink-0 text-primary"
                  >
                    Start blank
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
              {kind === "voice" ? "Voiceover script" : `Describe your ${kind}`}
            </label>
            <textarea
              id={`generation-prompt-${project.id}`}
              aria-label={
                kind === "voice" ? "Voiceover text" : "Generation prompt"
              }
              value={prompt}
              onChange={e =>
                setPrompts(values => ({ ...values, [kind]: e.target.value }))
              }
              rows={4}
              placeholder={
                kind === "voice"
                  ? "Write the exact words you want spoken…"
                  : "Describe the subject, setting, lighting, and style…"
              }
              className="w-full resize-y rounded-xl border border-border bg-background p-3 text-sm"
            />
            {kind === "video" && (
              <label className="block text-xs">
                Duration · {seconds.toFixed(1)}s
                <input
                  aria-label="Generated video duration"
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
                Files to create
              </span>
              <CompactSelect
                aria-label="Number of generated files"
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
              Generate {count > 1 ? `${count} files · ` : "· "}
              {unitCost * count} credits
            </button>
            {!available && (
              <p className="text-xs text-foreground/55">
                This generation service is not available yet. Your existing
                files remain available in Library.
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
