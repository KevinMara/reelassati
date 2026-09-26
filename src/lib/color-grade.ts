import type { TimelineClip } from "@contracts/workspace";

/** A single sRGB transform for the browser and exported frames. */
export function colorGradeMatrix(
  clip: Pick<TimelineClip, "brightness" | "contrast" | "saturation">
): number[] {
  const bound = (
    n: number | undefined,
    fallback: number,
    min: number,
    max: number
  ) => (Number.isFinite(n) ? Math.max(min, Math.min(max, n!)) : fallback);
  const contrast = bound(clip.contrast, 1, 0.5, 2);
  const saturation = bound(clip.saturation, 1, 0, 3);
  const offset = bound(clip.brightness, 0, -0.5, 0.5) + (1 - contrast) / 2;
  const weights = [0.2126, 0.7152, 0.0722];
  return [
    ...weights.flatMap((_, row) => [
      ...weights.map(
        (weight, col) =>
          contrast *
          (weight * (1 - saturation) + (row === col ? saturation : 0))
      ),
      0,
      offset,
    ]),
    0,
    0,
    0,
    1,
    0,
  ];
}

export function colorGradeFilter(
  clip: Pick<TimelineClip, "brightness" | "contrast" | "saturation">
): string {
  if (
    (clip.brightness ?? 0) === 0 &&
    (clip.contrast ?? 1) === 1 &&
    (clip.saturation ?? 1) === 1
  )
    return "null";
  const matrix = colorGradeMatrix(clip);
  const channels = ["r", "g", "b"];
  const expressions = channels.map((channel, row) => {
    const values = matrix.slice(row * 5, row * 5 + 5);
    const terms = channels.map(
      (c, col) => `${Number(values[col].toFixed(8))}*${c}(X,Y)`
    );
    return `${channel}='clip(${terms.join("+")}+${Number((values[4] * 255).toFixed(8))},0,255)'`;
  });
  return `format=gbrap,geq=${expressions.join(":")}:a='alpha(X,Y)'`;
}
