export const GRAPHIC_KINDS = [
  "text",
  "callout",
  "counter",
  "countdown",
  "arrow",
  "highlight",
] as const;
export type GraphicKind = (typeof GRAPHIC_KINDS)[number];
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
  return {
    text: graphicText(g, t, duration),
    opacity: g.animation === "none" ? 1 : Math.min(enter, leave),
    scale: g.animation === "pop" ? 0.8 + 0.2 * enter : 1,
    y: g.y + (g.animation === "slide" ? (1 - enter) * 6 : 0),
  };
}
