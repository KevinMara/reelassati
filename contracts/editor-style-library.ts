import type { EditProject, TimelineClip } from "./workspace";
import { normalizeGraphic, type MotionGraphic } from "./motion-graphics";
import { normalizeVisual, visualFrame, type ClipVisual } from "./clip-visual";
import { getCaptionPreset, type CaptionAppearance } from "./editor-presets";

export const EDITOR_SAVED_STYLE_LIMIT = 50;
export type EditorSavedStyleType = "graphic" | "captions" | "look";

export type EditorSavedStyleDraft =
  | {
      name: string;
      type: "graphic";
      graphic: MotionGraphic;
      graphicDuration: number;
    }
  | {
      name: string;
      type: "captions";
      captionStyle: string;
      captionAppearance: CaptionAppearance;
    }
  | {
      name: string;
      type: "look";
      settings: {
        brightness: number;
        contrast: number;
        saturation: number;
        fit: "contain" | "cover";
        visual: ClipVisual;
      };
    };
export type EditorSavedStyle = EditorSavedStyleDraft & { id: string };

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const bound = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, value))
    : fallback;

function styleName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value.trim();
  return name.length > 0 &&
    name.length <= 60 &&
    !Array.from(name).some(
      character =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    )
    ? name
    : undefined;
}

/** A reusable look is a static pose, never another source's animation clock. */
function staticVisual(value: unknown): ClipVisual {
  const visual = normalizeVisual(value);
  return normalizeVisual({
    x: visual.x,
    y: visual.y,
    scale: visual.scale,
    rotation: visual.rotation,
    opacity: visual.opacity,
    flipX: visual.flipX,
    flipY: visual.flipY,
    crop: visual.crop,
    mask: visual.mask,
    radius: visual.radius,
    keyframes: [],
    entrance: { kind: "none", duration: 0.5 },
    exit: { kind: "none", duration: 0.5 },
  });
}

function safeCaptionAppearance(style: string, value: unknown) {
  const preset = getCaptionPreset(style, record(value) as CaptionAppearance);
  return {
    captionStyle: preset.id,
    captionAppearance: {
      color: preset.color,
      outlineColor: preset.outlineColor,
      activeColor: preset.activeColor,
      background: preset.background ?? null,
      size: preset.size,
      bold: preset.bold,
      uppercase: preset.uppercase,
      outline: preset.outline,
      position: preset.position,
      margin: preset.margin,
      maxCharacters: preset.maxCharacters,
      animation: preset.animation,
    } satisfies CaptionAppearance,
  };
}

function normalizeDraft(value: unknown): EditorSavedStyleDraft | undefined {
  const row = record(value),
    name = styleName(row.name);
  if (!name) return undefined;
  if (row.type === "graphic") {
    const graphic = normalizeGraphic(row.graphic);
    if (
      !graphic ||
      typeof row.graphicDuration !== "number" ||
      !Number.isFinite(row.graphicDuration) ||
      row.graphicDuration < 1 ||
      row.graphicDuration > 180
    )
      return undefined;
    return {
      name,
      type: "graphic",
      graphic,
      graphicDuration: row.graphicDuration,
    };
  }
  if (row.type === "captions") {
    return {
      name,
      type: "captions",
      ...safeCaptionAppearance(
        typeof row.captionStyle === "string" ? row.captionStyle : "classic",
        row.captionAppearance
      ),
    };
  }
  if (row.type === "look") {
    const settings = record(row.settings);
    return {
      name,
      type: "look",
      settings: {
        brightness: bound(settings.brightness, 0, -0.5, 0.5),
        contrast: bound(settings.contrast, 1, 0.5, 2),
        saturation: bound(settings.saturation, 1, 0, 3),
        fit: settings.fit === "cover" ? "cover" : "contain",
        visual: staticVisual(settings.visual),
      },
    };
  }
  return undefined;
}

export function normalizeEditorSavedStyle(
  value: unknown
): EditorSavedStyle | undefined {
  const row = record(value);
  if (typeof row.id !== "string" || !/^[a-z\d_-]{1,100}$/i.test(row.id))
    return undefined;
  const draft = normalizeDraft(row);
  return draft ? { id: row.id, ...draft } : undefined;
}

