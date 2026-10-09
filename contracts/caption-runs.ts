import { captionLines, type CaptionPreset } from "./editor-presets";
import { normalizeTranscriptWords, spokenText } from "./transcript-timing";
import type { TranscriptSegment } from "./workspace";

/** Character runs share the exact same line breaks in preview and exported ASS. */
export function captionRuns(
  segment: TranscriptSegment,
  preset: CaptionPreset,
  time: number
): Array<{ text: string; active: boolean; hidden?: boolean }> {
  const text = captionLines(segment.text, preset);
  const words = normalizeTranscriptWords(segment.text, segment.words);
  if (preset.animation === "none" || !words) return [{ text, active: false }];
  const normalized = words.map(w =>
    spokenText(preset.uppercase ? w.text.toUpperCase() : w.text)
  );
  if (normalized.join("") !== spokenText(text))
    return [{ text, active: false }];
  if (
    ["word-only", "word-pop", "word-slide", "word-fade", "word-type"].includes(
      preset.animation
    )
  ) {
    const word = words.find(w => w.start <= time && time < w.end);
    let shown = word
      ? preset.uppercase
        ? word.text.toUpperCase()
        : word.text
      : "";
    if (word && preset.animation === "word-type") {
      const characters = [
        ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
          shown
        ),
      ].map(c => c.segment);
      const progress = Math.max(
        0,
        Math.min(1, (time - word.start) / Math.min(0.3, word.end - word.start))
      );
      shown = characters
        .slice(0, Math.max(1, Math.ceil(progress * characters.length)))
        .join("");
    }
    return word
      ? [
          {
            text: shown,
            active: true,
          },
        ]
      : [];
  }
  const boundaries: number[] = [];
  normalized.reduce((sum, w) => {
    boundaries.push(sum + w.length);
    return sum + w.length;
  }, 0);
  const runs: Array<{ text: string; active: boolean; hidden?: boolean }> = [];
  let offset = 0,
    index = 0;
  for (const { segment: char } of new Intl.Segmenter(undefined, {
    granularity: "grapheme",
  }).segment(text)) {
    const length = spokenText(char).length;
    if (length)
      while (index < words.length - 1 && offset >= boundaries[index]) index++;
    const active =
      !/\s/u.test(char) &&
      words[index].start <= time &&
      time < words[index].end;
    const hidden =
      preset.animation === "word-reveal" && time < words[index].start;
    offset += length;
    if (
      runs.length &&
      runs[runs.length - 1].active === active &&
      Boolean(runs[runs.length - 1].hidden) === hidden
    )
      runs[runs.length - 1].text += char;
    else runs.push({ text: char, active, ...(hidden ? { hidden: true } : {}) });
  }
  return runs;
}

/** Quantized to the export frame clock; no animation without measured words. */
export function captionPulse(
  segment: TranscriptSegment,
  preset: CaptionPreset,
  time: number,
  frameRate = 30
): number {
  if (preset.animation !== "word-pulse") return 1;
  const t = Math.floor(time * frameRate + 1e-7) / frameRate;
  const word = normalizeTranscriptWords(segment.text, segment.words)?.find(
    w => w.start <= t && t < w.end
  );
  if (!word) return 1;
  const progress = Math.min(
    1,
    (t - word.start) / Math.min(0.18, word.end - word.start)
  );
  return 1 + 0.045 * (1 - progress) ** 3;
}

/** Appearance follows actual speech intervals. Missing clocks remain static. */
export function captionMotion(
  segment: TranscriptSegment,
  preset: CaptionPreset,
  time: number,
  frameRate = 30
) {
  const t = Math.floor(time * frameRate + 1e-7) / frameRate;
  const word = normalizeTranscriptWords(segment.text, segment.words)?.find(
    w => w.start <= t && t < w.end
  );
  const p = word
    ? Math.max(
        0,
        Math.min(1, (t - word.start) / Math.min(0.16, word.end - word.start))
      )
    : 1;
  const remaining = (1 - p) ** 3;
  return {
    scale:
      preset.animation === "word-pop"
        ? 1 - 0.18 * remaining
        : captionPulse(segment, preset, time, frameRate),
    y: preset.animation === "word-slide" ? preset.size * 0.3 * remaining : 0,
    opacity:
      preset.animation === "word-fade" || preset.animation === "word-slide"
        ? 1 - remaining
        : 1,
  };
}
