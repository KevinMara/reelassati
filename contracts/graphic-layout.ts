import {
  captionLines,
  captionLineWidth,
  getCaptionPreset,
} from "./editor-presets";
import { graphicFrame, type MotionGraphic } from "./motion-graphics";
/** The bundled font metrics decide graphic line breaks for both CSS and ASS. */
export function graphicTextLines(text: string, size: number) {
  return captionLines(text, {
    ...getCaptionPreset("classic"),
    size,
    maxCharacters: 1000,
  });
}

export type GraphicPoint = [number, number];
export function graphicCardLayout(
  text: string,
  size: number,
  padding = 1.5,
  secondaryText = ""
) {
  const lines = graphicTextLines(text, size).split("\n");
  const secondaryLines = secondaryText
    ? graphicTextLines(secondaryText, size * 0.6).split("\n")
    : [];
  const width =
    Math.max(
      size,
      ...lines.map(
        line => captionLineWidth(line, { ...getCaptionPreset(), size }) * 1.08
      ),
      ...secondaryLines.map(
        line =>
          captionLineWidth(line, { ...getCaptionPreset(), size: size * 0.6 }) *
          1.08
      )
    ) +
    padding * 2;
  const secondaryHeight = secondaryLines.length * size * 0.72;
  const secondaryY = lines.length * size * 0.6 + size * 0.36;
  return {
    width,
    height: lines.length * size * 1.2 + padding * 2 + secondaryHeight,
    secondaryLines,
    secondaryHeight,
    secondaryY,
    centerY: secondaryHeight / 2,
  };
}

/** Geometry uses percentages of canvas WIDTH on both axes. The same points feed
 * SVG preview and ASS export; rotations and scale are applied once. */
export function graphicShapes(
  g: MotionGraphic,
  elapsed: number,
  duration: number
) {
  const f = graphicFrame(g, elapsed, duration);
  const shapes: Array<{ points: GraphicPoint[]; color: string }> = [];
  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    radius = 0
  ) => {
    const r = Math.min(radius, w / 2, h / 2);
    const points: GraphicPoint[] = [];
    for (const [cx, cy, start] of [
      [x + w / 2 - r, y + h / 2 - r, 0],
      [x - w / 2 + r, y + h / 2 - r, 90],
      [x - w / 2 + r, y - h / 2 + r, 180],
      [x + w / 2 - r, y - h / 2 + r, 270],
    ])
      for (let i = 0; i <= 4; i++) {
        const a = ((start + i * 22.5) * Math.PI) / 180;
        points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    shapes.push({ points, color });
  };
  const w = g.width ?? 30,
    h = g.height ?? 12,
    border = g.strokeWidth ?? 0;
  if (g.kind === "callout") {
    const card = graphicCardLayout(f.text, g.size, g.padding, g.secondaryText);
    rect(
      0,
      card.centerY,
      card.width,
      card.height,
      g.background,
      g.cornerRadius ?? 0
    );
    if (g.composition === "lower-third")
      rect(
        -card.width / 2 + 0.35,
        card.centerY,
        0.7,
        card.height,
        g.accent ?? g.color
      );
    if (g.composition === "chapter")
      rect(
        0,
        card.centerY - card.height / 2,
        card.width,
        0.6,
        g.accent ?? g.color
      );
  }
  if (g.kind === "rectangle") {
    if (!border) rect(0, 0, w, h, g.color, g.cornerRadius ?? 0);
    else {
      rect(0, -h / 2 + border / 2, w, border, g.color);
      rect(0, h / 2 - border / 2, w, border, g.color);
      rect(-w / 2 + border / 2, 0, border, h, g.color);
      rect(w / 2 - border / 2, 0, border, h, g.color);
    }
  }
  if (g.kind === "line") rect(0, 0, w, Math.max(0.2, border || 0.4), g.color);
  if (g.kind === "ellipse" || g.kind === "star") {
    const count = g.kind === "star" ? 10 : 64;
    const points: GraphicPoint[] = Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 - Math.PI / 2;
      const r = g.kind === "star" && i % 2 ? 0.45 : 1;
      return [((Math.cos(a) * w) / 2) * r, ((Math.sin(a) * h) / 2) * r];
    });
    shapes.push({ points, color: g.color });
  }
  if (g.composition === "quote")
    rect(-35, 0, 0.6, g.size * 3, g.accent ?? g.color);
  if (g.composition === "progress") {
    const p = Math.max(0, Math.min(1, elapsed / Math.max(1 / 30, duration)));
    rect(0, g.size * 1.4, w, 0.8, g.background);
    if (p > 0)
      rect(-w / 2 + (w * p) / 2, g.size * 1.4, w * p, 0.8, g.accent ?? g.color);
  }
  return shapes;
}

export function graphicShapePixels(
  points: GraphicPoint[],
  frame: ReturnType<typeof graphicFrame>,
  width: number,
  height: number
): GraphicPoint[] {
  const a = (frame.rotation * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  return points.map(([x, y]) => [
    (frame.x * width) / 100 + ((x * c - y * s) * frame.scale * width) / 100,
    (frame.y * height) / 100 + ((x * s + y * c) * frame.scale * width) / 100,
  ]);
}
