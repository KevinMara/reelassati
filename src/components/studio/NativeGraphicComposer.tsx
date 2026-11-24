import { useEffect, useRef, useState } from "react";
import {
  nativeGraphicTemplate,
  nativeGraphicTextProblems,
  nativeTextValue,
  type NativeGraphicControl,
} from "@contracts/native-graphics";
import {
  normalizeGraphic,
  type MotionGraphic,
} from "@contracts/motion-graphics";
import { MotionGraphicLayer } from "./MotionGraphicLayer";
import { useUiText } from "@/lib/i18n/ui";
import { ColorPicker } from "@/components/ui/color-picker";
import { NativeGraphicRenderer } from "@/lib/native-graphic-renderer";

export function nativeControlLabel(c: NativeGraphicControl) {
  if (c.displayLabel) return c.displayLabel;
  if (c.label.startsWith("Text"))
    return /0[24]/.test(c.label) ? "Second line color" : "Text color";
  if (c.label.startsWith("L_") || c.label.startsWith("R_")) return "Icon color";
  if (c.type === "number")
    return c.label.includes("02") ? "Reveal width" : "Bar width";
  if (c.label.includes("Color 2")) return "Gradient end";
  if (c.label.includes("Color 1")) return "Gradient start";
  return c.label.includes("02") ? "Reveal color" : "Bar color";
}
export function NativeGraphicComposer({
  graphic,
  onChange,
  onSave,
  initial,
  seconds,
  onDuration,
  busy,
  position,
  onPosition,
  playing,
  onPlaying,
  aspectRatio = "9:16",
  embedded = false,
}: {
  graphic: MotionGraphic;
  onChange: (g: MotionGraphic) => void;
  onSave: (g: MotionGraphic, s: number) => Promise<void>;
  initial: boolean;
  seconds: number;
  onDuration: (n: number) => void;
  busy: boolean;
  position: number;
  onPosition: (n: number) => void;
  playing: boolean;
  onPlaying: () => void;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  embedded?: boolean;
}) {
  const ui = useUiText(),
    template = nativeGraphicTemplate(graphic.native!.id)!,
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const validation = useRef<NativeGraphicRenderer | undefined>(undefined);
  useEffect(
    () => () => {
      validation.current?.close();
      validation.current = undefined;
    },
    []
  );
  const patch = (v: Partial<MotionGraphic>) =>
    onChange(normalizeGraphic({ ...graphic, ...v })!);
  const native = (values: Partial<NonNullable<MotionGraphic["native"]>>) =>
    patch({ native: { ...graphic.native!, ...values } });
  const field =
    "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
  const second = template.controls.some(
    c => c.type === "text" && c.textSlot === 1
  );
  const textFields = template.controls.filter(
    (c, i, all) =>
      c.type === "text" &&
      all.findIndex(
        other => other.type === "text" && other.textSlot === c.textSlot
      ) === i
  );
  const save = async () => {
    if (validation.current) return;
    if (textFields.some(c => !nativeTextValue(c, graphic))) {
      setError(ui("Write the words for your graphic before adding it."));
      return;
    }
    const issues = nativeGraphicTextProblems(graphic, aspectRatio);
    if (issues.length) {
      setError(ui(issues[0]));
      return;
    }
    setSaving(true);
    setError("");
    let renderer: NativeGraphicRenderer | undefined;
    try {
      renderer = new NativeGraphicRenderer();
      validation.current = renderer;
      const [w, h] = aspectRatio.split(":").map(Number);
      await renderer.render(
        graphic,
        seconds / 2,
        seconds,
        320,
        Math.round((320 * h) / w)
      );
      if (validation.current === renderer) await onSave(graphic, seconds);
    } catch (e) {
      if (!renderer || validation.current === renderer)
        setError(ui(e instanceof Error ? e.message : String(e)));
    } finally {
      renderer?.close();
      if (!renderer || validation.current === renderer) {
        validation.current = undefined;
        setSaving(false);
      }
    }
  };
  const Wrapper = embedded ? "div" : "form";
  return (
    <Wrapper
      className="space-y-3"
      onSubmit={e => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="text-sm font-medium">{ui(template.name)}</p>
      <div
        className="relative mx-auto overflow-hidden rounded-lg bg-[#252A32]"
        style={{
          aspectRatio: aspectRatio.replace(":", "/"),
          width: aspectRatio === "9:16" ? "56.25%" : "100%",
        }}
      >
        <MotionGraphicLayer
          clip={{
            id: "native-preview",
            track: "overlay",
            label: template.name,
            start: 0,
            duration: seconds,
            inPoint: 0,
            outPoint: seconds,
            graphicDuration: seconds,
            locked: false,
            color: graphic.color,
            graphic,
          }}
          time={position * Math.max(1 / 30, seconds - 1 / 30)}
        />
      </div>
      <button
        type="button"
        className="rounded-lg border border-border px-3 py-2 text-xs"
        onClick={onPlaying}
      >
        {ui(playing ? "Pause motion preview" : "Play motion preview")}
      </button>
      <input
        aria-label={ui("Preview position")}
        className="w-full accent-primary"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={position}
        onChange={e => onPosition(Number(e.target.value))}
      />
      {textFields.map(c => (
        <label key={c.key} className="block text-sm">
          {c.displayLabel
            ? ui(c.displayLabel)
            : c.textSlot === 1
              ? ui("Second line")
              : `${ui("Text")}${(c.textSlot ?? 0) >= 2 ? ` ${c.textSlot! + 1}` : ""}`}
          <textarea
            className={field}
            rows={Math.min(
              5,
              Math.max(1, nativeTextValue(c, graphic).split("\n").length)
            )}
            maxLength={500}
            value={
              (c.textSlot ?? 0) >= 2
                ? String(graphic.native!.values[c.key] ?? "")
                : c.textSlot === 1
                  ? (graphic.secondaryText ?? "")
                  : graphic.text
            }
            onChange={e =>
              (c.textSlot ?? 0) >= 2
                ? native({
                    values: {
                      ...graphic.native!.values,
                      [c.key]: e.target.value,
                    },
                  })
                : patch({
                    [c.textSlot === 1 ? "secondaryText" : "text"]:
                      e.target.value,
                  })
            }
          />
        </label>
      ))}
      <ColorPicker
        label={ui("Text color")}
        value={graphic.color}
        onChange={color => patch({ color })}
      />
      {second && (
        <ColorPicker
          label={ui("Second line color")}
          value={graphic.accent ?? graphic.color}
          onChange={accent => patch({ accent })}
        />
      )}
      {(
        [
          ["x", "Horizontal position", 0, 100],
          ["y", "Vertical position", 0, 100],
          ["size", "Object size", 2, 9],
          ["rotation", "Rotation", -180, 180],
        ] as const
      ).map(([key, label, min, max]) => (
        <label key={key} className="block text-sm">
          {ui(label)}
          <input
            aria-label={ui(label)}
            className="block w-full accent-primary"
            type="range"
            min={min}
            max={max}
            step={key === "size" ? 0.1 : 1}
            value={graphic[key] ?? 0}
            onChange={e => patch({ [key]: Number(e.target.value) })}
          />
        </label>
      ))}
      <div className="grid grid-cols-2 gap-2">
        {(["enter", "exit"] as const).map(key => (
          <label key={key} className="text-sm">
            {ui(key === "enter" ? "Entrance duration" : "Exit duration")}
            <input
              className={field}
              type="number"
              min={0.1}
              max={3}
              step={0.05}
              value={graphic.native![key]}
              onChange={e => native({ [key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm">
          {ui("Customize appearance")}
        </summary>
        <div className="mt-3 space-y-3">
          {template.controls
            .filter(
              c =>
                c.type !== "text" &&
                !(c.colorSlot !== undefined
                  ? c.colorSlot < 2
                  : !c.displayLabel && c.label.startsWith("Text"))
            )
            .map(c =>
              c.type === "color" ? (
                <ColorPicker
                  key={c.key}
                  label={ui(nativeControlLabel(c))}
                  value={String(graphic.native!.values[c.key] ?? c.default)}
                  onChange={value =>
                    native({
                      values: { ...graphic.native!.values, [c.key]: value },
                    })
                  }
                />
              ) : (
                <label key={c.key} className="block text-sm">
                  {ui(nativeControlLabel(c))}
                  {c.options ? (
                    <select
                      className={field}
                      value={graphic.native!.values[c.key] ?? c.default}
                      onChange={e =>
                        native({
                          values: {
                            ...graphic.native!.values,
                            [c.key]: Number(e.target.value),
                          },
                        })
                      }
                    >
                      {c.options.map((option, i) => (
                        <option key={i} value={i}>
                          {ui(option)}
                        </option>
                      ))}
                    </select>
                  ) : c.valueType === "Bool" ? (
                    <input
                      className="ml-2 accent-primary"
                      type="checkbox"
                      checked={!!(graphic.native!.values[c.key] ?? c.default)}
                      onChange={e =>
                        native({
                          values: {
                            ...graphic.native!.values,
                            [c.key]: Number(e.target.checked),
                          },
                        })
                      }
                    />
                  ) : (
                    <input
                      className={field}
                      type="number"
                      min={c.min}
                      max={c.max}
                      step={c.displayedValue ? 1 : "any"}
                      value={graphic.native!.values[c.key] ?? c.default}
                      onChange={e =>
                        native({
                          values: {
                            ...graphic.native!.values,
                            [c.key]: Number(e.target.value),
                          },
                        })
                      }
                    />
                  )}
                </label>
              )
            )}
        </div>
      </details>
      {!initial && (
        <label className="block text-sm">
          {ui("Duration ·")} {seconds.toFixed(1)}s
          <input
            className="block w-full accent-primary"
            type="range"
            min={1}
            max={30}
            step={0.1}
            value={seconds}
            onChange={e => onDuration(Number(e.target.value))}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!embedded && (
        <button
          type="submit"
          className="w-full rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          disabled={busy || saving}
        >
          {ui(initial ? "Save graphic" : "Add at playhead")}
        </button>
      )}
    </Wrapper>
  );
}
