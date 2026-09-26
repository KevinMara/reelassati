import { useEffect, useId, useState } from "react";
import { Play, Pause } from "lucide-react";
import { CompactSelect } from "@/components/ui/compact-select";
import {
  GRAPHIC_KINDS,
  normalizeGraphic,
  type MotionGraphic,
} from "@contracts/motion-graphics";
import { MotionGraphicLayer } from "./MotionGraphicLayer";
import { GraphicMotionEditor } from "./GraphicMotionEditor";
import type { TimelineClip } from "@contracts/workspace";
import {
  isSpatialGraphic,
  spatialTitleText,
} from "@contracts/spatial-graphics";
export function GraphicComposer({
  initial,
  draft,
  onSave,
  busy = false,
  duration = 3,
}: {
  initial?: MotionGraphic;
  /** Preset seed for a new graphic, preserving the editable duration and insert action. */
  draft?: MotionGraphic;
  onSave: (graphic: MotionGraphic, seconds: number) => Promise<void>;
  busy?: boolean;
  duration?: number;
}) {
  const controlId = useId();
  const [g, setG] = useState<MotionGraphic>(() =>
    normalizeGraphic(initial ?? draft ?? { kind: "text", text: "" })!
  );
  const [requestedSeconds, setSeconds] = useState(duration);
  const seconds = initial ? duration : requestedSeconds;
  const [previewPosition, setPreviewPosition] = useState(0.5);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setPreviewPosition(
        (((now - start) / 1000) % Math.max(0.1, seconds)) /
          Math.max(0.1, seconds)
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, seconds]);
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const patch = (key: keyof MotionGraphic, value: string | number) =>
    setG(normalizeGraphic({ ...g, [key]: value })!);
  const field =
    "w-full rounded-lg border border-border bg-background p-2 text-sm";
  const clip: TimelineClip = {
    id: "preview",
    track: "overlay",
    label: "Graphic preview",
    start: 0,
    duration: seconds,
    inPoint: 0,
    outPoint: seconds,
    locked: false,
    color: g.background,
    graphic: g,
  };
  return (
    <form
      className="space-y-3"
      onSubmit={e => {
        e.preventDefault();
        if (
          ["text", "callout", "spatial-title"].includes(g.kind) &&
          !g.text.trim()
        ) {
          setError("Write the words for your graphic before adding it.");
          return;
        }
        setSaving(true);
        setError("");
        void onSave(g, seconds)
          .catch(e =>
            setError(e instanceof Error ? e.message : "Could not save graphic.")
          )
          .finally(() => setSaving(false));
      }}
    >
      <p className="text-sm text-foreground/70">
        Editable graphics, with the same animation in preview and export.
      </p>
      <div
        className="relative aspect-video overflow-hidden rounded-lg bg-black"
        style={{ containerType: "inline-size" }}
      >
        <MotionGraphicLayer
          clip={clip}
          time={previewPosition * Math.max(1 / 30, seconds - 1 / 30)}
        />
      </div>
      <button
        type="button"
        onClick={() => setPlaying(value => !value)}
        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"
      >
        {playing ? (
          <Pause className="size-3.5" />
        ) : (
          <Play className="size-3.5" />
        )}
        {playing ? "Pause motion preview" : "Play motion preview"}
      </button>
      <label className="block text-sm" htmlFor={`${controlId}-type`}>
        Graphic
        <CompactSelect
          id={`${controlId}-type`}
          aria-label="Graphic type"
          value={g.kind}
          onValueChange={value => patch("kind", value)}
          options={GRAPHIC_KINDS.map(k => ({
            value: k,
            label: k.startsWith("spatial-")
              ? `3D ${k.slice(8)}`
              : k[0].toUpperCase() + k.slice(1),
          }))}
        />
      </label>
      {["text", "callout", "spatial-title"].includes(g.kind) && (
        <label className="block text-sm">
          Text
          <textarea
            placeholder="Write your title or callout…"
            maxLength={g.kind === "spatial-title" ? 28 : 180}
            className={field}
            value={g.text}
            onChange={e => patch("text", e.target.value)}
          />
          {g.kind === "spatial-title" &&
            spatialTitleText(g.text) !== g.text.trim() && (
              <span className="text-xs text-foreground/60">
                3D titles support Latin characters and symbols. Use Text for
                other scripts.
              </span>
            )}
        </label>
      )}
      {g.kind === "counter" && (
        <div className="grid grid-cols-2 gap-2">
          {(["from", "to"] as const).map(k => (
            <label key={k} className="text-sm">
              {k}
              <input
                aria-label={`Counter ${k}`}
                type="number"
                min={-1e9}
                max={1e9}
                className={field}
                value={g[k]}
                onChange={e => patch(k, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
      )}
      {["counter", "countdown"].includes(g.kind) && (
        <div className="grid grid-cols-2 gap-2">
          {(["prefix", "suffix"] as const).map(k => (
            <label key={k} className="text-sm">
              {k}
              <input
                maxLength={12}
                className={field}
                value={g[k]}
                onChange={e => patch(k, e.target.value)}
              />
            </label>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">
          Color
          <input
            aria-label="Graphic color"
            type="color"
            className="block h-9 w-full"
            value={g.color}
            onChange={e => patch("color", e.target.value)}
          />
        </label>
        <label className="text-sm">
          Card color
          <input
            aria-label="Graphic card color"
            type="color"
            className="block h-9 w-full"
            value={g.background}
            onChange={e => patch("background", e.target.value)}
          />
        </label>
      </div>
      {(
        [
          ["x", "Horizontal position", 10, 90],
          ["y", "Vertical position", 10, 90],
          ["size", isSpatialGraphic(g) ? "Object size" : "Text size", 2, 16],
          ["rotation", "Rotation", -360, 360],
        ] as const
      ).map(([key, label, min, max]) => (
        <label key={key} className="block text-sm">
          {label}
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            className="block w-full accent-primary"
            value={g[key] ?? 0}
            disabled={Boolean(g.motion?.length) && key !== "size"}
            onChange={e => patch(key, Number(e.target.value))}
          />
        </label>
      ))}
      {isSpatialGraphic(g) && g.spatial && (
        <fieldset className="space-y-2 rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-medium">3D appearance</legend>
          {(
            [
              ["pitch", "Tilt", -70, 70, 1],
              ["yaw", "Turn", -70, 70, 1],
              ["depth", "Extrusion", 0.02, 0.65, 0.01],
              [
                "turns",
                g.kind === "spatial-title" ? "Rocking cycles" : "Revolutions",
                -3,
                3,
                0.1,
              ],
              ["perspective", "Camera distance", 3, 12, 0.1],
            ] as const
          ).map(([key, label, min, max, step]) => (
            <label key={key} className="block text-xs text-foreground/80">
              <span className="flex justify-between">
                <span>{label}</span>
                <span className="tabular-nums">{g.spatial![key]}</span>
              </span>
              <input
                aria-label={`3D ${label}`}
                className="block w-full accent-primary"
                type="range"
                min={min}
                max={max}
                step={step}
                value={g.spatial![key]}
                onChange={e =>
                  setG(
                    normalizeGraphic({
                      ...g,
                      spatial: { ...g.spatial, [key]: Number(e.target.value) },
                    })!
                  )
                }
              />
            </label>
          ))}
        </fieldset>
      )}
      <label className="block text-sm" htmlFor={`${controlId}-animation`}>
        Entrance and exit
        <CompactSelect
          id={`${controlId}-animation`}
          aria-label="Graphic animation"
          value={g.animation}
          onValueChange={value => patch("animation", value)}
          options={["none", "fade", "pop", "slide"].map(value => ({
            value,
            label: value[0].toUpperCase() + value.slice(1),
          }))}
        />
      </label>
      <GraphicMotionEditor
        graphic={g}
        duration={seconds}
        position={previewPosition}
        onPosition={setPreviewPosition}
        onChange={setG}
      />
      {!initial && (
        <label className="block text-sm">
          Duration · {seconds.toFixed(1)}s
          <input
            aria-label="Graphic duration"
            type="range"
            min={0.5}
            max={30}
            step={0.1}
            className="block w-full accent-primary"
            value={seconds}
            onChange={e => setSeconds(Number(e.target.value))}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || saving}
        className="w-full rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-40"
      >
        {saving ? "Saving…" : initial ? "Save graphic" : "Add at playhead"}
      </button>
    </form>
  );
}
