import {
  getCaptionPreset,
  type CaptionPreset,
  type CaptionAppearance,
} from "@contracts/editor-presets";
import type { TranscriptSegment } from "@contracts/workspace";
import { assTime, escapeAss } from "./graphic-ass";
import { captionRuns, captionMotion } from "@contracts/caption-runs";
import { normalizeTranscriptWords } from "@contracts/transcript-timing";

const assColor = (hex: string) =>
  `&H00${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}`;

export function captionAssStyle(
  presetId: string | undefined,
  width: number,
  height: number,
  appearance?: CaptionAppearance
) {
  const p = getCaptionPreset(presetId, appearance);
  const border = p.background ?? p.outlineColor;
  return `Style: Caption,DejaVu Sans,${((width * p.size) / 100).toFixed(2)},${assColor(p.color)},${assColor(p.color)},${assColor(border)},${assColor(border)},${p.bold ? -1 : 0},0,0,0,100,100,0,0,${p.background ? 3 : 1},${((width * p.outline) / 100).toFixed(2)},0,${p.position === "top" ? 8 : 2},${Math.round(width * 0.08)},${Math.round(width * 0.08)},${Math.round((height * p.margin) / 100)},1`;
}

export function captionAssEvents(
  segments: readonly TranscriptSegment[],
  presetId: string | undefined,
  duration: number,
  appearance?: CaptionAppearance,
  options: { width?: number; height?: number; frameRate?: number } = {}
) {
  const preset = getCaptionPreset(presetId, appearance);
  const fps = options.frameRate ?? 30;
  return segments
    .filter(
      s =>
        Number.isFinite(s.start) &&
        Number.isFinite(s.end) &&
        s.text.trim() &&
        s.end > Math.max(0, s.start) &&
        s.start < duration
    )
    .flatMap(s => {
      const start = Math.max(0, s.start),
        end = Math.min(duration, s.end);
      const words =
        preset.animation !== "none"
          ? normalizeTranscriptWords(s.text, s.words)
          : undefined;
      const points = [
        ...new Set(
          [
            start,
            end,
            ...(words
              ?.flatMap(w => [w.start, w.end])
              .filter(t => t > start && t < end) ?? []),
            ...([
              "word-pulse",
              "word-pop",
              "word-slide",
              "word-fade",
              "word-type",
            ].includes(preset.animation) && words
              ? Array.from(
                  {
                    length: Math.max(
                      0,
                      Math.ceil(end * fps) - Math.ceil(start * fps)
                    ),
                  },
                  (_, i) =>
                    Math.floor(
                      ((Math.ceil(start * fps) + i) / fps) * 100 + 1e-7
                    ) / 100
                )
              : []),
          ].map(t => Math.round(t * 100) / 100)
        ),
      ].sort((a, b) => a - b);
      return points.slice(0, -1).map((a, i) => {
        const b = points[i + 1];
        const text = captionRuns(s, preset, (a + b) / 2)
          .map(run =>
            run.hidden
              ? `{\\alpha&HFF&}${escapeAss(run.text)}{\\alpha&H00&}`
              : run.active
                ? `{\\c${assColor(preset.activeColor)}&}${escapeAss(run.text)}{\\c${assColor(preset.color)}&}`
                : escapeAss(run.text)
          )
          .join("");
        const motion = captionMotion(s, preset, (a + b) / 2, fps);
        const scale = (motion.scale * 100).toFixed(3);
        const alpha = Math.round((1 - motion.opacity) * 255)
          .toString(16)
          .padStart(2, "0");
        const position =
          options.width && options.height && preset.animation === "word-slide"
            ? `\\pos(${(options.width / 2).toFixed(2)},${(options.height * (preset.position === "top" ? preset.margin / 100 : 1 - preset.margin / 100) + (motion.y * options.width) / 100).toFixed(2)})`
            : "";
        return text
          ? `Dialogue: 100000,${assTime(a)},${assTime(b)},Caption,,0,0,0,,{\\fscx${scale}\\fscy${scale}\\alpha&H${alpha}&${position}}${text}`
          : "";
      });
    })
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
