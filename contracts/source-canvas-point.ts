import { visualFrame } from "./clip-visual";
import type { TimelineClip } from "./workspace";

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
