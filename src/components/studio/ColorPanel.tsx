import { useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import type { TimelineClip } from "@contracts/workspace";
import { useUiText } from "@/lib/i18n/ui";
import { CLIP_LOOK_PRESETS } from "@contracts/editor-presets";

export const COLOR_FIELDS = [
  ["exposure", "Exposure", -2, 2, 0, 0.05],
  ["temperature", "Temperature", -1, 1, 0, 0.01],
  ["tint", "Tint", -1, 1, 0, 0.01],
  ["contrast", "Contrast", 0.5, 2, 1, 0.01],
  ["highlights", "Highlights", -1, 1, 0, 0.01],
  ["shadows", "Shadows", -1, 1, 0, 0.01],
  ["whites", "Whites", -1, 1, 0, 0.01],
  ["blacks", "Blacks", -1, 1, 0, 0.01],
  ["saturation", "Saturation", 0, 3, 1, 0.01],
] as const;
export function ColorPanel({
  clip,
  disabled,
  onChange,
  onAssist,
  onPreview,
}: {
  clip: TimelineClip | null;
  disabled: boolean;
  onChange(patch: Partial<TimelineClip>): Promise<void>;
  onAssist(): void;
  onPreview?(patch: Partial<TimelineClip>): void;
}) {
  const ui = useUiText();
  const labels = {
    exposure: ui("Exposure"),
    temperature: ui("Temperature"),
    tint: ui("Tint"),
    contrast: ui("Contrast"),
    highlights: ui("Highlights"),
    shadows: ui("Shadows"),
    whites: ui("Whites"),
    blacks: ui("Blacks"),
    saturation: ui("Saturation"),
  };
  const [draft, setDraft] = useState<Partial<TimelineClip>>({});
  const [error, setError] = useState("");
  if (!clip || clip.graphic || !["video", "overlay"].includes(clip.track))
    return (
      <p className="p-3 text-sm text-muted-foreground">
        {ui("Select footage on the timeline to adjust its color.")}
      </p>
    );
  const blocked = disabled || clip.locked;
  async function save(patch: Partial<TimelineClip>) {
    try {
      await onChange(patch);
      setError("");
      setDraft({});
    } catch {
      setError(ui("Save failed"));
    }
  }
  return (
    <section className="space-y-5" aria-label={ui("Light and color")}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{ui("Light and color")}</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {clip.label}
          </p>
        </div>
        <button
          type="button"
          disabled={blocked}
          aria-label={ui("Reset color")}
          title={ui("Reset color")}
          onClick={() => {
            const reset = Object.fromEntries(
              COLOR_FIELDS.map(([key, , , , value]) => [key, value])
            ) as Partial<TimelineClip>;
            setDraft(reset);
            void save(reset);
          }}
          className="rounded-lg p-2 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw size={15} />
        </button>
      </div>
      <button
        type="button"
        onClick={onAssist}
        disabled={blocked}
        className="ai-magic flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm text-primary"
      >
        <Sparkles size={15} />
        {ui("Ask Reel to optimize")}
      </button>
      <div className="grid grid-cols-2 gap-2">
        {CLIP_LOOK_PRESETS.slice(0, 4).map(preset => (
          <button
            type="button"
            key={preset.id}
            disabled={blocked}
            onClick={() => {
              setDraft(preset.settings);
              void save(preset.settings);
            }}
            className="rounded-lg border border-border px-2 py-2 text-xs hover:border-primary/40"
          >
            {ui(preset.name)}
          </button>
        ))}
      </div>
      {COLOR_FIELDS.map(([key, , min, max, fallback, step]) => (
        <label key={key} className="block space-y-2 text-xs">
          <span className="flex justify-between gap-2">
            <span>{labels[key]}</span>
            <span className="font-mono text-muted-foreground">
              {Number(draft[key] ?? clip[key] ?? fallback).toFixed(2)}
            </span>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            disabled={blocked}
            aria-label={labels[key]}
            value={Number(draft[key] ?? clip[key] ?? fallback)}
            onChange={e => {
              const patch = { [key]: Number(e.target.value) };
              setDraft(d => ({ ...d, ...patch }));
              onPreview?.(patch);
            }}
            onPointerUp={e =>
              void save({ [key]: Number(e.currentTarget.value) })
            }
            onKeyUp={e => {
              if (
                e.key.startsWith("Arrow") ||
                e.key === "Home" ||
                e.key === "End"
              )
                void save({ [key]: Number(e.currentTarget.value) });
            }}
            className="w-full accent-primary"
          />
        </label>
      ))}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {ui(
          "Adjustments remain editable and are included in export. Lost focus and clipped detail cannot be reconstructed by color controls."
        )}
      </p>
    </section>
  );
}
