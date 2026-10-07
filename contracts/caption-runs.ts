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
  if (preset.animation === "word-only") {
    const word = words.find(w => w.start <= time && time < w.end);
    return word
      ? [
          {
            text: preset.uppercase ? word.text.toUpperCase() : word.text,
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
  time: number
): number {
  if (preset.animation !== "word-pulse") return 1;
  const t = Math.floor(time * 30 + 1e-7) / 30;
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
