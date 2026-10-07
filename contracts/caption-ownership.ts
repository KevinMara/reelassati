import type { EditProject, TimelineClip, TranscriptSegment } from "./workspace";
import {
  clipLaneKind,
  clipLaneNumber,
  isPrimaryFootage,
} from "./timeline-layers";
/** Original ownership snapshot, shared by manual, chat and transition operations. */
export function captionOwner(
  project: Pick<EditProject, "clips">,
  segment: TranscriptSegment
): TimelineClip | undefined {
  const covers = (c: TimelineClip) =>
    segment.start >= c.start && segment.start < c.start + c.duration;
  if (segment.sourceClipId)
    return (
      project.clips.find(c => c.id === segment.sourceClipId && covers(c)) ??
      project.clips.find(
        c => c.id.startsWith(`${segment.sourceClipId}-`) && covers(c)
      )
    );
  return (
    project.clips.find(c => isPrimaryFootage(c) && covers(c)) ??
    (!project.clips.some(c => clipLaneKind(c) === "video")
      ? project.clips.find(
          c =>
            clipLaneKind(c) === "audio" && clipLaneNumber(c) === 1 && covers(c)
        )
      : undefined)
  );
}
