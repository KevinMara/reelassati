import type { EditProject, TranscriptWord } from "./workspace";
import { effectiveTimelineClips, timelineTrackGain } from "./timeline-mixer";

export interface EditorialSpeechEvidence {
  clipId: string;
  assetId: string;
  /** Current timeline seconds, including this occurrence's trim and speed. */
  start: number;
  end: number;
  sourceStart: number;
  sourceEnd: number;
  text: string;
  partial: boolean;
  words: TranscriptWord[];
}

/** Measured speech is still useful when captions are burned in or disabled.
 * Projecting it once avoids asking the planner to infer a second timeline clock.
 * Gaps in ASR are not returned as silence. No observations or words are invented. */
export function buildEditorialSpeechEvidence(project: EditProject) {
  const evidence: EditorialSpeechEvidence[] = [];
  if (!Number.isFinite(project.duration) || project.duration <= 0)
    return evidence;
  for (const clip of effectiveTimelineClips(project)) {
    if (
      !clip.assetId ||
      clip.graphic ||
      clip.transitionHandle ||
      clip.muted ||
      clip.volume === 0 ||
      timelineTrackGain(project, clip) === 0
    )
      continue;
    const speed = clip.speed ?? 1;
    if (
      ![clip.start, clip.duration, clip.inPoint, clip.outPoint, speed].every(
        Number.isFinite
      ) ||
      clip.duration <= 0 ||
      speed <= 0
    )
      continue;
    const sourceEnd = Math.min(
      clip.outPoint,
      clip.inPoint + clip.duration * speed
    );
    const mapTime = (time: number) =>
      clip.start + (time - clip.inPoint) / speed;
    for (const segment of project.sourceSpeech?.find(
      s => s.assetId === clip.assetId
    )?.segments ?? []) {
      if (
        ![segment.start, segment.end].every(Number.isFinite) ||
        segment.end <= segment.start ||
        !segment.text.trim()
      )
        continue;
      const start = Math.max(0, mapTime(Math.max(clip.inPoint, segment.start)));
      const end = Math.min(
        project.duration,
        mapTime(Math.min(sourceEnd, segment.end))
      );
      if (start >= end) continue;
      const sourceStart = clip.inPoint + (start - clip.start) * speed;
      const sourceOut = clip.inPoint + (end - clip.start) * speed;
      const words = (segment.words ?? [])
        .filter(
          word =>
            Number.isFinite(word.start) &&
            Number.isFinite(word.end) &&
            word.end > word.start &&
            word.start >= sourceStart - 0.000001 &&
            word.end <= sourceOut + 0.000001
        )
        .map(word => ({
          text: word.text,
          start: Math.max(start, mapTime(word.start)),
          end: Math.min(end, mapTime(word.end)),
        }));
      evidence.push({
        clipId: clip.id,
        assetId: clip.assetId,
        start,
        end,
        sourceStart,
        sourceEnd: sourceOut,
        text: segment.text,
        partial:
          sourceStart > segment.start + 0.000001 ||
          sourceOut < segment.end - 0.000001,
        words,
      });
    }
  }
  return evidence.sort(
    (a, b) =>
      a.start - b.start || a.end - b.end || a.clipId.localeCompare(b.clipId)
  );
}
