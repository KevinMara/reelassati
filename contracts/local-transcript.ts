import type { TranscriptSegment } from "./workspace";
import { LOCAL_SPEECH_MODEL } from "./local-speech-model";

const invalid = () =>
  new Error(
    "Local speech timing is incomplete, unordered, or outside the source."
  );
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const withoutSpacing = (value: string) =>
  value.normalize("NFC").replace(/\s/gu, "");

/** Validate client-reported local timing without normalizing, filling, sorting,
 * dropping, or extending it. An empty array is a valid silent source. */
export function parseLocalTranscriptSegments(
  value: unknown,
  sourceDuration?: number
): TranscriptSegment[] {
  if (!Array.isArray(value) || value.length > 5000) throw invalid();
  if (
    sourceDuration !== undefined &&
    (!finite(sourceDuration) || sourceDuration <= 0)
  )
    throw invalid();
  const limit = Math.min(
    sourceDuration ?? LOCAL_SPEECH_MODEL.maxSeconds,
    LOCAL_SPEECH_MODEL.maxSeconds
  );
  const ids = new Set<string>();
  let previousSegmentStart = -1;
  let previousSegmentEnd = -1;
  let previousWordStart = -1;
  let previousWordEnd = -1;
  return value.map(segment => {
    if (
      !record(segment) ||
      !text(segment.id) ||
      ids.has(segment.id) ||
      !text(segment.text) ||
      !finite(segment.start) ||
      !finite(segment.end) ||
      segment.start < 0 ||
      segment.end <= segment.start ||
      segment.end > limit ||
      segment.start < previousSegmentStart ||
      segment.end < previousSegmentEnd ||
      !Array.isArray(segment.words) ||
      segment.words.length === 0 ||
      segment.words.length > 5000
    )
      throw invalid();
    ids.add(segment.id);
    const start = segment.start,
      end = segment.end;
    const words = segment.words.map(word => {
      if (
        !record(word) ||
        !text(word.text) ||
        !finite(word.start) ||
        !finite(word.end) ||
        word.start < start ||
        word.end > end ||
        word.end <= word.start ||
        word.start < previousWordStart ||
        word.end < previousWordEnd
      )
        throw invalid();
      previousWordStart = word.start;
      previousWordEnd = word.end;
      return { text: word.text, start: word.start, end: word.end };
    });
    if (
      withoutSpacing(words.map(word => word.text).join("")) !==
      withoutSpacing(segment.text)
    )
      throw invalid();
    previousSegmentStart = start;
    previousSegmentEnd = end;
    return { id: segment.id, text: segment.text, start, end, words };
  });
}
