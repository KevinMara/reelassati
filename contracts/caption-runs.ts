import { captionLines, type CaptionPreset } from "./editor-presets";
import { normalizeTranscriptWords, spokenText } from "./transcript-timing";
import type { TranscriptSegment } from "./workspace";

/** Character runs share the exact same line breaks in preview and exported ASS. */
export function captionRuns(
  segment: TranscriptSegment,
  preset: CaptionPreset,
  time: number
): Array<{ text: string; active: boolean }> {
  const text = captionLines(segment.text, preset);
  const words = normalizeTranscriptWords(segment.text, segment.words);
  if (preset.animation !== "active-word" || !words)
    return [{ text, active: false }];
  const normalized = words.map(w =>
    spokenText(preset.uppercase ? w.text.toUpperCase() : w.text)
  );
  if (normalized.join("") !== spokenText(text))
    return [{ text, active: false }];
  const boundaries: number[] = [];
  normalized.reduce((sum, w) => {
    boundaries.push(sum + w.length);
    return sum + w.length;
  }, 0);
  const runs: Array<{ text: string; active: boolean }> = [];
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
    offset += length;
    if (runs.length && runs[runs.length - 1].active === active)
      runs[runs.length - 1].text += char;
    else runs.push({ text: char, active });
  }
  return runs;
}
