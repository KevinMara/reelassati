import { useEffect, useState } from "react";
import { Check, Search, Type, SlidersHorizontal } from "lucide-react";
import {
  CAPTION_PRESETS,
  GRAPHIC_PRESETS,
  CLIP_LOOK_PRESETS,
  FADE_PRESETS,
  type GraphicPreset,
  type ClipLookPreset,
} from "@contracts/editor-presets";
import type { TimelineClip } from "@contracts/workspace";
import { captionTextCss } from "@/lib/caption-rendering";
import { MotionGraphicLayer } from "./MotionGraphicLayer";

export interface EditorPresetLibraryProps {
  mode: "captions" | "graphics" | "looks";
  selectedCaptionId?: string;
  onCaptionPreset?: (presetId: string) => void;
  onGraphicPreset?: (preset: GraphicPreset) => void;
  onClipLook?: (preset: ClipLookPreset) => void;
  onFadePreset?: (settings: { fadeIn: number; fadeOut: number }) => void;
  disabled?: boolean;
}

/** Everything offered here has an existing editable representation and export path. */
export function EditorPresetLibrary({
  mode,
  selectedCaptionId,
  onCaptionPreset,
  onGraphicPreset,
  onClipLook,
  onFadePreset,
  disabled = false,
}: EditorPresetLibraryProps) {
  const [query, setQuery] = useState("");
  const match = (p: { name: string; description: string }) =>
    `${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase());
  const heading =
    mode === "captions"
      ? "Caption styles"
      : mode === "graphics"
        ? "Motion graphics"
        : "Looks & fades";
  return (
    <section className="space-y-3" aria-label={heading}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{heading}</h3>
        <span className="text-[11px] text-muted-foreground">
          Free · editable
        </span>
      </div>
      <label className="relative block">
        <Search
          aria-hidden="true"
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs"
          aria-label={`Search ${heading.toLowerCase()}`}
          placeholder="Search presets…"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        {mode === "captions" &&
          CAPTION_PRESETS.filter(match).map(p => (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              aria-pressed={(selectedCaptionId ?? "classic") === p.id}
              onClick={() => onCaptionPreset?.(p.id)}
              title={p.description}
              className="group relative min-w-0 rounded-xl border border-border p-2 text-left transition hover:border-primary/60 aria-pressed:border-primary aria-pressed:bg-primary/5 disabled:opacity-50"
            >
              <div
                className="relative flex aspect-[1.8] items-center justify-center overflow-hidden rounded-md bg-[#252A32]"
                style={{ containerType: "inline-size" }}
              >
                <span
                  style={{
                    ...captionTextCss(p),
                    fontSize: `${p.size * 2.6}cqw`,
                  }}
                >
                  {p.uppercase ? "YOUR STORY" : "Your story"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-1">
                <span className="truncate text-xs font-medium">{p.name}</span>
                {(selectedCaptionId ?? "classic") === p.id && (
                  <Check
                    aria-label="Selected"
                    size={13}
                    className="shrink-0 text-primary"
                  />
                )}
              </div>
            </button>
          ))}
        {mode === "graphics" &&
          GRAPHIC_PRESETS.filter(match).map(p => (
            <GraphicCard
              key={p.id}
              preset={p}
              disabled={disabled}
              onSelect={() => onGraphicPreset?.(p)}
            />
          ))}
        {mode === "looks" &&
          CLIP_LOOK_PRESETS.filter(match).map(p => (
            <button
              type="button"
              key={p.id}
              disabled={disabled}
              onClick={() => onClipLook?.(p)}
              title={p.description}
              className="rounded-xl border border-border p-3 text-left transition hover:border-primary/60 disabled:opacity-50"
            >
              <div
                className="mb-2 flex h-12 items-center justify-center rounded-md bg-gradient-to-br from-[#E9B58B] via-[#768D7D] to-[#394555]"
                style={{
                  filter: `brightness(${1 + p.settings.brightness}) contrast(${p.settings.contrast}) saturate(${p.settings.saturation})`,
                }}
              >
                <SlidersHorizontal size={20} className="text-white/80" />
              </div>
              <span className="text-xs font-medium">{p.name}</span>
            </button>
          ))}
      </div>
      {mode === "looks" && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">
            Clip entrance & exit
          </h4>
          <div className="flex flex-wrap gap-2">
            {FADE_PRESETS.filter(match).map(p => (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                title={p.description}
                onClick={() =>
                  onFadePreset?.({ fadeIn: p.fadeIn, fadeOut: p.fadeOut })
                }
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs transition hover:border-primary/60 disabled:opacity-50"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {mode === "captions" && (
        <p className="flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <Type size={13} className="mt-0.5 shrink-0" />
          Styles apply to the editable captions below. Captions already inside a
          source video remain part of that video.
        </p>
      )}
      {mode === "graphics" && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Choose a preset, then edit its text, colors, timing and motion.
        </p>
      )}
      {mode === "looks" && disabled && (
        <p className="text-[11px] text-muted-foreground">
          Select a video or image on the timeline to apply a look.
        </p>
      )}
    </section>
  );
}

function GraphicCard({
  preset,
  onSelect,
  disabled,
}: {
  preset: GraphicPreset;
  onSelect: () => void;
  disabled: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [previewTime, setPreviewTime] = useState(0.8);
  useEffect(() => {
    if (
      !hovered ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setPreviewTime(((now - start) / 1000) % preset.duration);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hovered, preset.duration]);
  const clip = {
    id: preset.id,
    start: 0,
    duration: preset.duration,
    inPoint: 0,
    outPoint: preset.duration,
    graphic: preset.graphic,
  } as TimelineClip;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      title={preset.description}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="min-w-0 rounded-xl border border-border p-2 text-left transition hover:border-primary/60 disabled:opacity-50"
    >
      <div
        className="relative aspect-[1.8] overflow-hidden rounded-md bg-[#252A32]"
        style={{ containerType: "inline-size" }}
      >
        <MotionGraphicLayer
          clip={clip}
          time={hovered ? previewTime : Math.min(0.8, preset.duration / 2)}
        />
      </div>
      <div className="mt-2 truncate text-xs font-medium">{preset.name}</div>
    </button>
  );
}
