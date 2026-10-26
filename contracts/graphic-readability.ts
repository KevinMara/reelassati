import { graphicCardLayout, graphicShapePixels } from "./graphic-layout";
import { graphicFrame, normalizeGraphic } from "./motion-graphics";
import type { EditProject, TimelineClip } from "./workspace";

/** Contrast of two actual opaque colors. It says nothing about unseen footage. */
export function solidColorContrast(a: string, b: string) {
  const luminance = (color: string) => {
    const channels = [1, 3, 5].map(offset => {
      const s = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const left = luminance(a),
    right = luminance(b);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

/** Conservative delivery failures for generated text. Uses the same font/card
 * geometry and frame clock as preview/export. This is not a perceptual review:
 * transparent-text contrast, faces, burned captions and platform UI need pixels. */
export function graphicReadabilityProblems(
  clip: TimelineClip,
  aspectRatio: EditProject["aspectRatio"] = "9:16"
): string[] {
  const g = normalizeGraphic(clip.graphic);
  if (
    !g ||
    !["text", "callout"].includes(g.kind) ||
    clip.hidden ||
    !Number.isFinite(clip.duration) ||
    clip.duration <= 0
  )
    return [];
  const copy = `${g.text} ${g.secondaryText ?? ""}`.trim();
  if (!copy) return [];
  const problems: string[] = [];
  // 3:1 catches severe failures. Planner direction asks for 4.5:1; do not treat
  // this permissive floor as a promise that smaller secondary text is readable.
  if (g.kind === "callout") {
    if (g.text && solidColorContrast(g.color, g.background) < 3)
      problems.push(
        `Graphic text lacks contrast against its card: ${clip.label}`
      );
    if (
      g.secondaryText &&
      solidColorContrast(g.accent ?? g.color, g.background) < 3
    )
      problems.push(
        `Graphic secondary text lacks contrast against its card: ${clip.label}`
      );
  }
  const height =
    aspectRatio === "16:9" ? 56.25 : aspectRatio === "1:1" ? 100 : 1600 / 9;
  const graphicDuration =
    clip.graphicDuration ?? clip.outPoint ?? clip.duration;
  const samples = Math.min(900, Math.max(1, Math.ceil(clip.duration * 30)));
  const step = clip.duration / samples;
  let hold = 0,
    longestHold = 0,
    inFrame = false;
  for (let i = 0; i < samples; i++) {
    const elapsed = clip.inPoint + i * step * (clip.speed ?? 1);
    const frame = graphicFrame(g, elapsed, graphicDuration);
    const layout = graphicCardLayout(
      frame.text,
      g.size,
      g.kind === "callout" ? g.padding : 0,
      g.secondaryText
    );
    const corners = graphicShapePixels(
      [
        [-layout.width / 2, layout.centerY - layout.height / 2],
        [layout.width / 2, layout.centerY - layout.height / 2],
        [layout.width / 2, layout.centerY + layout.height / 2],
        [-layout.width / 2, layout.centerY + layout.height / 2],
      ],
      frame,
      100,
      height
    );
    const fits = corners.every(
      ([x, y]) => x >= -0.01 && x <= 100.01 && y >= -0.01 && y <= height + 0.01
    );
    if (frame.opacity >= 0.75 && fits) {
      inFrame = true;
      hold += step;
      longestHold = Math.max(longestHold, hold);
    } else hold = 0;
  }
  // A deliberately permissive floor, not a recommended reading rate. It catches
  // unreadable flashes after animation/cuts without imposing an edit template.
  const minimumHold = Math.max(
    0.25,
    Array.from(copy.replace(/\s/gu, "")).length / 50
  );
  if (!inFrame)
    problems.push(
      `Graphic text never fits fully inside the frame: ${clip.label}`
    );
  else if (longestHold + 1 / 30 < minimumHold)
    problems.push(
      `Graphic text has too little visible reading time: ${clip.label}`
    );
  return problems;
}
