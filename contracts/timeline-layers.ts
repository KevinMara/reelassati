import type { TimelineClip } from "./workspace";
export type TimelineLaneKind =
  "video" | "audio" | "text" | "graphics" | "captions";
export function clipLaneKind(clip: TimelineClip): TimelineLaneKind {
  if (clip.track === "audio") return "audio";
  if (clip.track === "captions") return "captions";
  if (clip.graphic)
    return clip.graphic.kind === "text" || clip.graphic.kind === "callout"
      ? "text"
      : "graphics";
  return "video";
}
export function clipLaneNumber(clip: TimelineClip): number {
  return Number.isInteger(clip.lane) && clip.lane! > 0
    ? clip.lane!
    : clip.track === "overlay" && !clip.graphic
      ? 2
      : 1;
}
export function isPrimaryFootage(clip: TimelineClip) {
  return (
    !clip.transitionHandle &&
    clipLaneKind(clip) === "video" &&
    (clipLaneNumber(clip) === 1 || clip.primaryFootage === true)
  );
}
