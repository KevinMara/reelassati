import { visualFrame } from "@contracts/clip-visual";
import { graphicFrame, normalizeGraphic } from "@contracts/motion-graphics";
import { type TrackedPoint } from "@contracts/region-tracking";
import type { EditProject, TimelineClip } from "@contracts/workspace";
import { preserveGraphicDuration } from "./timeline-lanes";

/** Match CSS object-fit and the shared visual pose in physical canvas coordinates. */
export function sourcePointToCanvas(
  source: TimelineClip,
  time: number,
  point: { x: number; y: number },
  sourceSize: { width: number; height: number },
  canvas: { width: number; height: number }
) {
  const fit = source.fit === "cover" ? Math.max : Math.min;
  const ratio = fit(
    canvas.width / sourceSize.width,
    canvas.height / sourceSize.height
  );
  const frame = visualFrame(source, time);
  const dx =
    (point.x - 0.5) *
    sourceSize.width *
    ratio *
    frame.scale *
    (frame.visual.flipX ? -1 : 1);
  const dy =
    (point.y - 0.5) *
    sourceSize.height *
    ratio *
    frame.scale *
    (frame.visual.flipY ? -1 : 1);
  const angle = (frame.rotation * Math.PI) / 180;
  return {
    x:
      50 +
      frame.x +
      ((dx * Math.cos(angle) - dy * Math.sin(angle)) / canvas.width) * 100,
    y:
      50 +
      frame.y +
      ((dx * Math.sin(angle) + dy * Math.cos(angle)) / canvas.height) * 100,
  };
}

/** Retain counter/animation source clocks and end at the last observed frame. */
export function trackedGraphicClip(
  graphicClip: TimelineClip,
  source: TimelineClip,
  observations: readonly TrackedPoint[],
  sourceSize: { width: number; height: number },
  aspectRatio: EditProject["aspectRatio"]
): TimelineClip {
  const clip = preserveGraphicDuration(graphicClip),
    g = clip.graphic;
  if (!g || g.kind.startsWith("spatial-"))
    throw new Error("Choose a 2D graphic to attach to this region.");
  const [width, height] = aspectRatio.split(":").map(Number);
  const speed = source.speed ?? 1;
  const points = observations
    .map(p => ({
      ...p,
      time: source.start + (p.time - source.inPoint) / speed,
    }))
    .filter(
      p =>
        p.time >= clip.start &&
        p.time <= clip.start + clip.duration &&
        p.time >= source.start &&
        p.time <= source.start + source.duration
    );
  if (points.length < 2)
    throw new Error(
      "The decoded path does not cover enough of this graphic. Use a longer overlapping interval."
    );
  const first = points[0],
    last = points.at(-1)!;
  const clockDuration = clip.graphicDuration ?? clip.outPoint;
  const elapsed = (time: number) =>
    clip.inPoint + (time - clip.start) * (clip.speed ?? 1);
  const seedPose = graphicFrame(
    { ...g, animation: "none" },
    elapsed(first.time),
    clockDuration
  );
  const seed = sourcePointToCanvas(source, first.time, first, sourceSize, {
    width,
    height,
  });
  const offset = { x: seedPose.x - seed.x, y: seedPose.y - seed.y };
  const canvasPoints = points.map(p => ({
    ...p,
    ...sourcePointToCanvas(source, p.time, p, sourceSize, { width, height }),
  }));
  const anchorTimes = (g.motion ?? [])
    .map(
      k =>
        clip.start +
        (k.at * Math.max(1 / 30, clockDuration - 1 / 30) - clip.inPoint) /
          (clip.speed ?? 1)
    )
    .filter(t => t > first.time && t < last.time);
  const times = [
    ...new Set([...canvasPoints.map(p => p.time), ...anchorTimes]),
  ].sort((a, b) => a - b);
  const candidates = times.map(time => {
    const right = canvasPoints.findIndex(p => p.time >= time),
      b = canvasPoints[Math.max(0, right)],
      a = canvasPoints[Math.max(0, right - 1)];
    const ratio = b.time === a.time ? 0 : (time - a.time) / (b.time - a.time);
    const pose = graphicFrame(
      { ...g, animation: "none" },
      elapsed(time),
      clockDuration,
      false
    );
    return {
      time,
      x: a.x + (b.x - a.x) * ratio + offset.x,
      y: a.y + (b.y - a.y) * ratio + offset.y,
      scale: pose.scale,
      rotation: pose.rotation,
      opacity: pose.opacity,
    };
  });
  // Simplify the complete pose, preserving animation as well as attachment position.
  const retained = new Set([0, candidates.length - 1]),
    stack = [[0, candidates.length - 1]];
  while (stack.length) {
    const [left, right] = stack.pop()!,
      a = candidates[left],
      b = candidates[right];
    let largest = 1,
      index = -1;
    for (let i = left + 1; i < right; i++) {
      const p = candidates[i],
        t = (p.time - a.time) / (b.time - a.time);
      const delta = (key: "x" | "y" | "scale" | "rotation" | "opacity") =>
        p[key] - (a[key] + (b[key] - a[key]) * t);
      const error = Math.max(
        Math.hypot(delta("x"), delta("y")) / 0.15,
        Math.abs(delta("scale")) / 0.005,
        Math.abs(delta("rotation")) / 0.5,
        Math.abs(delta("opacity")) / 0.005
      );
      if (error > largest) {
        largest = error;
        index = i;
      }
    }
    if (index >= 0) {
      retained.add(index);
      stack.push([left, index], [index, right]);
    }
  }
  const simplified = [...retained]
    .sort((a, b) => a - b)
    .map(i => candidates[i]);
  if (simplified.length > 120)
    throw new Error(
      "This path needs more than 120 keyframes at the tracking accuracy limit. Track a shorter interval."
    );
  const motion = simplified.map(p => {
    const pose = p;
    const x = p.x,
      y = p.y;
    if (x < 0 || x > 100 || y < 0 || y > 100)
      throw new Error(
        "The attached graphic leaves the canvas. Move the graphic closer to the region or track a shorter interval."
      );
    return {
      at: Math.max(
        0,
        Math.min(1, elapsed(p.time) / Math.max(1 / 30, clockDuration - 1 / 30))
      ),
      x,
      y,
      scale: pose.scale,
      rotation: pose.rotation,
      opacity: pose.opacity,
      easing: "linear" as const,
    };
  });
  return {
    ...clip,
    start: first.time,
    duration: last.time - first.time,
    inPoint: elapsed(first.time),
    outPoint: elapsed(last.time),
    graphic: normalizeGraphic({ ...g, animation: "none", motion })!,
  };
}
