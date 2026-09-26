import type { Asset, TimelineClip } from "@contracts/workspace";

export type TimelineLaneKind =
  "video" | "audio" | "text" | "graphics" | "captions";
export type TimelineLane = { kind: TimelineLaneKind; number: number };
export const LIBRARY_ASSET_DRAG_TYPE = "application/x-reelassati-asset-id";
export const TIMELINE_CLIP_DRAG_TYPE = "application/x-reelassati-clip";

export function clipLaneKind(clip: TimelineClip): TimelineLaneKind {
  if (clip.track === "audio") return "audio";
  if (clip.track === "captions") return "captions";
  if (clip.graphic)
    return clip.graphic.kind === "text" || clip.graphic.kind === "callout"
      ? "text"
      : "graphics";
  return "video";
}

/** Legacy overlay media remains above the first video lane; existing projects need no migration. */
export function clipLaneNumber(clip: TimelineClip): number {
  return Number.isInteger(clip.lane) && clip.lane! > 0
    ? clip.lane!
    : clip.track === "overlay" && !clip.graphic
      ? 2
      : 1;
}

export function laneForClip(clip: TimelineClip): TimelineLane {
  return { kind: clipLaneKind(clip), number: clipLaneNumber(clip) };
}

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

export function timelineLanes(clips: TimelineClip[]): TimelineLane[] {
  const kinds: TimelineLaneKind[] = [
    "video",
    "graphics",
    "text",
    "captions",
    "audio",
  ];
  return kinds.flatMap(kind => {
    const present = clips.filter(c => clipLaneKind(c) === kind);
    if (
      !present.length &&
      kind !== "video" &&
      kind !== "audio" &&
      kind !== "captions"
    )
      return [];
    const maximum = Math.max(1, ...present.map(clipLaneNumber));
    // One empty destination above media lanes makes stacking discoverable without a track manager.
    const count =
      maximum +
      (present.length && (kind === "video" || kind === "audio") ? 1 : 0);
    return Array.from({ length: count }, (_, index) => ({
      kind,
      number: count - index,
    }));
  });
}

export function compareTimelineLayers(
  a: TimelineClip,
  b: TimelineClip
): number {
  const order: Record<TimelineLaneKind, number> = {
    video: 0,
    audio: 0,
    graphics: 1,
    text: 2,
    captions: 3,
  };
  return (
    order[clipLaneKind(a)] - order[clipLaneKind(b)] ||
    clipLaneNumber(a) - clipLaneNumber(b)
  );
}

export function timelineClipColor(clip: TimelineClip, assets: Asset[]): string {
  const kind = clipLaneKind(clip);
  if (kind === "text") return "#B7791F";
  if (kind === "graphics") return "#C05685";
  if (kind === "captions") return "#218769";
  if (kind === "audio") return "#157D98";
  return assets.find(a => a.id === clip.assetId)?.kind === "image"
    ? "#A35A35"
    : "#6553BE";
}

export function timeAtTimelinePointer(
  clientX: number,
  left: number,
  width: number,
  duration: number
): number {
  return Math.max(
    0,
    Math.min(duration, ((clientX - left) / Math.max(width, 1)) * duration)
  );
}

export function trimTimelineClip(
  clip: TimelineClip,
  side: "start" | "end",
  time: number,
  sourceLimit = clip.outPoint
): TimelineClip {
  if (clip.locked) return clip;
  clip = preserveGraphicDuration(clip);
  const speed = clip.speed ?? 1;
  const minimum = Math.min(0.001, clip.duration);
  if (side === "start") {
    const start = Math.max(
      clip.start - clip.inPoint / speed,
      Math.min(time, clip.start + clip.duration - minimum)
    );
    const delta = start - clip.start;
    return {
      ...clip,
      start,
      duration: clip.duration - delta,
      inPoint: clip.inPoint + delta * speed,
    };
  }
  // Outward extension is limited to the known source out-point, avoiding invented media duration.
  const end = Math.max(
    clip.start + minimum,
    Math.min(time, clip.start + (sourceLimit - clip.inPoint) / speed)
  );
  return {
    ...clip,
    duration: end - clip.start,
    outPoint: clip.inPoint + (end - clip.start) * speed,
  };
}

/** Preserve the source animation clock when a clip is shortened or split. */
export function preserveGraphicDuration(clip: TimelineClip): TimelineClip {
  return clip.graphic && clip.graphicDuration === undefined
    ? { ...clip, graphicDuration: clip.outPoint ?? clip.duration }
    : clip;
}

/** Actual audio/video source bounds; still images and generated graphics can hold longer. */
export function clipTimingLimits(
  clip: TimelineClip,
  asset?: Asset,
  projectDuration = 1
) {
  const speed = Math.max(0.25, Math.min(4, clip.speed ?? 1));
  const sourceLimit =
    clip.graphic || asset?.kind === "image"
      ? Math.max(
          clip.outPoint,
          clip.inPoint + clip.duration * speed,
          projectDuration * speed
        )
      : asset?.duration && Number.isFinite(asset.duration) && asset.duration > 0
        ? asset.duration
        : clip.outPoint;
  const minimumSourceSpan = Math.min(0.001, sourceLimit);
  const inPoint = Math.max(
    0,
    Math.min(clip.inPoint, sourceLimit - minimumSourceSpan)
  );
  const outPoint = Math.max(
    inPoint + minimumSourceSpan,
    Math.min(clip.outPoint, sourceLimit)
  );
  return {
    speed,
    sourceLimit,
    minimumSourceSpan,
    inPoint,
    outPoint,
    minimumDuration: minimumSourceSpan / speed,
    maximumDuration: (outPoint - inPoint) / speed,
  };
}

export function normalizeClipTiming(
  clip: TimelineClip,
  asset?: Asset,
  projectDuration = 1
): TimelineClip {
  if (
    ![
      clip.start,
      clip.duration,
      clip.inPoint,
      clip.outPoint,
      clip.speed ?? 1,
    ].every(Number.isFinite)
  )
    throw new Error("Clip timing must contain finite values.");
  const bounds = clipTimingLimits(clip, asset, projectDuration);
  if (!Number.isFinite(bounds.sourceLimit) || bounds.sourceLimit <= 0)
    throw new Error(
      "The source duration is unavailable. Reload the media before trimming."
    );
  const duration = Math.max(
    bounds.minimumDuration,
    Math.min(clip.duration, bounds.maximumDuration)
  );
  return {
    ...clip,
    start: Math.max(0, clip.start),
    inPoint: bounds.inPoint,
    duration,
    outPoint: Math.min(
      bounds.sourceLimit,
      bounds.inPoint + duration * bounds.speed
    ),
    speed: bounds.speed,
    ...(clip.fadeIn !== undefined
      ? { fadeIn: Math.min(duration, Math.max(0, clip.fadeIn)) }
      : {}),
    ...(clip.fadeOut !== undefined
      ? { fadeOut: Math.min(duration, Math.max(0, clip.fadeOut)) }
      : {}),
  };
}
