import type { TimelineClip } from "@contracts/workspace";

/** A single sRGB transform for the browser and exported frames. */
export function colorGradeMatrix(clip: Partial<TimelineClip>): number[] {
  const bound = (
    n: number | undefined,
    fallback: number,
    min: number,
    max: number
  ) => (Number.isFinite(n) ? Math.max(min, Math.min(max, n!)) : fallback);
  const contrast = bound(clip.contrast, 1, 0.5, 2);
  const saturation = bound(clip.saturation, 1, 0, 3);
  const offset = bound(clip.brightness, 0, -0.5, 0.5) + (1 - contrast) / 2;
  const exposure = 2 ** bound(clip.exposure, 0, -2, 2);
  const temperature = bound(clip.temperature, 0, -1, 1),
    tint = bound(clip.tint, 0, -1, 1);
  const gains = [
    1 + temperature * 0.2 + tint * 0.05,
    1 - tint * 0.15,
    1 - temperature * 0.2 + tint * 0.05,
  ].map(gain => gain * exposure);
  const weights = [0.2126, 0.7152, 0.0722];
  return [
    ...weights.flatMap((_, row) => [
      ...weights.map(
        (weight, col) =>
          gains[row] *
          contrast *
          (weight * (1 - saturation) + (row === col ? saturation : 0))
      ),
      0,
      offset * gains[row],
    ]),
    0,
    0,
    0,
    1,
    0,
  ];
}

export function colorGradeFilter(clip: Partial<TimelineClip>): string {
  if (
    [
      clip.exposure,
      clip.temperature,
      clip.tint,
      clip.highlights,
      clip.shadows,
      clip.whites,
      clip.blacks,
    ].every(value => !value) &&
    (clip.brightness ?? 0) === 0 &&
    (clip.contrast ?? 1) === 1 &&
    (clip.saturation ?? 1) === 1
  )
    return "null";
  const matrix = colorGradeMatrix(clip);
  // Brightness/contrast do not mix channels. A 256-entry lookup per channel
  // performs the identical transform without interpreting an expression for
  // every full-resolution pixel. Keep the cross-channel path for saturation.
  if (
    matrix[1] === 0 &&
    matrix[2] === 0 &&
    matrix[5] === 0 &&
    matrix[7] === 0 &&
    matrix[10] === 0 &&
    matrix[11] === 0
  ) {
    const expressions = ["r", "g", "b"].map(
      (channel, row) =>
        channel +
        "='clip(" +
        Number(matrix[row * 5 + row].toFixed(8)) +
        "*val+" +
        Number((matrix[row * 5 + 4] * 255).toFixed(8)) +
        ",0,255)'"
    );
    return (
      "format=gbrap,lutrgb=" + expressions.join(":") + colorToneFilter(clip)
    );
  }
  const channels = ["r", "g", "b"];
  const expressions = channels.map((channel, row) => {
    const values = matrix.slice(row * 5, row * 5 + 5);
    const terms = channels.map(
      (c, col) => `${Number(values[col].toFixed(8))}*${c}(X,Y)`
    );
    return `${channel}='clip(${terms.join("+")}+${Number((values[4] * 255).toFixed(8))},0,255)'`;
  });
  // This is a pointwise color transform, not spatial resampling. Explicit
  // nearest sampling also preserves the final row/column on older FFmpeg builds.
  return `format=gbrap,geq=${expressions.join(":")}:a='alpha(X,Y)':interpolation=nearest${colorToneFilter(clip)}`;
}

export function colorToneValue(
  value: number,
  clip: Partial<TimelineClip>
): number {
  const n = (key: "shadows" | "highlights" | "whites" | "blacks") =>
    Math.max(-1, Math.min(1, Number.isFinite(clip[key]) ? clip[key]! : 0));
  return Math.max(
    0,
    Math.min(
      1,
      value +
        n("shadows") * 0.25 * (1 - value) ** 2 +
        n("highlights") * 0.25 * value ** 2 +
        n("whites") * 0.15 * value ** 4 +
        n("blacks") * 0.15 * (1 - value) ** 4
    )
  );
}
export function colorToneTable(clip: Partial<TimelineClip>) {
  return Array.from({ length: 256 }, (_, i) => colorToneValue(i / 255, clip));
}
function colorToneFilter(clip: Partial<TimelineClip>): string {
  const get = (key: "shadows" | "highlights" | "whites" | "blacks") =>
    Math.max(-1, Math.min(1, Number.isFinite(clip[key]) ? clip[key]! : 0));
  if (![clip.shadows, clip.highlights, clip.whites, clip.blacks].some(Boolean))
    return "";
  const expression =
    "'clip(val+255*(" +
    get("shadows") +
    "*0.25*pow(1-val/255,2)+" +
    get("highlights") +
    "*0.25*pow(val/255,2)+" +
    get("whites") +
    "*0.15*pow(val/255,4)+" +
    get("blacks") +
    "*0.15*pow(1-val/255,4)),0,255)'";
  return ",lutrgb=r=" + expression + ":g=" + expression + ":b=" + expression;
}
