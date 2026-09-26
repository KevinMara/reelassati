import {
  useState,
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
}) {
  const [tab, setTab] = useState(draft ? "timing" : "project");
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
          {(draft?.[key] ?? fallback).toFixed(2)}
          {key === "speed" ? "×" : key.startsWith("fade") ? "s" : ""}
        </span>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={draft?.[key] ?? fallback}
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
        aria-label="Adjustment sections"
      >
        {[
          ["timing", "Timing"],
          ["appearance", "Picture"],
          ["audio", "Sound"],
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
              Selected clip
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
              {draft.locked ? "Unlock" : "Lock"}
            </button>
          </div>
          {draft.locked && (
            <p className="text-sm text-amber-600 dark:text-amber-300">
              Unlock this clip to change its settings.
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
                        <EditorInfo label="Source in and out">
                          These are positions in the original file. Trimming
                          changes which part is used; timeline start controls
                          where it appears in your edit. Existing captions on
                          the primary lane follow these changes.
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
              <label className="block text-sm">
                Framing
                <CompactSelect
                  aria-label="Framing"
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
                Browse Looks & transitions in the left tool panel for reusable
                treatments.
              </p>
            </>
          )}
          {tab === "audio" && (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={draft.locked}
                  onClick={() => void onToggle("muted")}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  {draft.muted ? "Unmute" : "Mute"}
                </button>
                {asset?.kind === "video" && draft.track !== "audio" && (
                  <button
                    type="button"
                    disabled={draft.locked || draft.muted}
                    onClick={() => void onDetach()}
                    className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
                  >
                    Detach audio
                  </button>
                )}
                <EditorInfo label="Detach audio">
                  Creates an independently editable audio clip with the same
                  timing and mutes the source video's sound. One Undo restores
                  both.
                </EditorInfo>
              </div>
              {slider("volume", "Audio gain", 0, 2, 1)}
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
                Set as music under dialogue
              </button>
            </>
          )}
          {["appearance", "audio"].includes(tab) && (
            <div className="space-y-4 rounded-xl border border-border p-4">
              <p className="flex items-center text-sm font-medium">
                Entrance & exit
                <EditorInfo label="Clip fades">
                  Fades ease this clip in and out. Video fades also fade its
                  source audio. Overlap clips on separate video lanes for a
                  dissolve. A split preserves the original outer fades.
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
            <GraphicComposer
              key={JSON.stringify(draft.graphic)}
              initial={draft.graphic}
              duration={draft.duration}
              busy={draft.locked}
              onSave={onGraphic}
            />
          ) : (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-xs text-foreground/60">
                Changes are saved as an undoable revision.
              </p>
              <button
                type="button"
                disabled={draft.locked}
                onClick={() => void onApply()}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                Apply changes
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-foreground/60">
          Select a clip on the timeline to adjust it.
        </p>
      )}
    </div>
  );
}