/** Load only known editable fields; malformed rows and repeated IDs are discarded. */
export function normalizeEditorSavedStyles(value: unknown): EditorSavedStyle[] {
  if (!Array.isArray(value)) return [];
  const styles: EditorSavedStyle[] = [],
    ids = new Set<string>();
  for (const candidate of value.slice(0, EDITOR_SAVED_STYLE_LIMIT * 4)) {
    const style = normalizeEditorSavedStyle(candidate);
    if (!style || ids.has(style.id)) continue;
    styles.push(style);
    ids.add(style.id);
    if (styles.length === EDITOR_SAVED_STYLE_LIMIT) break;
  }
  return styles;
}

export function addEditorSavedStyle(
  styles: readonly EditorSavedStyle[] | undefined,
  value: unknown
): EditorSavedStyle[] {
  const next = normalizeEditorSavedStyle(value);
  if (!next)
    throw new Error(
      "Use a valid saved style with a name of 1 to 60 characters."
    );
  const existing = normalizeEditorSavedStyles(styles);
  if (existing.some(style => style.id === next.id))
    throw new Error("This saved style ID already exists.");
  if (existing.length >= EDITOR_SAVED_STYLE_LIMIT)
    throw new Error(
      "Delete a saved style before adding another. The limit is 50."
    );
  return [...existing, next];
}

export function removeEditorSavedStyle(
  styles: readonly EditorSavedStyle[] | undefined,
  id: string
): EditorSavedStyle[] {
  return normalizeEditorSavedStyles(styles).filter(style => style.id !== id);
}

/** Capture only selected editor settings. Asset IDs, tracking links and clocks are never copied. */
export function captureEditorStyle(
  type: EditorSavedStyleType,
  name: string,
  selectedClip: TimelineClip | null | undefined,
  project: Pick<EditProject, "captionStyle" | "captionAppearance">,
  time: number
): EditorSavedStyleDraft {
  if (!styleName(name))
    throw new Error("Use a style name of 1 to 60 characters.");
  let candidate: unknown;
  if (type === "graphic") {
    const graphic = normalizeGraphic(selectedClip?.graphic);
    if (!selectedClip || !graphic)
      throw new Error("Select an editable graphic to capture it.");
    const duration =
      selectedClip.graphicDuration ??
      selectedClip.outPoint ??
      selectedClip.duration;
    if (!Number.isFinite(duration) || duration < 1 || duration > 180)
      throw new Error(
        "Capture a graphic whose full animation spans 1 to 180 seconds."
      );
    candidate = { name, type, graphic, graphicDuration: duration };
  } else if (type === "captions") {
    candidate = {
      name,
      type,
      captionStyle: project.captionStyle,
      captionAppearance: project.captionAppearance,
    };
  } else if (type === "look") {
    if (
      !selectedClip ||
      selectedClip.track !== "video" ||
      !selectedClip.assetId ||
      selectedClip.transitionHandle
    )
      throw new Error("Select a video or image to capture its look.");
    if (
      !Number.isFinite(time) ||
      time < selectedClip.start ||
      time >= selectedClip.start + selectedClip.duration
    )
      throw new Error(
        "Move the playhead inside the selected clip to capture its current pose."
      );
    const frame = visualFrame(selectedClip, time);
    candidate = {
      name,
      type,
      settings: {
        brightness: selectedClip.brightness,
        contrast: selectedClip.contrast,
        saturation: selectedClip.saturation,
        fit: selectedClip.fit,
        visual: staticVisual({
          ...frame.visual,
          x: frame.x,
          y: frame.y,
          scale: frame.scale,
          rotation: frame.rotation,
          opacity: frame.opacity,
        }),
      },
    };
  } else throw new Error("Choose a graphic, caption style or clip look.");
  const draft = normalizeDraft(candidate);
  if (!draft) throw new Error("This editor style could not be captured.");
  return draft;
}
