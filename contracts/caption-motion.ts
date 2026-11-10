import {
  captionLines,
  captionLineWidth,
  normalizeCaptionMotion,
  type CaptionPreset,
} from "./editor-presets";
import { normalizeTranscriptWords, spokenText } from "./transcript-timing";
import type { TranscriptSegment } from "./workspace";

export interface CaptionMotionUnit {
  text: string;
  /** Canvas-width percentages, relative to the caption block's anchor. */
  x: number;
  y: number;
  width: number;
  scale: number;
  opacity: number;
  blur: number;
  glow: number;
  color: string;
  direction: "ltr" | "rtl";
}
export interface CaptionMotionFrame {
  units: CaptionMotionUnit[];
  height: number;
  anchor: "left" | "center" | "right";
  verticalAnchor: "top" | "center" | "bottom";
}
const graphemes = (text: string) =>
  [
    ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
  ].map(g => g.segment);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
function ease(
  p: number,
  kind: ReturnType<typeof normalizeCaptionMotion>["easing"]
) {
  if (kind === "linear") return p;
  if (kind === "smooth") return 1 - (1 - p) ** 3;
  if (kind === "snappy") return 1 - (1 - p) ** 5;
  const c = 1.70158;
  return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2;
}
function mixColor(from: string, to: string, amount: number) {
  return (
    "#" +
    [1, 3, 5]
      .map(at =>
        Math.round(
          parseInt(from.slice(at, at + 2), 16) * (1 - amount) +
            parseInt(to.slice(at, at + 2), 16) * amount
        )
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

/**
 * A shared, frame-driven composition. Speech clocks are read only. Letter
 * staggering is a visual entrance inside the measured word, never guessed ASR.
 * Undefined means the existing static caption renderer must be used.
 */
export function captionMotionFrame(
  segment: TranscriptSegment,
  preset: CaptionPreset,
  time: number,
  frameRate = 30
): CaptionMotionFrame | undefined {
  if (preset.animation !== "motion") return;
  const words = normalizeTranscriptWords(segment.text, segment.words);
  const text = captionLines(segment.text, preset);
  if (
    !words?.length ||
    words
      .map(w => spokenText(preset.uppercase ? w.text.toUpperCase() : w.text))
      .join("") !== spokenText(text)
  )
    return;
  const settings = normalizeCaptionMotion(preset.motion);
  const fps = Number.isFinite(frameRate) && frameRate > 0 ? frameRate : 30;
  const t = Math.floor(time * fps + 1e-7) / fps;
  const boundaries: number[] = [];
  words.reduce((sum, w) => {
    const next =
      sum + spokenText(preset.uppercase ? w.text.toUpperCase() : w.text).length;
    boundaries.push(next);
    return next;
  }, 0);
  const lines = text.split("\n");
  let spokenOffset = 0;
  let wordIndex = 0;
  const lettersInWord = new Map<number, number>();
  const units: CaptionMotionUnit[] = [];
  lines.forEach((line, lineIndex) => {
    // Isolating cursive Arabic/Syriac letters destroys their joining forms.
    // Preserve each connected word as the smallest animation unit instead.
    const unit =
      settings.unit === "letter" &&
      /[\p{Script=Arabic}\p{Script=Syriac}]/u.test(line)
        ? "word"
        : settings.unit;
    const rtl =
      /^[^\p{L}]*[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}]/u.test(
        line
      );
    const lineWidth = captionLineWidth(line, preset);
    const chars = graphemes(line).map(char => {
      const length = spokenText(char).length;
      if (length)
        while (
          wordIndex < words.length - 1 &&
          spokenOffset >= boundaries[wordIndex]
        )
          wordIndex++;
      const index = wordIndex;
      const letterIndex = lettersInWord.get(index) ?? 0;
      if (length) lettersInWord.set(index, letterIndex + 1);
      spokenOffset += length;
      return { text: char, wordIndex: index, letterIndex };
    });
    const groups: (typeof chars)[] = [];
    if (unit === "line") groups.push(chars);
    else
      for (const char of chars) {
        const last = groups.at(-1);
        if (unit === "word" && last && last[0].wordIndex === char.wordIndex)
          last.push(char);
        else groups.push([char]);
      }
    let cursor =
      settings.anchor === "left"
        ? 0
        : settings.anchor === "right"
          ? -lineWidth
          : -lineWidth / 2;
    if (rtl) cursor += lineWidth;
    for (const group of groups) {
      const shown = group.map(c => c.text).join("");
      const width = captionLineWidth(shown, preset);
      const initialX = rtl ? cursor - width : cursor;
      cursor += rtl ? -width : width;
      if (!shown.trim()) continue;
      const word = words[group[0].wordIndex];
      const lastWord = unit === "line" ? words[group.at(-1)!.wordIndex] : word;
      const span = Math.max(1 / fps, lastWord.end - word.start);
      const count = graphemes(
        preset.uppercase ? word.text.toUpperCase() : word.text
      ).length;
      // Leave most of each spoken word available to read, even at fast speech.
      const stagger =
        unit === "letter"
          ? Math.min(settings.stagger, (span * 0.35) / Math.max(1, count - 1)) *
            group[0].letterIndex
          : 0;
      const start =
        word.start + Math.min(settings.delay, span * 0.15) + stagger;
      const duration = Math.max(
        1 / fps,
        Math.min(settings.duration, span * 0.65, lastWord.end - start)
      );
      const progress = clamp((t - start) / duration);
      const easing = ease(progress, settings.easing);
      const remaining = 1 - easing;
      const distance = preset.size * settings.amount;
      const moves = ["rise", "drift", "bounce"].includes(settings.recipe);
      const offset = moves ? distance * remaining : 0;
      const x =
        initialX +
        (settings.direction === "left"
          ? offset
          : settings.direction === "right"
            ? -offset
            : 0);
      const y =
        (lineIndex + 0.5) * preset.size * 1.2 +
        (settings.direction === "up"
          ? offset
          : settings.direction === "down"
            ? -offset
            : 0);
      const scale = ["pop", "bounce", "focus"].includes(settings.recipe)
        ? Math.max(0.05, 1 - Math.min(0.8, settings.amount * 0.35) * remaining)
        : 1;
      const light =
        settings.recipe === "sweep"
          ? Math.sin(clamp(easing) * Math.PI) ** 2 *
            Math.min(1, settings.amount)
          : 0;
      units.push({
        text: shown,
        x,
        y,
        width,
        scale,
        opacity: t < start ? 0 : clamp(progress * 4),
        blur: settings.blur * Math.max(0, 1 - progress) ** 2,
        glow: settings.glow * (settings.recipe === "sweep" ? light : 1),
        color: mixColor(preset.color, preset.activeColor, light),
        direction: rtl ? "rtl" : "ltr",
      });
    }
  });
  return {
    units,
    height: lines.length * preset.size * 1.2,
    anchor: settings.anchor,
    verticalAnchor:
      settings.verticalAnchor === "auto"
        ? preset.position
        : settings.verticalAnchor,
  };
}
