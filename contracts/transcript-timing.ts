import type { TranscriptSegment, TranscriptWord } from "./workspace";

export const spokenText = (s: string) =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]/gu, "");

// Preserve word boundaries and meaningful decimal punctuation; tolerate transcription punctuation/case.
const lexicalTokens = (text: string) =>
  text
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .match(/[\p{L}\p{M}]+|\p{N}+(?:[.,]\p{N}+)*/gu) ?? [];
/** Accept measured words only when they still describe the complete cue text. */
export function normalizeTranscriptWords(
  text: string,
  value: unknown
): TranscriptWord[] | undefined {
  if (!Array.isArray(value) || !value.length || value.length > 5000)
    return undefined;
  const words: TranscriptWord[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") return undefined;
    const c = candidate as Record<string, unknown>;
    const word =
      typeof c.text === "string"
        ? c.text.trim()
        : typeof c.word === "string"
          ? c.word.trim()
          : "";
    if (
      !word ||
      typeof c.start !== "number" ||
      typeof c.end !== "number" ||
      !Number.isFinite(c.start) ||
      !Number.isFinite(c.end) ||
      c.end <= c.start ||
      c.end > 100_000 ||
      c.start < -100_000 ||
      (words.length && c.start < words[words.length - 1].start)
    )
      return undefined;
    words.push({ text: word, start: c.start, end: c.end });
  }
  return JSON.stringify(lexicalTokens(words.map(w => w.text).join(" "))) ===
    JSON.stringify(lexicalTokens(text))
    ? words
    : undefined;
}

/** Every timeline clock change must move real word boundaries by the same affine map. */
export function mapTranscriptTime(
  segment: TranscriptSegment,
  map: (time: number) => number,
  bounds?: { start: number; end: number }
): TranscriptSegment {
  const words = normalizeTranscriptWords(segment.text, segment.words);
  const base = { ...segment };
  delete base.words;
  let mappedWords = words?.map(w => ({
    ...w,
    start: map(w.start),
    end: map(w.end),
  }));
  let text = segment.text;
  if (bounds && mappedWords?.length) {
    const retained = mappedWords.filter(
      w => w.end > bounds.start && w.start < bounds.end
    );
    if (retained.length !== mappedWords.length) {
      const first = mappedWords.indexOf(retained[0]);
      const last = mappedWords.indexOf(retained.at(-1)!);
      const display = text.normalize("NFKC");
      const tokens = [
        ...display.matchAll(/[\p{L}\p{M}]+|\p{N}+(?:[.,]\p{N}+)*/gu),
      ];
      const countBefore = (index: number) =>
        words!
          .slice(0, index)
          .reduce((sum, w) => sum + lexicalTokens(w.text).length, 0);
      text = retained.length
        ? display
            .slice(
              first === 0 ? 0 : tokens[countBefore(first)]?.index,
              last === words!.length - 1
                ? undefined
                : tokens[countBefore(last + 1)]?.index
            )
            .trim()
        : "";
      mappedWords = retained;
    }
  }
  return {
    ...base,
    text,
    start: Math.max(bounds?.start ?? -Infinity, map(segment.start)),
    end: Math.min(bounds?.end ?? Infinity, map(segment.end)),
    ...(mappedWords?.length ? { words: mappedWords } : {}),
  };
}

export interface ProviderTranscript {
  text?: string;
  segments?: Array<{
    start?: number;
    end?: number;
    text?: string;
    words?: unknown;
  }>;
  words?: unknown;
}
/** Associate provider-measured words monotonically; absent or mismatched timings stay static. */
export function providerTranscriptSegments(
  result: ProviderTranscript,
  duration: number,
  offset = 0
): TranscriptSegment[] {
  const wordCandidates = Array.isArray(result.words) ? result.words : [];
  let segments = Array.isArray(result.segments) ? result.segments : [];
  if (!segments.length && wordCandidates.length) {
    const valid = wordCandidates.filter(
      (w): w is { word: string; start: number; end: number } =>
        w &&
        typeof w.word === "string" &&
        Number.isFinite(w.start) &&
        Number.isFinite(w.end) &&
        w.end > w.start &&
        w.start >= 0
    );
    let group: typeof valid = [];
    const flush = () => {
      if (group.length)
        segments.push({
          start: group[0].start,
          end: group[group.length - 1].end,
          text: group.map(w => w.word.trim()).join(" "),
          words: group,
        });
      group = [];
    };
    for (const word of valid) {
      if (
        group.length &&
        (word.start - group[0].start > 3 ||
          group.map(w => w.word).join(" ").length + word.word.length > 48)
      )
        flush();
      group.push(word);
    }
    flush();
  }
  if (!segments.length && result.text)
    segments = [{ start: 0, end: duration || 0.1, text: result.text }];
  return segments.flatMap((s, index) => {
    if (typeof s.text !== "string" || !s.text.trim()) return [];
    const start = Math.max(0, Number(s.start) || 0),
      end = Math.min(
        duration || Infinity,
        Math.max(start + 0.01, Number(s.end) || duration || 0.1)
      );
    if (end <= start) return [];
    const candidates = wordCandidates.filter(
      w =>
        w &&
        typeof w === "object" &&
        (w.start + w.end) / 2 >= start - 0.001 &&
        (w.start + w.end) / 2 <= end + 0.001
    );
    const measured =
      normalizeTranscriptWords(s.text, s.words) ??
      normalizeTranscriptWords(s.text, candidates);
    const words = measured?.every(
      w => w.start >= 0 && (duration <= 0 || w.end <= duration + 0.001)
    )
      ? measured
      : undefined;
    return [
      {
        id: `segment-${offset}-${index}`,
        text: s.text.trim(),
        start: offset + start,
        end: offset + end,
        ...(words
          ? {
              words: words.map(w => ({
                ...w,
                start: w.start + offset,
                end: w.end + offset,
              })),
            }
          : {}),
      },
    ];
  });
}
