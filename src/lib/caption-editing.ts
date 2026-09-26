import type { TranscriptSegment } from "@contracts/workspace";

export function splitCaption(
  segment: TranscriptSegment,
  caret: number,
  time: number,
  id: string
): TranscriptSegment[] {
  if (time <= segment.start || time >= segment.end)
    throw new Error("Place the playhead inside this caption first.");
  let boundary = Math.max(0, Math.min(segment.text.length, caret));
  while (boundary > 0 && !/\s/.test(segment.text[boundary - 1])) boundary--;
  const left = segment.text.slice(0, boundary).trim(),
    right = segment.text.slice(boundary).trim();
  if (!left || !right)
    throw new Error(
      "Place the text cursor between the words where this caption should split."
    );
  return [
    { ...segment, text: left, end: time },
    { ...segment, id, text: right, start: time },
  ];
}
export function mergeCaptions(
  first: TranscriptSegment,
  second: TranscriptSegment
): TranscriptSegment {
  return {
    ...first,
    start: Math.min(first.start, second.start),
    end: Math.max(first.end, second.end),
    text: `${first.text.trim()} ${second.text.trim()}`.trim(),
  };
}
export function captionIssues(
  segment: TranscriptSegment,
  all: TranscriptSegment[],
  duration: number
): string[] {
  const issues: string[] = [];
  if (
    !Number.isFinite(segment.start) ||
    !Number.isFinite(segment.end) ||
    segment.start < 0 ||
    segment.end <= segment.start ||
    segment.end > duration
  )
    issues.push("Set a valid time range inside the edit.");
  if (
    all.some(
      other =>
        other.id !== segment.id &&
        other.start < segment.end &&
        other.end > segment.start
    )
  )
    issues.push("Overlaps another caption.");
  if (
    segment.end > segment.start &&
    segment.text.trim().length / (segment.end - segment.start) > 24
  )
    issues.push("Fast to read: shorten the line or allow more time.");
  return issues;
}
