import { useState } from "react";
import {
  GRAPHIC_KINDS,
  normalizeGraphic,
  type MotionGraphic,
} from "@contracts/motion-graphics";
import { MotionGraphicLayer } from "./MotionGraphicLayer";
import { GraphicMotionEditor } from "./GraphicMotionEditor";
import type { TimelineClip } from "@contracts/workspace";
export function GraphicComposer({
  initial,
  onSave,
  busy = false,
  duration = 3,
}: {
  initial?: MotionGraphic;
  onSave: (graphic: MotionGraphic, seconds: number) => Promise<void>;
  busy?: boolean;
  duration?: number;
}) {
  const [g, setG] = useState<MotionGraphic>(() =>
    normalizeGraphic(initial ?? { kind: "callout", text: "Your key message" })!
  );
  const [requestedSeconds, setSeconds] = useState(duration);
  const seconds = initial ? duration : requestedSeconds;
  const [previewPosition, setPreviewPosition] = useState(0.5);
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const patch = (key: keyof MotionGraphic, value: string | number) =>
    setG({ ...g, [key]: value });
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
      <label className="block text-sm">
        Graphic
        <select
          aria-label="Graphic type"
          className={field}
          value={g.kind}
          onChange={e => patch("kind", e.target.value)}
        >
          {GRAPHIC_KINDS.map(k => (
            <option key={k} value={k}>
              {k[0].toUpperCase() + k.slice(1)}
            </option>
          ))}
        </select>
      </label>
      {["text", "callout"].includes(g.kind) && (
        <label className="block text-sm">
          Text
          <textarea
            maxLength={180}
            className={field}
            value={g.text}
            onChange={e => patch("text", e.target.value)}
          />
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
          ["size", "Text size", 2, 16],
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
      <label className="block text-sm">
        Animation
        <select
          className={field}
          value={g.animation}
          onChange={e => patch("animation", e.target.value)}
        >
          {["none", "fade", "pop", "slide"].map(a => (
            <option key={a}>{a}</option>
          ))}
        </select>
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
