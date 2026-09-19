export const GRAPHIC_KINDS = [
  "text",
  "callout",
  "counter",
  "countdown",
  "arrow",
  "highlight",
  "spatial-title",
  "spatial-cube",
  "spatial-orbit",
] as const;
export type GraphicKind = (typeof GRAPHIC_KINDS)[number];
export const GRAPHIC_EASINGS = [
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "hold",
] as const;
export type GraphicEasing = (typeof GRAPHIC_EASINGS)[number];

/** A bounded curve shared by preview, exported frames and control previews. */
export function graphicEasingProgress(
  progress: number,
  easing: GraphicEasing = "linear"
): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  if (t === 0 || t === 1) return t;
  if (easing === "ease-in") return t * t * t;
  if (easing === "ease-out") return 1 - Math.pow(1 - t, 3);
  if (easing === "ease-in-out")
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  if (easing === "hold") return 0;
  return t;
}

export interface GraphicKeyframe {
  at: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  /** Interpolation from this keyframe to the next. Existing paths remain linear. */
  easing?: GraphicEasing;
}
export interface MotionGraphic {
  kind: GraphicKind;
  text: string;
  color: string;
  background: string;
  x: number;
  y: number;
  size: number;
  animation: "none" | "fade" | "pop" | "slide";
  from: number;
  to: number;
  prefix: string;
  suffix: string;
  rotation?: number;
  motion?: GraphicKeyframe[];
  spatial?: {
    pitch: number;
    yaw: number;
    depth: number;
    turns: number;
    perspective: number;
  };
}
const bounded = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(min, v))
    : fallback;
export function normalizeGraphic(value: unknown): MotionGraphic | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (!GRAPHIC_KINDS.includes(v.kind as GraphicKind)) return undefined;
  const color = (c: unknown, fallback: string) =>
    typeof c === "string" && /^#[a-f\d]{6}$/i.test(c) ? c : fallback;
  const text = (t: unknown, max: number) =>
    typeof t === "string"
      ? t.replace(/[\u0000-\u001f]/g, " ").slice(0, max)
      : "";
  const motion = new Map<number, GraphicKeyframe>();
  if (Array.isArray(v.motion))
    for (const raw of v.motion.slice(0, 120)) {
      if (
        !raw ||
        typeof raw !== "object" ||
        typeof raw.at !== "number" ||
        !Number.isFinite(raw.at)
      )
        continue;
      const at = bounded(raw.at, 0, 0, 1);
      motion.set(at, {
        at,
        x: bounded(raw.x, bounded(v.x, 50, 10, 90), 0, 100),
        y: bounded(raw.y, bounded(v.y, 30, 10, 90), 0, 100),
        scale: bounded(raw.scale, 1, 0.1, 4),
        rotation: bounded(raw.rotation, 0, -720, 720),
        ...(GRAPHIC_EASINGS.includes(raw.easing as GraphicEasing)
          ? { easing: raw.easing as GraphicEasing }
          : {}),
      });
    }
  return {
    kind: v.kind as GraphicKind,
    text: text(v.text, 180),
    color: color(v.color, "#FFFFFF"),
    background: color(v.background, "#6F5AD8"),
    x: bounded(v.x, 50, 10, 90),
    y: bounded(v.y, 30, 10, 90),
    size: bounded(v.size, 7, 2, 16),
    animation: ["none", "fade", "pop", "slide"].includes(String(v.animation))
      ? (v.animation as MotionGraphic["animation"])
      : "pop",
    from: bounded(v.from, 0, -1e9, 1e9),
    to: bounded(v.to, 100, -1e9, 1e9),
    prefix: text(v.prefix, 12),
    suffix: text(v.suffix, 12),
    rotation: bounded(v.rotation, 0, -720, 720),
    ...(String(v.kind).startsWith("spatial-")
      ? {
          spatial: (() => {
            const s =
              v.spatial && typeof v.spatial === "object"
                ? (v.spatial as Record<string, unknown>)
                : {};
            return {
              pitch: bounded(s.pitch, -18, -70, 70),
              yaw: bounded(s.yaw, -25, -70, 70),
              depth: bounded(s.depth, 0.2, 0.02, 0.65),
              turns: bounded(
                s.turns,
                v.kind === "spatial-title" ? 0 : 0.4,
                -3,
                3
              ),
              perspective: bounded(s.perspective, 5, 3, 12),
            };
          })(),
        }
      : {}),
    ...(motion.size
      ? { motion: [...motion.values()].sort((a, b) => a.at - b.at) }
      : {}),
  };
}
/** Same frame clock for scrubbed preview and exported counters. */
export function graphicText(
  g: MotionGraphic,
  elapsed: number,
  duration: number
): string {
  const t = Math.floor(Math.max(0, elapsed) * 30) / 30;
  if (g.kind === "counter") {
    const p = Math.min(1, t / Math.max(1 / 30, duration * 0.75));
    return `${g.prefix}${Math.round(g.from + (g.to - g.from) * (1 - Math.pow(1 - p, 3)))}${g.suffix}`;
  }
  if (g.kind === "countdown")
    return `${g.prefix}${Math.max(0, Math.ceil(duration - t))}${g.suffix}`;
  return g.text;
}
export function graphicFrame(
  g: MotionGraphic,
  elapsed: number,
  duration: number
) {
  const t = Math.floor(Math.max(0, elapsed) * 30) / 30;
  const enter = Math.min(1, t / 0.2),
    leave = Math.min(1, Math.max(0, duration - t) / 0.15);
  const points = g.motion;
  let pose = { x: g.x, y: g.y, scale: 1, rotation: g.rotation ?? 0 };
  if (points?.length) {
    const progress = Math.min(1, t / Math.max(1 / 30, duration - 1 / 30));
    const right = points.findIndex(point => point.at >= progress);
    if (right === 0) pose = points[0];
    else if (right < 0) pose = points[points.length - 1];
    else {
      const a = points[right - 1],
        b = points[right];
      const fraction = graphicEasingProgress(
        (progress - a.at) / (b.at - a.at),
        a.easing
      );
      const mix = (from: number, to: number) => from + (to - from) * fraction;
      pose = {
        x: mix(a.x, b.x),
        y: mix(a.y, b.y),
        scale: mix(a.scale, b.scale),
        rotation: mix(a.rotation, b.rotation),
      };
    }
  }
  return {
    text: graphicText(g, t, duration),
    opacity: g.animation === "none" ? 1 : Math.min(enter, leave),
    scale: pose.scale * (g.animation === "pop" ? 0.8 + 0.2 * enter : 1),
    x: pose.x,
    rotation: pose.rotation,
    y: pose.y + (g.animation === "slide" ? (1 - enter) * 6 : 0),
  };
}
