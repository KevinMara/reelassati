import { useUiText } from "@/lib/i18n/ui";
import { ColorPicker } from "@/components/ui/color-picker";
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
  const ui = useUiText();
  const graphicKindLabels = {
    text: ui("Text"),
    callout: ui("Callout"),
    counter: ui("Counter"),
    countdown: ui("Countdown"),
    arrow: ui("Arrow"),
    highlight: ui("Highlight"),
    rectangle: ui("Rectangle"),
    ellipse: ui("Ellipse"),
    star: ui("Star"),
    line: ui("Line"),
    "spatial-title": ui("3D title"),
    "spatial-cube": ui("3D cube"),
    "spatial-orbit": ui("3D orbit"),
  };
  const animationLabels = {
    none: ui("None"),
    fade: ui("Fade"),
    pop: ui("Pop"),
    slide: ui("Slide"),
  };
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
          setError(ui("Write the words for your graphic before adding it."));
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
        {ui(
          "Editable graphics, with the same animation in preview and export."
        )}
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
        {playing ? ui("Pause motion preview") : ui("Play motion preview")}
      </button>
      <label className="block text-sm" htmlFor={`${controlId}-type`}>
        {ui("Graphic")}
        <CompactSelect
          id={`${controlId}-type`}
          aria-label={ui("Graphic type")}
          value={g.kind}
          onValueChange={value => patch("kind", value)}
          options={GRAPHIC_KINDS.map(k => ({
            value: k,
            label: graphicKindLabels[k],
          }))}
        />
      </label>
      {["text", "callout", "spatial-title"].includes(g.kind) && (
        <label className="block text-sm">
          {ui("Text")}
          <textarea
            placeholder={ui("Write your title or callout…")}
            maxLength={g.kind === "spatial-title" ? 28 : 180}
            className={field}
            value={g.text}
            onChange={e => patch("text", e.target.value)}
          />
          {g.kind === "spatial-title" &&
            spatialTitleText(g.text) !== g.text.trim() && (
              <span className="text-xs text-foreground/60">
                {ui(
                  "3D titles support Latin characters and symbols. Use Text for other scripts."
                )}
              </span>
            )}
        </label>
      )}
      {!isSpatialGraphic(g) &&
        ![
          "rectangle",
          "ellipse",
          "star",
          "line",
          "arrow",
          "highlight",
        ].includes(g.kind) && (
          <>
            <CompactSelect
              aria-label={ui("Graphic composition")}
              value={g.composition ?? "plain"}
              onValueChange={value => patch("composition", value)}
              options={[
                { value: "plain", label: ui("Plain title / label") },
                {
                  value: "lower-third",
                  label: ui("Name + role with accent bar"),
                },
                { value: "chapter", label: ui("Chapter with top rule") },
                { value: "quote", label: ui("Quote + attribution") },
                { value: "statistic", label: ui("Statistic + explanation") },
                { value: "progress", label: ui("Timed progress indicator") },
              ]}
            />
            <label className="block text-sm">
              {ui("Supporting text")}
              <input
                className={field}
                maxLength={120}
                value={g.secondaryText ?? ""}
                placeholder={ui("Role, attribution, or a short explanation…")}
                onChange={e => patch("secondaryText", e.target.value)}
              />
            </label>
            <ColorPicker
              label={ui("Graphic accent color")}
              value={g.accent ?? g.color}
              onChange={value => patch("accent", value)}
            />
          </>
        )}
      {(["rectangle", "ellipse", "star", "line"].includes(g.kind) ||
        g.composition === "progress") && (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["width", ui("Shape width %"), 1, 90, 30],
              ["height", ui("Shape height % of width"), 0.2, 60, 12],
              ["strokeWidth", ui("Stroke width %"), 0, 4, 0],
            ] as const
          )
            .filter(
              ([key]) =>
                key !== "strokeWidth" || ["rectangle", "line"].includes(g.kind)
            )
            .map(([key, label, min, max, fallback]) => (
              <label key={key} className="text-sm">
                {label}
                <input
                  className={field}
                  type="number"
                  step={0.1}
                  min={min}
                  max={max}
                  value={g[key] ?? fallback}
                  onChange={e => patch(key, Number(e.target.value))}
                />
              </label>
            ))}
        </div>
      )}
      {(g.kind === "callout" || g.kind === "rectangle") && (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["padding", ui("Card padding"), 1.5],
              ["cornerRadius", ui("Corner radius"), 0],
            ] as const
          )
            .filter(([key]) => key !== "padding" || g.kind === "callout")
            .map(([key, label, fallback]) => (
              <label key={key} className="text-sm">
                {label}
                <input
                  className={field}
                  type="number"
                  min={0}
                  max={6}
                  step={0.1}
                  value={g[key] ?? fallback}
                  onChange={e => patch(key, Number(e.target.value))}
                />
              </label>
            ))}
        </div>
      )}
      {g.kind === "counter" && (
        <div className="grid grid-cols-2 gap-2">
          {(["from", "to"] as const).map(k => (
            <label key={k} className="text-sm">
              {k === "from" ? ui("From") : ui("To")}
              <input
                aria-label={ui(k === "from" ? "Counter from" : "Counter to")}
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
              {k === "prefix" ? ui("Prefix") : ui("Suffix")}
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
        <ColorPicker
          label={ui("Graphic color")}
          value={g.color}
          onChange={value => patch("color", value)}
        />
        <ColorPicker
          label={ui("Graphic card color")}
          value={g.background}
          onChange={value => patch("background", value)}
        />
      </div>
      {(
        [
          ["x", ui("Horizontal position"), 10, 90],
          ["y", ui("Vertical position"), 10, 90],
          [
            "size",
            isSpatialGraphic(g) ? ui("Object size") : ui("Text size"),
            2,
            16,
          ],
          ["rotation", ui("Rotation"), -360, 360],
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
          <legend className="px-1 text-sm font-medium">
            {ui("3D appearance")}
          </legend>
          {(
            [
              ["pitch", ui("Tilt"), -70, 70, 1],
              ["yaw", ui("Turn"), -70, 70, 1],
              ["depth", ui("Extrusion"), 0.02, 0.65, 0.01],
              [
                "turns",
                g.kind === "spatial-title"
                  ? ui("Rocking cycles")
                  : ui("Revolutions"),
                -3,
                3,
                0.1,
              ],
              ["perspective", ui("Camera distance"), 3, 12, 0.1],
            ] as const
          ).map(([key, label, min, max, step]) => (
            <label key={key} className="block text-xs text-foreground/80">
              <span className="flex justify-between">
                <span>{label}</span>
                <span className="tabular-nums">{g.spatial![key]}</span>
              </span>
              <input
                aria-label={ui("3D {{label}}", { label })}
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
        {ui("Entrance and exit")}
        <CompactSelect
          id={`${controlId}-animation`}
          aria-label={ui("Graphic animation")}
          value={g.animation}
          onValueChange={value => patch("animation", value)}
          options={["none", "fade", "pop", "slide"].map(value => ({
            value,
            label: animationLabels[value as "none" | "fade" | "pop" | "slide"],
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
          {ui("Duration ·")} {seconds.toFixed(1)}s
          <input
            aria-label={ui("Graphic duration")}
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
        {saving
          ? ui("Saving…")
          : initial
            ? ui("Save graphic")
            : ui("Add at playhead")}
      </button>
    </form>
  );
}
