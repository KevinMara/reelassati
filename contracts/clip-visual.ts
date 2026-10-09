import type { TimelineClip } from "./workspace";

export type VisualEasing =
  "linear" | "ease-in" | "ease-out" | "ease-in-out" | "hold";
export interface VisualPose {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}
export interface VisualKeyframe extends VisualPose {
  at: number;
  easing: VisualEasing;
}
export type VisualTransition =
  | "none"
  | "dissolve"
  | "wipe-left"
  | "wipe-right"
  | "wipe-up"
  | "wipe-down"
  | "slide-left"
  | "slide-right"
  | "zoom";
export interface ClipVisual extends VisualPose {
  blendMode:
    | "normal"
    | "multiply"
    | "screen"
    | "overlay"
    | "darken"
    | "lighten"
    | "difference";
  flipX: boolean;
  flipY: boolean;
  crop: { top: number; right: number; bottom: number; left: number };
  mask: "none" | "ellipse" | "rounded" | "polygon";
  polygon: Array<{ x: number; y: number }>;
  radius: number;
  keyframes: VisualKeyframe[];
  entrance: {
    kind: VisualTransition;
    duration: number;
    /** Source clock anchor; independent of pose animation. */ at?: number;
  };
  exit: {
    kind: VisualTransition;
    duration: number;
    /** Source clock anchor; independent of pose animation. */ at?: number;
  };
}
export const visualTransitions: { value: VisualTransition; label: string }[] = [
  { value: "none", label: "None" },
  { value: "dissolve", label: "Dissolve" },
  { value: "wipe-left", label: "Wipe from left" },
  { value: "wipe-right", label: "Wipe from right" },
  { value: "wipe-up", label: "Wipe from top" },
  { value: "wipe-down", label: "Wipe from bottom" },
  { value: "slide-left", label: "Slide from left" },
  { value: "slide-right", label: "Slide from right" },
  { value: "zoom", label: "Zoom reveal" },
];
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const bounded = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(min, v))
    : fallback;
