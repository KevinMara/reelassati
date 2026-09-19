import { graphicFrame, type MotionGraphic } from "./motion-graphics";
import fontData from "./spatial-font.json";

type Point3 = [number, number, number];
export type SpatialPoint = [number, number];
export interface SpatialFace {
  contours: SpatialPoint[][];
  color: string;
}
type Glyph = { advance: number; contours: number[][][] };
const font = fontData as Record<string, Glyph>;
const radians = (angle: number) => (angle * Math.PI) / 180;
export const isSpatialGraphic = (g: MotionGraphic) =>
  g.kind.startsWith("spatial-");
/** Titles intentionally stay short. Unsupported scripts use the editable 2D text tool. */
export function spatialTitleText(text: string) {
  return [...text.trim().replace(/\s+/g, " ").slice(0, 28)]
    .map(c => (font[c] ? c : "?"))
    .join("");
}
function tint(color: string, light: number) {
  const channels = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  return (
    "#" +
    channels
      .map(v =>
        Math.round(
          Math.max(
            0,
            Math.min(255, light <= 1 ? v * light : v + (255 - v) * (light - 1))
          )
        )
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}
const rotate = ([x, y, z]: Point3, pitch: number, yaw: number): Point3 => {
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  const xx = x * cy + z * sy,
    zz = z * cy - x * sy;
  return [xx, y * cp - zz * sp, y * sp + zz * cp];
};
/** Camera at negative Z. Rotation, perspective, face shading and depth sorting are
 * calculated once here for both SVG preview and the exported libass polygons. */
export function spatialGraphicFrame(
  g: MotionGraphic,
  elapsed: number,
  duration: number
) {
  const f = graphicFrame(g, elapsed, duration);
  const s = g.spatial ?? {
    pitch: -18,
    yaw: -25,
    depth: 0.2,
    turns: 0,
    perspective: 5,
  };
  const t = Math.floor(Math.max(0, elapsed) * 30) / 30;
  const progress = Math.min(1, t / Math.max(1 / 30, duration - 1 / 30));
  // A title rocks within a readable cone. Objects can rotate continuously.
  const yaw =
    radians(s.yaw) +
    (g.kind === "spatial-title"
      ? Math.sin(progress * Math.PI * 2 * s.turns) * 0.35
      : progress * Math.PI * 2 * s.turns);
  const pitch = radians(s.pitch);
  const roll = radians(f.rotation),
    cr = Math.cos(roll),
    sr = Math.sin(roll);
  const factor = (g.size / 7) * f.scale;
  const transform = (p: Point3) => rotate(p, pitch, yaw);
  const project = (p: Point3): SpatialPoint => {
    const perspective = s.perspective / (s.perspective + p[2]);
    const x = p[0] * perspective * factor,
      y = p[1] * perspective * factor;
    return [x * cr - y * sr, x * sr + y * cr];
  };
  const meshes: { contours: Point3[][]; color: string; depth: number }[] = [];
  const polygon = (points: Point3[], color: string, cull = false) => {
    const transformed = points.map(transform);
    const a = transformed[0],
      b = transformed[1],
      c = transformed[2];
    const ab = b.map((v, i) => v - a[i]),
      ac = c.map((v, i) => v - a[i]);
    const normal = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const length = Math.hypot(...normal) || 1;
    const center = transformed
      .reduce((sum, p) => sum.map((v, i) => v + p[i]) as Point3, [
        0, 0, 0,
      ] as Point3)
      .map(v => v / transformed.length);
    const facing =
      normal[0] * -center[0] +
      normal[1] * -center[1] +
      normal[2] * (-s.perspective - center[2]);
    if (cull && facing <= 0) return;
    const light =
      0.45 +
      Math.max(
        0,
        (-normal[0] * 0.3 - normal[1] * 0.6 - normal[2] * 0.74) / length
      ) *
        0.8;
    meshes.push({
      contours: [transformed],
      color: tint(color, light),
      depth: center[2],
    });
  };
  if (g.kind === "spatial-cube") {
    const d = 0.45 + s.depth;
    const vertices: Point3[] = [
      [-0.8, -0.8, -d],
      [0.8, -0.8, -d],
      [0.8, 0.8, -d],
      [-0.8, 0.8, -d],
      [-0.8, -0.8, d],
      [0.8, -0.8, d],
      [0.8, 0.8, d],
      [-0.8, 0.8, d],
    ];
    for (const face of [
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [3, 7, 6, 2],
      [0, 4, 7, 3],
      [1, 2, 6, 5],
    ])
      polygon(
        face.map(i => vertices[i]),
        g.background,
        true
      );
    // Small inset highlight on the front face, attached to the same 3D plane.
    polygon(
      [
        [-0.63, -0.61, -d - 0.002],
        [-0.63, -0.54, -d - 0.002],
        [0.4, -0.54, -d - 0.002],
        [0.4, -0.61, -d - 0.002],
      ],
      g.color,
      true
    );
  } else if (g.kind === "spatial-orbit") {
    const radius = 1,
      tube = 0.03 + s.depth * 0.13;
    const around = 48,
      cross = 6;
    const point = (a: number, b: number): Point3 => [
      Math.cos(a) * (radius + tube * Math.cos(b)),
      Math.sin(a) * (radius + tube * Math.cos(b)),
      tube * Math.sin(b),
    ];
    for (let i = 0; i < around; i++)
      for (let j = 0; j < cross; j++) {
        const a = (i * Math.PI * 2) / around,
          aa = ((i + 1) * Math.PI * 2) / around,
          b = (j * Math.PI * 2) / cross,
          bb = ((j + 1) * Math.PI * 2) / cross;
        polygon(
          [point(a, b), point(aa, b), point(aa, bb), point(a, bb)],
          g.background,
          true
        );
      }
    // A satellite follows a real inclined orbit, changing apparent size with depth.
    const angle = progress * Math.PI * 2;
    const center: Point3 = [
      Math.cos(angle) * 1.18,
      Math.sin(angle) * 0.8,
      Math.sin(angle) * 0.75,
    ];
    const r = 0.11,
      pts: Point3[] = [
        [r, 0, 0],
        [-r, 0, 0],
        [0, r, 0],
        [0, -r, 0],
        [0, 0, r],
        [0, 0, -r],
      ].map(p => p.map((v, i) => v + center[i]) as Point3);
    for (const face of [
      [0, 2, 4],
      [2, 1, 4],
      [1, 3, 4],
      [3, 0, 4],
      [2, 0, 5],
      [1, 2, 5],
      [3, 1, 5],
      [0, 3, 5],
    ])
      polygon(
        face.map(i => pts[i]),
        g.color,
        true
      );
  } else if (g.kind === "spatial-title") {
    const title = spatialTitleText(g.text) || "YOUR TITLE";
    const letters = [...title].map(c => font[c] ?? font["?"]);
    const total = letters.reduce((sum, glyph) => sum + glyph.advance, 0);
    const fit = Math.min(1.8, 3.4 / Math.max(1, total));
    let cursor = -total / 2;
    const front: Point3[][] = [],
      back: Point3[][] = [];
    for (const glyph of letters) {
      for (const contour of glyph.contours) {
        if (contour.length < 3) continue;
        const near = contour.map(
          ([x, y]) =>
            [(x + cursor) * fit, (y + 0.36) * fit, -s.depth / 2] as Point3
        );
        const far = near.map(([x, y]) => [x, y, s.depth / 2] as Point3);
        front.push(near.map(transform));
        back.push(far.map(transform));
        for (let i = 0; i < near.length; i++) {
          const next = (i + 1) % near.length;
          polygon([near[i], far[i], far[next], near[next]], g.background);
        }
      }
      cursor += glyph.advance;
    }
    // Each face keeps the font's contour winding so counters (O, B, etc.) stay open.
    const depths = (paths: Point3[][]) =>
      paths.flat().reduce((sum, p) => sum + p[2], 0) /
      Math.max(1, paths.flat().length);
    meshes.push({
      contours: back,
      color: tint(g.background, 0.5),
      depth: depths(back),
    });
    // The title is deliberately bounded to +-70 degrees; the front stays visible.
    meshes.sort((a, b) => b.depth - a.depth);
    meshes.push({ contours: front, color: g.color, depth: -100 });
  }
  if (g.kind !== "spatial-title") meshes.sort((a, b) => b.depth - a.depth);
  return {
    x: f.x,
    y: f.y,
    opacity: f.opacity,
    faces: meshes.map(({ contours, color }): SpatialFace => ({
      contours: contours.map(points => points.map(project)),
      color,
    })),
  };
}
export function spatialSvgPath(contours: SpatialPoint[][]) {
  return contours
    .map(
      points =>
        points
          .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(5)} ${y.toFixed(5)}`)
          .join(" ") + " Z"
    )
    .join(" ");
}
