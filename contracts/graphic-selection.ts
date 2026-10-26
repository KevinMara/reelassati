import {
  graphicCardLayout,
  graphicShapePixels,
  graphicShapes,
  type GraphicPoint,
} from "./graphic-layout";
import { graphicFrame, normalizeGraphic } from "./motion-graphics";
import { isSpatialGraphic, spatialGraphicFrame } from "./spatial-graphics";
import type { TimelineClip } from "./workspace";

/** Selection follows the same text layout, shapes and source clock as preview.
 * Coordinates are canvas pixels; media clips deliberately have no frame outline. */
export function graphicSelectionBounds(
  clip: TimelineClip,
  time: number,
  width: number,
  height: number
) {
  const g = normalizeGraphic(clip.graphic);
  if (
    !g ||
    clip.hidden ||
    time < clip.start ||
    time >= clip.start + clip.duration
  )
    return undefined;
  const elapsed = clip.inPoint + (time - clip.start) * (clip.speed ?? 1);
  const duration = clip.graphicDuration ?? clip.outPoint ?? clip.duration;
  let points: GraphicPoint[];
  if (isSpatialGraphic(g)) {
    const spatial = spatialGraphicFrame(g, elapsed, duration);
    points = spatial.faces.flatMap(face =>
      face.contours.flatMap(contour =>
        contour.map(([x, y]): GraphicPoint => [
          (spatial.x * width) / 100 + (x * width) / 6,
          (spatial.y * height) / 100 + (y * width) / 6,
        ])
      )
    );
  } else {
    const frame = graphicFrame(g, elapsed, duration);
    const local = graphicShapes(g, elapsed, duration).flatMap(
      shape => shape.points
    );
    const box = (left: number, top: number, w: number, h: number) => {
      local.push(
        [left, top],
        [left + w, top],
        [left + w, top + h],
        [left, top + h]
      );
    };
    const primary = ![
      "rectangle",
      "ellipse",
      "star",
      "line",
      "arrow",
      "highlight",
    ].includes(g.kind);
    if (primary) {
      const layout = graphicCardLayout(
        frame.text,
        g.size,
        g.kind === "callout" ? g.padding : 0,
        g.secondaryText
      );
      box(
        -layout.width / 2,
        layout.centerY - layout.height / 2,
        layout.width,
        layout.height
      );
    } else if (g.secondaryText) {
      const layout = graphicCardLayout(
        frame.text,
        g.size,
        g.padding,
        g.secondaryText
      );
      const secondary = graphicCardLayout(g.secondaryText, g.size * 0.6, 0);
      box(
        -secondary.width / 2,
        layout.secondaryY - g.size * 0.36,
        secondary.width,
        layout.secondaryHeight
      );
    }
    if (g.kind === "arrow") box(-12.5, -6, 25, 12);
    if (g.kind === "highlight")
      box(-20, (-7.5 * height) / width, 40, (15 * height) / width);
    points = graphicShapePixels(local, frame, width, height);
  }
  if (!points.length) return undefined;
  const left = Math.min(...points.map(([x]) => x));
  const top = Math.min(...points.map(([, y]) => y));
  return {
    x: left,
    y: top,
    width: Math.max(...points.map(([x]) => x)) - left,
    height: Math.max(...points.map(([, y]) => y)) - top,
  };
}
