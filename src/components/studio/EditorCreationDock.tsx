import { AudioGenerator } from "./AudioGenerator";
import { EditorMediaLibrary } from "./EditorMediaLibrary";
import { useState } from "react";
import { Film, Image, Mic2, Music2, Loader2 } from "lucide-react";
import type { Asset, EditProject } from "@contracts/workspace";
import {
  imageCreditCost,
  speechCreditCost,
  videoCreditCost,
} from "@contracts/billing";
import { platformApi } from "@/lib/platform-api";
import { useWorkspace } from "@/providers/workspace";

export function EditorCreationDock({
  project,
  onInsert,
  onAssist,
  assistCost,
}: {
  onAssist?: (context: string) => void;
  assistCost?: number;
  project: EditProject;
  playhead: number;
  onInsert: (asset: Asset) => Promise<void>;
}) {
  const { workspace, capabilities } = useWorkspace();
  const [kind, setKind] = useState<
    "library" | "image" | "video" | "voice" | "audio" | null
  >("library");
  const [prompt, setPrompt] = useState("");
  const [seconds, setSeconds] = useState(5);
  const [voice, setVoice] = useState("English_Graceful_Lady");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const cost =
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
    setBusy(true);
    setMessage("");
    try {
      if (kind === "video") {
        const result = await platformApi.createVideo({
          requestId: crypto.randomUUID(),
          assetName: prompt.slice(0, 60),
          prompt,
          duration: seconds,
          resolution: "720p",
          generateAudio: false,
          aspectRatio: project.aspectRatio,
          projectId: project.id,
          rightsConfirmed: true,
          referenceContainsRealPerson: false,
          realPersonConsentConfirmed: false,
        });
        setJobId(result.job.id);
        setMessage(
          "Video is generating. You can keep editing; check here to insert it when ready."
        );
      } else {
        const asset =
          kind === "voice"
            ? await platformApi.synthesizeSpeech({
                text: prompt,
                voice,
                assetName: "Editor voiceover",
                projectId: project.id,
                rightsConfirmed: true,
              })
            : await platformApi.generateImage({
                prompt,
                assetName: prompt.slice(0, 60),
                aspectRatio: project.aspectRatio,
                resolution: "1K",
                rightsConfirmed: true,
                referenceContainsRealPerson: false,
                realPersonConsentConfirmed: false,
              });
        await onInsert(asset);
        setMessage("Added to your timeline and Library.");
        setPrompt("");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  }
  async function checkVideo() {
    if (!jobId) return;
    setBusy(true);
    try {
      const result = await platformApi.videoJob(jobId);
      if (result.asset) {
        await onInsert(result.asset);
        setJobId(null);
        setMessage("Video inserted at the playhead.");
      } else
        setMessage(
          `Video: ${result.job.status}. Your generation remains available in the Library.`
        );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not check video.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Create media on timeline" className="h-full min-w-0">
      <div>
        <div className="flex gap-1 overflow-x-auto border-b border-border p-2">
          {(
            [
              ["library", "Library", Film],
              ["video", "Video", Film],
              ["image", "Image", Image],
              ["voice", "Voiceover", Mic2],
              ["audio", "Audio", Music2],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs ${kind === id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        {kind && (
          <div className="p-3">
            {onAssist && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  onAssist(
                    kind === "library"
                      ? "Recommend existing library shots to support this edit, using actual filenames."
                      : `Suggest the best ${kind === "voice" ? "voiceover text and delivery" : kind === "audio" ? "music and sound design" : `${kind} generation prompt`} for this edit. Provide a usable prompt in the summary; do not generate media.`
                  )
                }
                className="mb-3 rounded-lg border border-primary/30 px-3 py-2 text-sm text-primary"
              >
                AI assist · {assistCost} credits
              </button>
            )}
            {kind === "library" ? (
              <EditorMediaLibrary onInsert={onInsert} />
            ) : kind === "audio" ? (
              <div>
                <AudioGenerator projectId={project.id} onInsert={onInsert} />
                <p className="mb-3 text-sm text-foreground/70">
                  Use your uploaded or generated audio. Drop a licensed music or
                  sound-effect file onto the timeline to add more.
                </p>
                <div className="flex flex-wrap gap-2">
                  {workspace.assets
                    .filter(a => a.kind === "audio" && a.status === "ready")
                    .map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() =>
                          void onInsert(a).catch(e => setMessage(e.message))
                        }
                        className="rounded-lg border border-border p-3 text-sm"
                      >
                        {a.name} · Insert
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <textarea
                  aria-label={
                    kind === "voice" ? "Voiceover text" : "Generation prompt"
                  }
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  rows={4}
                  placeholder={
                    kind === "voice"
                      ? "Write the exact voiceover…"
                      : "Describe the supporting shot you need…"
                  }
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm"
                />
                <div className="space-y-3">
                  {kind === "video" && (
                    <label className="block text-sm">
                      Duration · {seconds}s
                      <input
                        aria-label="Generated video duration"
                        type="range"
                        min={3}
                        max={15}
                        value={seconds}
                        onChange={e => setSeconds(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                    </label>
                  )}
                  {kind === "voice" && (
                    <select
                      aria-label="Voice"
                      value={voice}
                      onChange={e => setVoice(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background p-2 text-sm"
                    >
                      <option value="English_Graceful_Lady">
                        Grace · English
                      </option>
                      <option value="English_Trustworth_Man">
                        James · English
                      </option>
                      <option value="Italian_Narrator">
                        Narratore · Italiano
                      </option>
                      <option value="Italian_BraveHeroine">
                        Sofia · Italiano
                      </option>
                    </select>
                  )}

                  <button
                    type="button"
                    disabled={busy || !available || !prompt.trim()}
                    onClick={() => void generate()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Generate · {cost} credits
                  </button>
                </div>
              </div>
            )}
            {jobId && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void checkVideo()}
                className="mt-3 rounded-lg border border-primary px-3 py-2 text-sm text-primary"
              >
                Check video & insert
              </button>
            )}
            {message && (
              <p role="status" className="mt-3 text-sm text-foreground/80">
                {message}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
