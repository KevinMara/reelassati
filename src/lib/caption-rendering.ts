import {
  captionLines,
  getCaptionPreset,
  type CaptionPreset,
} from "@contracts/editor-presets";
import type { TranscriptSegment } from "@contracts/workspace";
import { assTime, escapeAss } from "./graphic-ass";

const assColor = (hex: string) =>
  `&H00${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}`;

export function captionAssStyle(
  presetId: string | undefined,
  width: number,
  height: number
) {
  const p = getCaptionPreset(presetId);
  const border = p.background ?? p.outlineColor;
  return `Style: Caption,DejaVu Sans,${((width * p.size) / 100).toFixed(2)},${assColor(p.color)},${assColor(p.color)},${assColor(border)},${assColor(border)},${p.bold ? -1 : 0},0,0,0,100,100,0,0,${p.background ? 3 : 1},${((width * p.outline) / 100).toFixed(2)},0,${p.position === "top" ? 8 : 2},${Math.round(width * 0.08)},${Math.round(width * 0.08)},${Math.round((height * p.margin) / 100)},1`;
}

export function captionAssEvents(
  segments: readonly TranscriptSegment[],
  presetId: string | undefined,
  duration: number
) {
  const preset = getCaptionPreset(presetId);
  return segments
    .filter(
      s =>
        Number.isFinite(s.start) &&
        Number.isFinite(s.end) &&
        s.text.trim() &&
        s.end > Math.max(0, s.start) &&
        s.start < duration
    )
    .map(
      s =>
        `Dialogue: 100000,${assTime(Math.max(0, s.start))},${assTime(Math.min(duration, s.end))},Caption,,0,0,0,,${escapeAss(captionLines(s.text, preset))}`
    )
    .join("\n");
}

/** Percentage units refer to the video canvas, not the application viewport. */
export function captionTextCss(p: CaptionPreset) {
  return {
    color: p.color,
    fontFamily: '"Editor Sans", "DejaVu Sans", sans-serif',
    fontSize: `${p.size}cqw`,
    fontWeight: p.bold ? 700 : 400,
    lineHeight: 1.2,
    background: p.background,
    padding: p.background ? `${p.outline}cqw` : undefined,
    WebkitTextStroke: p.background
      ? undefined
      : `${p.outline}cqw ${p.outlineColor}`,
    paintOrder: "stroke fill" as const,
    whiteSpace: "pre" as const,
  };
}
