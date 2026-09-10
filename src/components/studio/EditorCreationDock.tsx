import { createEditorSound } from "@/lib/editor-sounds";
import { useState } from "react";
import { Film, Image, Mic2, Music2, Loader2, X } from "lucide-react";
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
  playhead,
  onInsert,
}: {
  project: EditProject;
  playhead: number;
  onInsert: (asset: Asset) => Promise<void>;
}) {
  const { workspace, capabilities } = useWorkspace();
  const [kind, setKind] = useState<
    "image" | "video" | "voice" | "audio" | null
  >(null);
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
  async function insertSound(effect: "click" | "whoosh" | "impact" | "rise") {
    setBusy(true);
    try {
      const asset = await platformApi.uploadAsset(
        createEditorSound(effect),
        "audio"
      );
      await onInsert({
        ...asset,
        duration: effect === "click" ? 0.12 : effect === "impact" ? 0.6 : 1,
      });
      setMessage("Sound effect added · 0 AI credits.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not insert effect.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className="mb-4 rounded-xl border border-border bg-surface p-3"
      open={kind !== null || undefined}
    >
      <summary className="cursor-pointer px-1 py-1 text-sm font-medium">
        Create media in this edit
      </summary>
      <div className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-3 text-sm font-semibold">
            Create in this edit
          </span>
          {(
            [
              ["image", "Image", Image],
              ["video", "Video", Film],
              ["voice", "Voiceover", Mic2],
              ["audio", "Music & sound effects", Music2],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setKind(kind === id ? null : id)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${kind === id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
          <span className="ml-auto text-xs text-foreground/60">
            Insert at {playhead.toFixed(1)}s
          </span>
        </div>
        {kind && (
          <div className="mt-4 border-t border-border pt-4">
            <button
              type="button"
              aria-label="Close creation panel"
              onClick={() => setKind(null)}
              className="float-right p-2"
            >
              <X className="h-4 w-4" />
            </button>
            {kind === "audio" ? (
              <div>
                <div className="mb-4 flex flex-wrap gap-2">
                  {(["click", "whoosh", "impact", "rise"] as const).map(
                    effect => (
                      <button
                        key={effect}
                        disabled={busy || !capabilities.uploads}
                        type="button"
                        onClick={() => void insertSound(effect)}
                        className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm capitalize"
                      >
                        {effect} · 0 credits
                      </button>
                    )
                  )}
                </div>
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
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
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
    </details>
  );
}
