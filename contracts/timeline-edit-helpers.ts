import type { TimelineClip } from "./workspace";
import {
  clipLaneKind,
  clipLaneNumber,
  type TimelineLaneKind,
} from "./timeline-layers";

export function allocateTimelineLane(
  clips: TimelineClip[],
  kind: TimelineLaneKind,
  start: number,
  duration: number,
  preferred = 1,
  excludeId?: string
): number {
  let lane = Math.max(1, Math.floor(preferred));
  while (
    clips.some(
      c =>
        c.id !== excludeId &&
        clipLaneKind(c) === kind &&
        clipLaneNumber(c) === lane &&
        c.start < start + duration - 0.001 &&
        c.start + c.duration > start + 0.001
    )
  )
    lane += 1;
  return lane;
}

/** Preserve the source animation clock when a clip is shortened or split. */
export function preserveGraphicDuration(clip: TimelineClip): TimelineClip {
  if (clip.visual && clip.visualDuration === undefined)
    clip = {
      ...clip,
      visualStart: clip.inPoint,
      visualDuration: clip.outPoint - clip.inPoint,
    };
  return clip.graphic && clip.graphicDuration === undefined
    ? { ...clip, graphicDuration: clip.outPoint ?? clip.duration }
    : clip;
}
