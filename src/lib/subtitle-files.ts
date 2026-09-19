import { v4 as createUuid } from "uuid";
import type { TranscriptSegment } from "@contracts/workspace";

function timestamp(value: string): number {
  const m = value.match(/^(?:(\d{1,3}):)?(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!m || Number(m[2]) > 59 || Number(m[3]) > 59) return NaN;
  return (
    Number(m[1] ?? 0) * 3600 +
    Number(m[2]) * 60 +
    Number(m[3]) +
    Number(m[4].padEnd(3, "0")) / 1000
  );
}

export function parseSubtitleFile(
  input: string,
  duration = Infinity
): { segments: TranscriptSegment[]; skipped: number; clipped: number } {
  if (input.length > 2_000_000)
    throw new Error("Choose a subtitle file smaller than 2 MB.");
  const blocks = input
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n\s*\n/);
  const segments: TranscriptSegment[] = [];
  let skipped = 0,
    clipped = 0;
  for (const block of blocks) {
    if (/^(WEBVTT|NOTE(?:\s|$)|STYLE(?:\s|$)|REGION(?:\s|$))/.test(block))
      continue;
    const lines = block.split("\n");
    const at = lines.findIndex(line => line.includes("-->"));
    if (at < 0) {
      if (block.trim()) skipped++;
      continue;
    }
    const m = lines[at].trim().match(/^(\S+)\s*-->\s*(\S+)(?:\s+.*)?$/);
    const start = m ? timestamp(m[1]) : NaN;
    const end = m ? timestamp(m[2]) : NaN;
    const text = lines
      .slice(at + 1)
      .join("\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .trim();
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start ||
      !text ||
      start >= duration
    ) {
      skipped++;
      continue;
    }
    if (end > duration) clipped++;
    segments.push({
      id: createUuid(),
      start,
      end: Math.min(end, duration),
      text,
    });
    if (segments.length > 10_000)
      throw new Error(
        "This file contains more than 10,000 captions. Import a shorter section."
      );
  }
  if (!segments.length)
    throw new Error(
      "No usable captions were found within this video's duration. Choose an SRT or WebVTT file with valid timings."
    );
  return {
    segments: segments.sort((a, b) => a.start - b.start || a.end - b.end),
    skipped,
    clipped,
  };
}

function srtTime(seconds: number) {
  const ms = Math.round(Math.max(0, seconds) * 1000);
  return `${String(Math.floor(ms / 3_600_000)).padStart(2, "0")}:${String(Math.floor(ms / 60_000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}
export function exportSrt(
  segments: readonly TranscriptSegment[],
  duration = Infinity
): string {
  return [...segments]
    .filter(
      s =>
        Number.isFinite(s.start) &&
        Number.isFinite(s.end) &&
        s.end > Math.max(0, s.start) &&
        s.start < duration &&
        s.text.trim()
    )
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map(
      (s, index) =>
        `${index + 1}\n${srtTime(s.start)} --> ${srtTime(Math.min(duration, s.end))}\n${s.text.replace(/\r\n?/g, "\n").trim()}\n`
    )
    .join("\n");
}
