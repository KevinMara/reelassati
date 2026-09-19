/** Exact-time magnetic alignment. Pixel tolerance stays consistent at every zoom. */
export interface SnapClip {
  id: string;
  start: number;
  duration: number;
}

export interface TimelineSnapPoint {
  time: number;
  kind: "boundary" | "playhead" | "clip-start" | "clip-end";
  clipId?: string;
  label: string;
}

export interface TimelineSnapResult {
  /** Start of a moved clip, or the edge being trimmed. */
  time: number;
  point: TimelineSnapPoint | null;
  alignedEdge: "start" | "end" | null;
}

export function buildTimelineSnapPoints(
  clips: readonly SnapClip[],
  duration: number,
  playhead: number,
  excludeIds: ReadonlySet<string> = new Set()
): TimelineSnapPoint[] {
  const points: TimelineSnapPoint[] = [
    { time: 0, kind: "boundary", label: "Timeline start" },
    { time: duration, kind: "boundary", label: "Timeline end" },
    { time: playhead, kind: "playhead", label: "Playhead" },
  ];
  for (const clip of clips) {
    if (excludeIds.has(clip.id) || !(clip.duration > 0)) continue;
    points.push(
      {
        time: clip.start,
        kind: "clip-start",
        clipId: clip.id,
        label: "Clip start",
      },
      {
        time: clip.start + clip.duration,
        kind: "clip-end",
        clipId: clip.id,
        label: "Clip end",
      }
    );
  }
  return points.filter(point => Number.isFinite(point.time) && point.time >= 0);
}

export function snapTimelineTime(options: {
  time: number;
  points: readonly TimelineSnapPoint[];
  pixelsPerSecond: number;
  /** Supply a duration for clip movement, allowing either edge to align. */
  movingDuration?: number;
  thresholdPx?: number;
  enabled?: boolean;
  minimum?: number;
  maximum?: number;
}): TimelineSnapResult {
  const {
    points,
    pixelsPerSecond,
    movingDuration,
    thresholdPx = 8,
    enabled = true,
  } = options;
  const minimum = Number.isFinite(options.minimum)
    ? Math.max(0, options.minimum!)
    : 0;
  const maximum = Number.isFinite(options.maximum)
    ? Math.max(minimum, options.maximum!)
    : Infinity;
  const time = Math.max(
    minimum,
    Math.min(maximum, Number.isFinite(options.time) ? options.time : minimum)
  );
  const unsnapped: TimelineSnapResult = {
    time,
    point: null,
    alignedEdge: null,
  };
  if (
    !enabled ||
    !Number.isFinite(pixelsPerSecond) ||
    pixelsPerSecond <= 0 ||
    !Number.isFinite(thresholdPx) ||
    thresholdPx < 0
  )
    return unsnapped;
  const offsets: { offset: number; edge: "start" | "end" }[] = [
    { offset: 0, edge: "start" },
  ];
  if (
    movingDuration !== undefined &&
    Number.isFinite(movingDuration) &&
    movingDuration > 0
  )
    offsets.push({ offset: movingDuration, edge: "end" });
  const tolerance = thresholdPx / pixelsPerSecond;
  // Stable tie-breaking avoids a flickering guide when several edges coincide.
  const priority = { playhead: 0, boundary: 1, "clip-start": 2, "clip-end": 3 };
  let best: {
    result: TimelineSnapResult;
    distance: number;
    priority: number;
  } | null = null;
  for (const point of points) {
    if (!Number.isFinite(point.time) || point.time < 0) continue;
    for (const { offset, edge } of offsets) {
      const candidate = point.time - offset;
      if (candidate < minimum || candidate > maximum) continue;
      const distance = Math.abs(candidate - time);
      if (distance > tolerance + Number.EPSILON) continue;
      const rank = priority[point.kind];
      if (
        !best ||
        distance < best.distance - 1e-9 ||
        (Math.abs(distance - best.distance) <= 1e-9 &&
          (rank < best.priority ||
            (rank === best.priority && candidate < best.result.time)))
      ) {
        best = {
          result: { time: candidate, point, alignedEdge: edge },
          distance,
          priority: rank,
        };
      }
    }
  }
  return best?.result ?? unsnapped;
}
