import { useUiText } from "@/lib/i18n/ui";
import {
  useState,
  useId,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from "react";
import type { Asset, TimelineClip } from "@contracts/workspace";
import type { MotionGraphic } from "@contracts/motion-graphics";
import { clipTimingLimits } from "@/lib/timeline-lanes";
import { CompactSelect } from "@/components/ui/compact-select";
import { GraphicComposer } from "./GraphicComposer";
import { EditorInfo } from "./EditorInfo";
import { VisualControls } from "./VisualControls";
import {
  audioBaseVolume,
  audioEnvelopeAt,
  MAX_AUDIO_GAIN_KEYS,
  normalizeAudioMix,
  type ClipAudioMix,
} from "@contracts/audio-mix";

function AudioMixControls({
  clip,
  asset,
  time,
  setDraft,
  onSeek,
}: {
  clip: TimelineClip;
  asset?: Asset;
  time: number;
  setDraft: Dispatch<SetStateAction<TimelineClip | null>>;
  onSeek: (time: number) => void;
}) {
  const ui = useUiText();
  const [chosenSource, setChosenSource] = useState<number | null>(null);
  const mix = normalizeAudioMix(clip.audioMix);
  const sourceLimit = Math.min(
    86400,
    Math.max(clip.outPoint, asset?.duration ?? 0)
  );
  const playheadSource = Math.max(
    clip.inPoint,
    Math.min(
      clip.outPoint,
      clip.inPoint + (time - clip.start) * (clip.speed ?? 1)
    )
  );
  const source = chosenSource ?? Number(playheadSource.toFixed(3));
  const update = (change: (current: ClipAudioMix) => ClipAudioMix) =>
    setDraft(current =>
      current && !current.locked
        ? {
            ...current,
            audioMix: normalizeAudioMix(
              change(normalizeAudioMix(current.audioMix))
            ),
          }
        : current
    );
  const field =
    "min-w-0 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm";
  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <label className="block text-sm">
        <span className="mb-2 flex justify-between">
          <span>{ui("Stereo pan")}</span>
          <span className="font-mono text-foreground/65">
            {mix.pan === 0
              ? ui("Center")
              : `${Math.round(Math.abs(mix.pan) * 100)}% ${mix.pan < 0 ? ui("left") : ui("right")}`}
          </span>
        </span>
        <input
          type="range"
          aria-label={ui("Stereo pan")}
          min={-1}
          max={1}
          step={0.01}
          value={mix.pan}
          disabled={clip.locked}
          onChange={event =>
            update(current => ({ ...current, pan: Number(event.target.value) }))
          }
          className="w-full accent-primary"
        />
      </label>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{ui("Gain envelope")}</p>
        <span className="text-xs text-foreground/60">
          {mix.gainKeys.length}/{MAX_AUDIO_GAIN_KEYS} {ui("keys")}
        </span>
      </div>
      <p className="text-xs text-foreground/60">
        {ui(
          "Keys use seconds in the original file and multiply Audio gain. They stay attached to that sound when you trim, split, move, or change speed."
        )}
      </p>
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <label className="text-xs text-foreground/60">
          {ui("New key at source second")}
          <input
            type="number"
            min={0}
            max={sourceLimit}
            step={0.01}
            aria-label={ui("New audio key source second")}
            className={`${field} mt-1`}
            value={source}
            disabled={clip.locked}
            onChange={event =>
              setChosenSource(
                Math.max(0, Math.min(sourceLimit, Number(event.target.value)))
              )
            }
          />
        </label>
        <button
          type="button"
          disabled={
            clip.locked ||
            (mix.gainKeys.length >= MAX_AUDIO_GAIN_KEYS &&
              !mix.gainKeys.some(key => key.at === source))
          }
          onClick={() =>
            update(current => ({
              ...current,
              gainKeys: [
                ...current.gainKeys.filter(key => key.at !== source),
                { at: source, gain: audioEnvelopeAt(current, source) },
              ],
            }))
          }
          className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
        >
          {ui("Add key")}
        </button>
      </div>
      <button
        type="button"
        disabled={clip.locked}
        onClick={() => setChosenSource(Number(playheadSource.toFixed(3)))}
        className="text-xs text-primary disabled:opacity-40"
      >
        {ui("Use playhead · source")} {playheadSource.toFixed(3)}s
      </button>
      {mix.gainKeys.length > 0 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 text-xs text-foreground/60">
            <span>{ui("Source seconds")}</span>
            <span>{ui("Gain ×")}</span>
            <span className="sr-only">{ui("Go to key")}</span>
            <span className="sr-only">{ui("Remove key")}</span>
          </div>
          {mix.gainKeys.map((key, index) => {
            const inClip = key.at >= clip.inPoint && key.at < clip.outPoint;
            return (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_auto_auto] gap-2"
              >
                <input
                  type="number"
                  min={0}
                  max={sourceLimit}
                  step={0.01}
                  className={field}
                  value={key.at}
                  disabled={clip.locked}
                  aria-label={`Audio gain key ${index + 1} source second`}
                  title={
                    inClip
                      ? ui("Key inside this clip")
                      : ui("Retained key outside this clip's current trim")
                  }
                  onChange={event =>
                    update(current => ({
                      ...current,
                      gainKeys: current.gainKeys.map((value, i) =>
                        i === index
                          ? {
                              ...value,
                              at: Math.max(
                                0,
                                Math.min(
                                  sourceLimit,
                                  Number(event.target.value)
                                )
                              ),
                            }
                          : value
                      ),
                    }))
                  }
                />
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.05}
                  className={field}
                  value={Number(key.gain.toFixed(3))}
                  disabled={clip.locked}
                  aria-label={`Audio gain key ${index + 1} gain multiplier`}
                  onChange={event =>
                    update(current => ({
                      ...current,
                      gainKeys: current.gainKeys.map((value, i) =>
                        i === index
                          ? { ...value, gain: Number(event.target.value) }
                          : value
                      ),
                    }))
                  }
                />
                <button
                  type="button"
                  disabled={!inClip}
                  aria-label={`Go to audio gain key ${index + 1}`}
                  onClick={() =>
                    onSeek(
                      clip.start + (key.at - clip.inPoint) / (clip.speed ?? 1)
                    )
                  }
                  className="rounded-lg border border-border px-2 text-xs disabled:opacity-30"
                >
                  {ui("Go")}
                </button>
                <button
                  type="button"
                  disabled={clip.locked}
                  aria-label={`Remove audio gain key ${index + 1}`}
                  onClick={() =>
                    update(current => ({
                      ...current,
                      gainKeys: current.gainKeys.filter((_, i) => i !== index),
                    }))
                  }
                  className="rounded-lg border border-border px-2 text-xs disabled:opacity-40"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-foreground/60">
          {ui("No keys: constant gain across the clip.")}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={clip.locked || !mix.gainKeys.length}
          onClick={() => update(current => ({ ...current, gainKeys: [] }))}
          className="text-xs text-primary disabled:opacity-40"
        >
          {ui("Clear envelope")}
        </button>
        <button
          type="button"
          disabled={clip.locked || (!mix.gainKeys.length && mix.pan === 0)}
          onClick={() =>
            setDraft(current =>
              current && !current.locked
                ? { ...current, audioMix: undefined }
                : current
            )
          }
          className="text-xs text-primary disabled:opacity-40"
        >
          {ui("Reset pan & envelope")}
        </button>
      </div>
    </div>
  );
}

export function ClipInspector({
  draft,
  setDraft,
  asset,
  duration,
  canvas,
  onApply,
  onToggle,
  onGraphic,
  onDetach,
  time,
  onSeek,
  tracking,
}: {
  draft: TimelineClip | null;
  setDraft: Dispatch<SetStateAction<TimelineClip | null>>;
  asset?: Asset;
  duration: number;
  canvas: ReactNode;
  onApply: () => Promise<void>;
  onToggle: (key: "locked" | "muted") => Promise<void>;
  onGraphic: (graphic: MotionGraphic) => Promise<void>;
  onDetach: () => Promise<void>;
  time: number;
  onSeek: (time: number) => void;
  tracking?: ReactNode;
}) {
  const ui = useUiText();
  const [tab, setTab] = useState(draft ? "timing" : "project");
  const framingId = useId();
  const hasAudio =
    draft?.track === "audio" ||
    ["video", "audio", "export"].includes(asset?.kind ?? "");
  const bounds = draft ? clipTimingLimits(draft, asset, duration) : undefined;
  const field =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
  const set = (key: keyof TimelineClip, value: number | string) =>
    setDraft(c => {
      if (!c) return c;
      const speed = c.speed ?? 1;
      if (key === "inPoint")
        return {
          ...c,
          inPoint: Number(value),
          duration: (c.outPoint - Number(value)) / speed,
        };
      if (key === "outPoint")
        return {
          ...c,
          outPoint: Number(value),
          duration: (Number(value) - c.inPoint) / speed,
        };
      if (key === "duration")
        return {
          ...c,
          duration: Number(value),
          outPoint: c.inPoint + Number(value) * speed,
        };
      if (key === "speed")
        return {
          ...c,
          speed: Number(value),
          duration: (c.outPoint - c.inPoint) / Number(value),
        };
      return { ...c, [key]: value };
    });
  const slider = (
    key:
      | "speed"
      | "volume"
      | "fadeIn"
      | "fadeOut"
      | "brightness"
      | "contrast"
      | "saturation",
    label: string,
    min: number,
    max: number,
    fallback: number,
    step = 0.05
  ) => (
    <label key={key} className="block text-sm">
      <span className="mb-2 flex justify-between">
        <span>{label}</span>
        <span className="font-mono text-foreground/65">
          {(key === "volume" && draft
            ? audioBaseVolume(draft)
            : (draft?.[key] ?? fallback)
          ).toFixed(2)}
          {key === "speed" ? "×" : key.startsWith("fade") ? "s" : ""}
        </span>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={
          key === "volume" && draft
            ? audioBaseVolume(draft)
            : (draft?.[key] ?? fallback)
        }
        disabled={draft?.locked}
        onChange={e => set(key, Number(e.target.value))}
        className="w-full accent-primary"
      />
    </label>
  );
  return (
    <div className="space-y-5">
      <div
        className="flex flex-wrap gap-1 rounded-xl bg-background p-1"
        role="group"
        aria-label={ui("Adjustment sections")}
      >
        {[
          ["timing", "Timing"],
          ["appearance", "Picture"],
          ...(asset && asset.kind !== "audio" && draft?.track !== "audio"
            ? [["transform", "Motion & crop"]]
            : []),
          ...(hasAudio ? [["audio", "Sound"]] : []),
          ...(draft?.graphic ? [["graphic", "Graphic"]] : []),
          ["project", "Canvas & duration"],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            disabled={!draft && id !== "project"}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-2 text-sm disabled:opacity-35 ${tab === id ? "bg-surface font-medium text-primary shadow-sm" : "text-foreground/65 hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "project" ? (
        canvas
      ) : draft ? (
        <>
          <div className="flex items-center gap-3">
            <label className="min-w-0 flex-1 text-xs text-foreground/60">
              {ui("Selected clip")}
              <input
                className={`${field} mt-1`}
                value={draft.label}
                disabled={draft.locked}
                onChange={e => set("label", e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => void onToggle("locked")}
              className="mt-5 rounded-lg border border-border px-3 py-2 text-sm"
            >
              {draft.locked ? ui("Unlock") : ui("Lock")}
            </button>
          </div>
          {draft.locked && (
            <p className="text-sm text-amber-600 dark:text-amber-300">
              {ui("Unlock this clip to change its settings.")}
            </p>
          )}
          {tab === "timing" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                {(
                  [
                    ["start", "Timeline start", 0, 86400],
                    [
                      "duration",
                      "Duration",
                      bounds!.minimumDuration,
                      (bounds!.sourceLimit - draft.inPoint) /
                        (draft.speed ?? 1),
                    ],
                    [
                      "inPoint",
                      "Source in",
                      0,
                      bounds!.outPoint - bounds!.minimumSourceSpan,
                    ],
                    [
                      "outPoint",
                      "Source out",
                      draft.inPoint + bounds!.minimumSourceSpan,
                      bounds!.sourceLimit,
                    ],
                  ] as const
                ).map(([key, label, min, max]) => (
                  <label key={key} className="text-sm">
                    <span className="mb-1 flex items-center">
                      {label}
                      {key === "inPoint" && (
                        <EditorInfo label={ui("Source in and out")}>
                          {ui(
                            "These are positions in the original file. Trimming changes which part is used; timeline start controls where it appears in your edit. Existing captions on the primary lane follow these changes."
                          )}
                        </EditorInfo>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        className={field}
                        type="number"
                        step={0.1}
                        min={min}
                        max={max}
                        value={Number(draft[key].toFixed(3))}
                        disabled={draft.locked}
                        onChange={e => set(key, Number(e.target.value))}
                      />
                      <span className="text-xs text-foreground/50">s</span>
                    </div>
                  </label>
                ))}
              </div>
              {slider("speed", "Playback speed", 0.25, 4, 1)}
            </>
          )}
          {tab === "appearance" && (
            <>
              <label className="block text-sm" htmlFor={framingId}>
                {ui("Framing")}
                <CompactSelect
                  id={framingId}
                  aria-label={ui("Framing")}
                  value={draft.fit ?? "contain"}
                  disabled={draft.locked}
                  onValueChange={value => set("fit", value)}
                  options={[
                    { value: "contain", label: "Fit whole shot" },
                    { value: "cover", label: "Fill frame" },
                  ]}
                  className="mt-2"
                />
              </label>
              {slider("brightness", "Brightness", -0.5, 0.5, 0)}
              {slider("contrast", "Contrast", 0.5, 2, 1)}
              {slider("saturation", "Saturation", 0, 2, 1)}
              <p className="text-xs text-foreground/60">
                {ui(
                  "Browse Looks & transitions in the left tool panel for reusable treatments."
                )}
              </p>
            </>
          )}
          {tab === "transform" && (
            <VisualControls
              clip={draft}
              time={time}
              onChange={setDraft}
              onSeek={onSeek}
            />
          )}
          {tab === "audio" && hasAudio && (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={draft.locked}
                  onClick={() => void onToggle("muted")}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  {draft.muted ? ui("Unmute") : ui("Mute")}
                </button>
                {asset?.kind === "video" && draft.track !== "audio" && (
                  <button
                    type="button"
                    disabled={draft.locked || draft.muted}
                    onClick={() => void onDetach()}
                    className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
                  >
                    {ui("Detach audio")}
                  </button>
                )}
                <EditorInfo label={ui("Detach audio")}>
                  {ui(
                    "Creates an independently editable audio clip with the same timing and mutes the source video's sound. One Undo restores both."
                  )}
                </EditorInfo>
              </div>
              {slider("volume", "Audio gain", 0, 2, 1)}
              <AudioMixControls
                key={draft.id}
                clip={draft}
                asset={asset}
                time={time}
                setDraft={setDraft}
                onSeek={onSeek}
              />
              <button
                type="button"
                disabled={draft.locked}
                onClick={() =>
                  setDraft(c =>
                    c
                      ? {
                          ...c,
                          volume: 0.2,
                          fadeIn: Math.min(0.5, c.duration / 2),
                          fadeOut: Math.min(1, c.duration / 2),
                        }
                      : c
                  )
                }
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                {ui("Set as music under dialogue")}
              </button>
            </>
          )}
          {["appearance", "audio"].includes(tab) && (
            <div className="space-y-4 rounded-xl border border-border p-4">
              <p className="flex items-center text-sm font-medium">
                {ui("Entrance & exit")}
                <EditorInfo label={ui("Clip fades")}>
                  {ui(
                    "Fades ease this clip in and out. Video fades also fade its source audio. Overlap clips on separate video lanes for a dissolve. A split preserves the original outer fades."
                  )}
                </EditorInfo>
              </p>
              {slider(
                "fadeIn",
                "Fade in",
                0,
                Math.min(5, draft.duration),
                0,
                0.1
              )}
              {slider(
                "fadeOut",
                "Fade out",
                0,
                Math.min(5, draft.duration),
                0,
                0.1
              )}
            </div>
          )}
          {tab === "graphic" && draft.graphic ? (
            <>
              <GraphicComposer
                key={JSON.stringify(draft.graphic)}
                initial={draft.graphic}
                duration={draft.duration}
                busy={draft.locked}
                onSave={onGraphic}
              />
              {tracking}
            </>
          ) : (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-xs text-foreground/60">
                {ui("Changes are saved as an undoable revision.")}
              </p>
              <button
                type="button"
                disabled={draft.locked}
                onClick={() => void onApply()}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                {ui("Apply changes")}
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-foreground/60">
          {ui("Select a clip on the timeline to adjust it.")}
        </p>
      )}
    </div>
  );
}