export function normalizeVisual(value?: unknown): ClipVisual {
  const v = record(value);
  const pose = (p: Record<string, unknown>): VisualPose => ({
    x: bounded(p.x, 0, -100, 100),
    y: bounded(p.y, 0, -100, 100),
    scale: bounded(p.scale, 1, 0.1, 4),
    rotation: bounded(p.rotation, 0, -720, 720),
    opacity: bounded(p.opacity, 1, 0, 1),
  });
  const base = pose(v);
  const crop = record(v.crop);
  const transition = (t: unknown): ClipVisual["entrance"] => {
    const entry = record(t);
    return {
      kind: visualTransitions.some(item => item.value === entry.kind)
        ? (entry.kind as VisualTransition)
        : "none",
      duration: bounded(entry.duration, 0.5, 0.05, 5),
      ...(typeof entry.at === "number" && Number.isFinite(entry.at)
        ? { at: bounded(entry.at, 0, 0, 100000) }
        : {}),
    };
  };
  const keys = new Map<number, VisualKeyframe>();
  if (Array.isArray(v.keyframes))
    for (const candidate of v.keyframes.slice(0, 24)) {
      const k = record(candidate);
      if (typeof k.at !== "number" || !Number.isFinite(k.at)) continue;
      const at = bounded(k.at, 0, 0, 1);
      keys.set(at, {
        ...pose({ ...base, ...k }),
        at,
        easing: [
          "linear",
          "ease-in",
          "ease-out",
          "ease-in-out",
          "hold",
        ].includes(String(k.easing))
          ? (k.easing as VisualEasing)
          : "ease-in-out",
      });
    }
  return {
    ...base,
    blendMode: [
      "multiply",
      "screen",
      "overlay",
      "darken",
      "lighten",
      "difference",
    ].includes(String(v.blendMode))
      ? (v.blendMode as ClipVisual["blendMode"])
      : "normal",
    flipX: v.flipX === true,
    flipY: v.flipY === true,
    crop: {
      top: bounded(crop.top, 0, 0, 45),
      right: bounded(crop.right, 0, 0, 45),
      bottom: bounded(crop.bottom, 0, 0, 45),
      left: bounded(crop.left, 0, 0, 45),
    },
    mask:
      v.mask === "ellipse" || v.mask === "rounded" || v.mask === "polygon"
        ? v.mask
        : "none",
    polygon:
      Array.isArray(v.polygon) &&
      v.polygon.length >= 3 &&
      v.polygon
        .slice(0, 12)
        .every(
          p =>
            typeof record(p).x === "number" &&
            Number.isFinite(record(p).x) &&
            typeof record(p).y === "number" &&
            Number.isFinite(record(p).y)
        )
        ? v.polygon
            .slice(0, 12)
            .map(p => ({
              x: bounded(record(p).x, 0, 0, 100),
              y: bounded(record(p).y, 0, 0, 100),
            }))
        : [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
    radius: bounded(v.radius, 8, 0, 50),
    keyframes: [...keys.values()].sort((a, b) => a.at - b.at),
    entrance: transition(v.entrance),
    exit: transition(v.exit),
  };
}
export function visualClock(clip: TimelineClip) {
  return {
    start: clip.visualStart ?? clip.inPoint,
    duration: Math.max(
      0.001,
      clip.visualDuration ?? clip.outPoint - clip.inPoint
    ),
  };
}
export function visualProgress(clip: TimelineClip, time: number) {
  const clock = visualClock(clip);
  return Math.max(
    0,
    Math.min(
      1,
      (clip.inPoint + (time - clip.start) * (clip.speed ?? 1) - clock.start) /
        clock.duration
    )
  );
}
export function visualEase(p: number, easing: VisualEasing) {
  return easing === "hold"
    ? 0
    : easing === "ease-in"
      ? p * p
      : easing === "ease-out"
        ? 1 - (1 - p) ** 2
        : easing === "ease-in-out"
          ? p * p * (3 - 2 * p)
          : p;
}
export function visualPose(visual: ClipVisual, progress: number): VisualPose {
  const keys = visual.keyframes;
  if (!keys.length) return visual;
  if (progress <= keys[0].at) return keys[0];
  for (let i = 1; i < keys.length; i++)
    if (progress < keys[i].at) {
      const a = keys[i - 1],
        b = keys[i];
      const p = visualEase((progress - a.at) / (b.at - a.at), a.easing);
      const mix = (key: keyof VisualPose) => a[key] + (b[key] - a[key]) * p;
      return {
        x: mix("x"),
        y: mix("y"),
        scale: mix("scale"),
        rotation: mix("rotation"),
        opacity: mix("opacity"),
      };
    }
  return keys[keys.length - 1];
}
/** Shared composition in canvas coordinates. Visual transitions never change audio gain. */
export function visualFrame(clip: TimelineClip, time: number) {
  const v = normalizeVisual(clip.visual),
    clock = visualClock(clip),
    p = visualProgress(clip, time);
  const pose = { ...visualPose(v, p) };
  const reveal = { top: 0, right: 0, bottom: 0, left: 0 };
  const speed = clip.speed ?? 1;
  const span = clock.duration / speed;
  const sourceTime = clip.inPoint + (time - clip.start) * speed;
  for (const [effect, distance] of [
    [v.entrance, (sourceTime - (v.entrance.at ?? clock.start)) / speed],
    [
      v.exit,
      ((v.exit.at ?? clock.start + clock.duration) - sourceTime) / speed,
    ],
  ] as const) {
    const q = Math.max(
      0,
      Math.min(1, distance / Math.min(effect.duration, span / 2))
    );
    if (effect.kind === "dissolve" || effect.kind === "zoom") pose.opacity *= q;
    if (effect.kind === "zoom") pose.scale *= 0.8 + q * 0.2;
    if (effect.kind === "slide-left") pose.x -= (1 - q) * 100;
    if (effect.kind === "slide-right") pose.x += (1 - q) * 100;
    if (effect.kind === "wipe-left")
      reveal.right = Math.max(reveal.right, (1 - q) * 100);
    if (effect.kind === "wipe-right")
      reveal.left = Math.max(reveal.left, (1 - q) * 100);
    if (effect.kind === "wipe-up")
      reveal.bottom = Math.max(reveal.bottom, (1 - q) * 100);
    if (effect.kind === "wipe-down")
      reveal.top = Math.max(reveal.top, (1 - q) * 100);
  }
  return { ...pose, reveal, visual: v };
}

/** AI pose values shift an existing path; explicit keyframes replace that path. */
export function patchVisual(
  clip: TimelineClip,
  patch: Partial<ClipVisual>
): ClipVisual {
  const v = normalizeVisual(clip.visual);
  const next = normalizeVisual({
    ...v,
    ...patch,
    crop: { ...v.crop, ...patch.crop },
    entrance: { ...v.entrance, ...patch.entrance },
    exit: { ...v.exit, ...patch.exit },
  });
  if (patch.entrance) next.entrance.at = patch.entrance.at ?? clip.inPoint;
  if (patch.exit) next.exit.at = patch.exit.at ?? clip.outPoint;
  if (patch.keyframes === undefined && v.keyframes.length) {
    next.keyframes = v.keyframes.map(k => ({
      ...k,
      ...Object.fromEntries(
        (["x", "y", "rotation", "scale", "opacity"] as const)
          .filter(key => patch[key] !== undefined)
          .map(key => [
            key,
            key === "scale"
              ? (k.scale * next.scale) / v.scale
              : key === "opacity"
                ? v.opacity
                  ? (k.opacity * next.opacity) / v.opacity
                  : next.opacity
                : k[key] + next[key] - v[key],
          ])
      ),
    }));
  }
  return normalizeVisual(next);
}
