import { mapTranscriptTime } from "./transcript-timing";
import { captionOwner } from "./caption-ownership";
import type { EditProject, TimelineClip, TranscriptSegment } from "./workspace";
export { captionOwner } from "./caption-ownership";

/** Project cue and measured word clocks onto split source spans, using the original
 * ownership snapshot. This also handles a gap closure or local style segmentation. */
export function projectSplitCaptions(
  project: EditProject,
  splits: Array<{ original: TimelineClip; pieces: TimelineClip[] }>
): TranscriptSegment[] {
  const byId = new Map(splits.map(split => [split.original.id, split]));
  return project.transcript.flatMap(segment => {
    const owner = captionOwner(project, segment);
    const split = owner && byId.get(owner.id);
    if (!split) return [segment];
    let retained = 0;
    return split.pieces.flatMap(piece => {
      const mapped = mapTranscriptTime(
        segment,
        time =>
          piece.start +
          (split.original.inPoint +
            (time - split.original.start) * (split.original.speed ?? 1) -
            piece.inPoint) /
            (piece.speed ?? 1),
        { start: piece.start, end: piece.start + piece.duration }
      );
      if (mapped.end <= mapped.start || !mapped.text.trim()) return [];
      return [
        {
          ...mapped,
          id: retained++ === 0 ? segment.id : `${segment.id}-piece-${piece.id}`,
          sourceClipId: piece.id,
        },
      ];
    });
  });
}
