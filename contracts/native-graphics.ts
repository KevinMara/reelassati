import data from "./native-graphics-data.json";
import type { MotionGraphic } from "./motion-graphics";
import {
  EDITOR_FONTS,
  editorFontMetrics,
  missingEditorFontCharacters,
} from "./editor-fonts";

export interface NativeGraphicControl {
  key: string;
  type: "text" | "color" | "number";
  label: string;
  comp: number;
  layer: number;
  property: number;
  default: string | number;
  min?: number;
  max?: number;
  textSlot?: number;
  part?: "left" | "right";
  font?: string;
  fontSize?: number;
}
export interface NativeGraphicTemplate {
  id: string;
  name: string;
  description: string;
  category: "title" | "social";
  platform?: string;
  url: string;
  sha256: string;
  sourceSha256: string;
  design?: { layout: string; motion: string; bestFor: string; avoid: string };
  compWidth: number;
  compHeight: number;
  duration: number;
  entranceEnd: number;
  exitStart: number;
  staticHold?: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  fonts: { url: string; sha256: string }[];
  controls: NativeGraphicControl[];
}
export interface NativeGraphicSettings {
  id: string;
  values: Record<string, string | number>;
  enter: number;
  exit: number;
}
export const NATIVE_GRAPHIC_TEMPLATES = data as NativeGraphicTemplate[];
const catalog = new Map(NATIVE_GRAPHIC_TEMPLATES.map(t => [t.id, t]));
export const nativeGraphicTemplate = (id: string | undefined) =>
  id ? catalog.get(id) : undefined;
export function normalizeNativeGraphic(
  value: unknown
): NativeGraphicSettings | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>,
    template = nativeGraphicTemplate(String(input.id));
  if (!template) return undefined;
  const raw =
    input.values && typeof input.values === "object"
      ? (input.values as Record<string, unknown>)
      : {};
  const values: NativeGraphicSettings["values"] = {};
  for (const c of template.controls) {
    const v = raw[c.key];
    if (c.type === "color" && typeof v === "string" && /^#[a-f\d]{6}$/i.test(v))
      values[c.key] = v.toUpperCase();
    if (c.type === "number" && typeof v === "number" && Number.isFinite(v))
      values[c.key] = Math.max(c.min ?? -500, Math.min(c.max ?? 500, v));
  }
  const seconds = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(0.1, Math.min(3, v))
      : fallback;
  return {
    id: template.id,
    values,
    enter: seconds(input.enter, 0.65),
    exit: seconds(input.exit, 0.45),
  };
}
/** Preserve the source's entrance/hold/exit regions when a user trims a title.
 * This is an explicit timing adaptation, not a whole-clip speed change. */
export function nativeGraphicSourceTime(
  template: NativeGraphicTemplate,
  settings: NativeGraphicSettings,
  elapsed: number,
  duration: number
) {
  const d = Math.max(1 / 30, duration),
    t = Math.max(0, Math.min(d, elapsed));
  const enter = Math.min(settings.enter, d * 0.3),
    exit = Math.min(settings.exit, d * 0.3);
  if (t < enter) return (t / enter) * template.entranceEnd;
  if (t > d - exit)
    return (
      template.exitStart +
      ((t - (d - exit)) / exit) * (template.duration - template.exitStart)
    );
  return template.staticHold
    ? template.entranceEnd
    : template.entranceEnd +
        ((t - enter) / (d - enter - exit)) *
          (template.exitStart - template.entranceEnd);
}
export function nativeGraphicBox(
  g: MotionGraphic,
  width: number,
  height: number
) {
  const template = nativeGraphicTemplate(g.native?.id);
  if (!template) return undefined;
  const w = (width * g.size) / 10;
  const h =
    (w * (template.bounds.height * template.compHeight)) /
    (template.bounds.width * template.compWidth);
  return {
    x: (width * g.x) / 100 - w / 2,
    y: (height * g.y) / 100 - h / 2,
    width: w,
    height: h,
  };
}
export function nativeTextValue(
  control: NativeGraphicControl,
  g: Pick<MotionGraphic, "text" | "secondaryText">
) {
  const value = (
    control.textSlot === 1 ? (g.secondaryText ?? "") : g.text
  ).trim();
  if (!control.part) return value;
  const chars = Array.from(value),
    middle = Math.ceil(chars.length / 2);
  return (
    control.part === "left" ? chars.slice(0, middle) : chars.slice(middle)
  ).join("");
}

/** Conservative checks from the exact bundled font metrics. The renderer still
 * measures and fits the actual glyph layout before producing any pixels. */
export function nativeGraphicTextProblems(
  g: MotionGraphic,
  aspectRatio = "9:16"
) {
  const template = nativeGraphicTemplate(g.native?.id);
  if (!template) return [];
  const issues: string[] = [],
    shortEdge = aspectRatio === "16:9" ? 56.25 : 100;
  const measurements: { control: NativeGraphicControl; fit: number }[] = [];
  for (const c of template.controls.filter(c => c.type === "text")) {
    const text = nativeTextValue(c, g),
      font = EDITOR_FONTS.find(f => f.postscript === c.font),
      metrics = editorFontMetrics(font?.id);
    if (!text) {
      issues.push("Write both text lines for this animation.");
      continue;
    }
    const displayed = template.category === "title" ? text.toUpperCase() : text;
    if (font && missingEditorFontCharacters(font.id, displayed).length) {
      issues.push(
        "The template font does not contain these characters. Choose a different text style."
      );
      continue;
    }
    if (metrics) {
      const measure = (s: string) =>
        Array.from(s).reduce((n, c) => n + (metrics.advances[c] ?? 1), 0);
      const original =
        template.category === "title"
          ? String(c.default).toUpperCase()
          : String(c.default);
      const fit = Math.min(
        1,
        measure(original) / Math.max(0.01, measure(displayed))
      );
      measurements.push({ control: c, fit });
    }
  }
  for (const { control: c, fit } of measurements) {
    // The renderer fits both halves to the smaller scale so one word cannot
    // contain mismatched letter sizes. The admission check must do the same.
    const sharedFit = c.part
      ? Math.min(
          ...measurements
            .filter(m => m.control.part && m.control.textSlot === c.textSlot)
            .map(m => m.fit)
        )
      : fit;
    const pixels =
      ((c.fontSize ?? 0) / template.compWidth / template.bounds.width) *
      (g.size * 10) *
      sharedFit;
    if (pixels < shortEdge / 30)
      issues.push(
        "The text is too small for mobile delivery. Shorten the copy or increase the graphic size."
      );
  }
  return [...new Set(issues)];
}
