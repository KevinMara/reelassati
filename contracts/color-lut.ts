/** A saved reference to immutable catalog bytes, never a filename or URL. */
export interface ClipColorLut {
  id: string;
  name: string;
  sha256: string;
  amount: number;
}

export interface CubeLut {
  dimension: 3;
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  /** CUBE ordering: red changes fastest, then green, then blue. */
  data: Float32Array;
}

export const MAX_CUBE_BYTES = 32 * 1024 * 1024;
export const LUT_SIZE_MAX = 64;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const numeric = (value: string) =>
  /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)
    ? Number(value)
    : NaN;

export function normalizeClipColorLut(
  value: unknown
): ClipColorLut | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const row = value as Record<string, unknown>;
  if (
    typeof row.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(row.sha256) ||
    row.id !== `stock-${row.sha256.slice(0, 24)}` ||
    typeof row.name !== "string" ||
    !row.name.trim() ||
    row.name.length > 100 ||
    typeof row.amount !== "number" ||
    !Number.isFinite(row.amount)
  )
    return;
  return {
    id: row.id as string,
    name: row.name.trim(),
    sha256: row.sha256,
    amount: clamp(row.amount),
  };
}

/** Strict bounded parser. All 2,278 supplied files use this 3D CUBE format.
 * Unknown/combined shapers are rejected, never approximated with a named preset. */
export function parseCubeLut(source: string): CubeLut {
  if (!source || source.length > MAX_CUBE_BYTES)
    throw new Error("The color look file is empty or too large.");
  let size = 0,
    count = 0;
  let data: Float32Array | undefined;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const headers = new Set<string>();
  for (const raw of source.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.split("#", 1)[0].trim();
    if (!line) continue;
    const fields = line.split(/\s+/);
    const header = fields[0];
    if (/^[A-Za-z_]/.test(header)) {
      if (count)
        throw new Error("Color look headers must precede the samples.");
      if (header === "TITLE") continue;
      if (headers.has(header))
        throw new Error("The color look repeats a header.");
      headers.add(header);
      if (header === "LUT_3D_SIZE") {
        size = numeric(fields[1] ?? "");
        if (
          fields.length !== 2 ||
          !Number.isInteger(size) ||
          size < 2 ||
          size > LUT_SIZE_MAX
        )
          throw new Error(
            "The color look needs a 3D grid between 2 and 64 points per channel."
          );
        data = new Float32Array(size ** 3 * 3);
      } else if (header === "DOMAIN_MIN" || header === "DOMAIN_MAX") {
        const values = fields.slice(1).map(numeric);
        if (
          values.length !== 3 ||
          values.some(
            value => !Number.isFinite(value) || Math.abs(value) > 65536
          )
        )
          throw new Error("Invalid color look input range.");
        if (header === "DOMAIN_MIN") domainMin = values as typeof domainMin;
        else domainMax = values as typeof domainMax;
      } else
        throw new Error("This color look is not a supported 3D CUBE file.");
      continue;
    }
    const values = fields.map(numeric);
    if (
      !data ||
      values.length !== 3 ||
      values.some(
        value => !Number.isFinite(value) || Math.abs(value) > 65536
      ) ||
      count + 3 > data.length
    )
      throw new Error("The color look contains invalid or excess samples.");
    data.set(values, count);
    count += 3;
  }
  if (!data || count !== data.length)
    throw new Error("The color look sample grid is incomplete.");
  if (
    domainMin.some(
      (value, index) =>
        domainMax[index] <= value || domainMax[index] - value < 1e-6
    )
  )
    throw new Error("Invalid color look input range.");
  return { dimension: 3, size, domainMin, domainMax, data };
}

/** Trilinear interpolation shared by the CPU fallback and parity checks. */
export function sampleCubeLut(
  lut: CubeLut,
  rgb: readonly number[],
  amount = 1
): [number, number, number] {
  const coordinates = rgb.map(
    (value, channel) =>
      clamp(
        (value - lut.domainMin[channel]) /
          (lut.domainMax[channel] - lut.domainMin[channel])
      ) *
      (lut.size - 1)
  );
  const low = coordinates.map(Math.floor),
    high = low.map(value => Math.min(lut.size - 1, value + 1));
  const fraction = coordinates.map((value, channel) => value - low[channel]);
  const result = [0, 0, 0];
  for (let b = 0; b < 2; b++)
    for (let g = 0; g < 2; g++)
      for (let r = 0; r < 2; r++) {
        const weight =
          (r ? fraction[0] : 1 - fraction[0]) *
          (g ? fraction[1] : 1 - fraction[1]) *
          (b ? fraction[2] : 1 - fraction[2]);
        const index =
          ((b ? high[2] : low[2]) * lut.size * lut.size +
            (g ? high[1] : low[1]) * lut.size +
            (r ? high[0] : low[0])) *
          3;
        for (let channel = 0; channel < 3; channel++)
          result[channel] += lut.data[index + channel] * weight;
      }
  const strength = clamp(amount);
  return result.map((value, channel) =>
    clamp(rgb[channel] * (1 - strength) + clamp(value) * strength)
  ) as [number, number, number];
}

export function applyCubeLutPixels(
  lut: CubeLut,
  rgba: Uint8ClampedArray,
  amount: number
) {
  const size = lut.size,
    plane = size * size,
    scale = size - 1;
  const strength = clamp(amount),
    keep = 1 - strength;
  for (let index = 0; index < rgba.length; index += 4) {
    const r =
      clamp(
        (rgba[index] / 255 - lut.domainMin[0]) /
          (lut.domainMax[0] - lut.domainMin[0])
      ) * scale;
    const g =
      clamp(
        (rgba[index + 1] / 255 - lut.domainMin[1]) /
          (lut.domainMax[1] - lut.domainMin[1])
      ) * scale;
    const b =
      clamp(
        (rgba[index + 2] / 255 - lut.domainMin[2]) /
          (lut.domainMax[2] - lut.domainMin[2])
      ) * scale;
    const r0 = Math.floor(r),
      g0 = Math.floor(g),
      b0 = Math.floor(b);
    const r1 = Math.min(scale, r0 + 1),
      g1 = Math.min(scale, g0 + 1),
      b1 = Math.min(scale, b0 + 1);
    const fr = r - r0,
      fg = g - g0,
      fb = b - b0;
    for (let channel = 0; channel < 3; channel++) {
      const a =
        lut.data[(b0 * plane + g0 * size + r0) * 3 + channel] * (1 - fr) +
        lut.data[(b0 * plane + g0 * size + r1) * 3 + channel] * fr;
      const c =
        lut.data[(b0 * plane + g1 * size + r0) * 3 + channel] * (1 - fr) +
        lut.data[(b0 * plane + g1 * size + r1) * 3 + channel] * fr;
      const d =
        lut.data[(b1 * plane + g0 * size + r0) * 3 + channel] * (1 - fr) +
        lut.data[(b1 * plane + g0 * size + r1) * 3 + channel] * fr;
      const e =
        lut.data[(b1 * plane + g1 * size + r0) * 3 + channel] * (1 - fr) +
        lut.data[(b1 * plane + g1 * size + r1) * 3 + channel] * fr;
      const value =
        (a * (1 - fg) + c * fg) * (1 - fb) + (d * (1 - fg) + e * fg) * fb;
      rgba[index + channel] = Math.round(
        rgba[index + channel] * keep + clamp(value) * 255 * strength
      );
    }
  }
}

/** Export uses explicit domain normalization, avoiding older FFmpeg CUBE parsers'
 * incomplete DOMAIN_MIN handling. Samples themselves are not resampled. */
export function serializeCubeLut(lut: CubeLut): string {
  const lines = [
    `LUT_3D_SIZE ${lut.size}`,
    "DOMAIN_MIN 0 0 0",
    "DOMAIN_MAX 1 1 1",
  ];
  for (let i = 0; i < lut.data.length; i += 3)
    lines.push(`${lut.data[i]} ${lut.data[i + 1]} ${lut.data[i + 2]}`);
  return `${lines.join("\n")}\n`;
}
