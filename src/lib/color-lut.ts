import {
  MAX_CUBE_BYTES,
  normalizeClipColorLut,
  parseCubeLut,
  type ClipColorLut,
  type CubeLut,
} from "@contracts/color-lut";
import { sharedCatalogMediaPath } from "@contracts/shared-media-catalog";
import type { EditProject } from "@contracts/workspace";
import { platformApiUrl } from "./runtime";

const parsed = new Map<string, CubeLut>();

export async function loadColorLut(
  reference: ClipColorLut,
  signal?: AbortSignal
): Promise<CubeLut> {
  const valid = normalizeClipColorLut(reference);
  if (!valid)
    throw new Error(
      "The saved color look is invalid. Remove it or select it again."
    );
  signal?.throwIfAborted();
  const cached = parsed.get(valid.sha256);
  if (cached) return cached;
  const response = await fetch(
    platformApiUrl(sharedCatalogMediaPath(valid.id)),
    { signal }
  );
  if (!response.ok)
    throw new Error(
      "The color look could not load. Select it again when available."
    );
  if (Number(response.headers.get("content-length") || 0) > MAX_CUBE_BYTES)
    throw new Error("The color look file is too large.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  signal?.throwIfAborted();
  if (bytes.length > MAX_CUBE_BYTES)
    throw new Error("The color look file is too large.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const sha256 = Array.from(digest, value =>
    value.toString(16).padStart(2, "0")
  ).join("");
  if (sha256 !== valid.sha256)
    throw new Error("The color look file does not match the saved look.");
  const lut = parseCubeLut(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  );
  signal?.throwIfAborted();
  parsed.set(valid.sha256, lut);
  while (parsed.size > 8) parsed.delete(parsed.keys().next().value!);
  return lut;
}

export function projectColorLuts(
  project: Pick<EditProject, "clips">
): ClipColorLut[] {
  const references = new Map<string, ClipColorLut>();
  for (const clip of project.clips) {
    if (
      !clip.colorLut ||
      clip.graphic ||
      clip.hidden ||
      clip.track === "audio" ||
      clip.track === "captions"
    )
      continue;
    const lut = normalizeClipColorLut(clip.colorLut);
    if (!lut)
      throw new Error(
        "A clip has an invalid color look. Remove it or select it again before exporting."
      );
    if (lut.amount > 0) references.set(`${lut.sha256}:${lut.amount}`, lut);
  }
  return [...references.values()];
}

export const colorLutFilename = (reference: ClipColorLut) =>
  `look-${reference.sha256}-${String(reference.amount).replace(".", "_")}.cube`;

function canBakeColorLut(reference: ClipColorLut, lut: CubeLut) {
  return (
    lut.domainMin.every(
      (value, index) => value === 0 && lut.domainMax[index] === 1
    ) &&
    (reference.amount === 1 ||
      lut.data.every(value => value >= 0 && value <= 1))
  );
}

/** Trilinear interpolation commutes exactly with the identity/lookup blend for
 * unit-domain tables whose samples stay in gamut. Bake only in that case;
 * clipping and nonstandard input domains retain the general measured path. */
export function prepareColorLutExport(
  reference: ClipColorLut,
  lut: CubeLut
): CubeLut {
  if (reference.amount === 1 || !canBakeColorLut(reference, lut)) return lut;
  const data = new Float32Array(lut.data.length),
    maximum = lut.size - 1;
  for (let b = 0; b < lut.size; b++)
    for (let g = 0; g < lut.size; g++)
      for (let r = 0; r < lut.size; r++) {
        const index = (b * lut.size * lut.size + g * lut.size + r) * 3;
        data[index] =
          lut.data[index] * reference.amount +
          (r / maximum) * (1 - reference.amount);
        data[index + 1] =
          lut.data[index + 1] * reference.amount +
          (g / maximum) * (1 - reference.amount);
        data[index + 2] =
          lut.data[index + 2] * reference.amount +
          (b / maximum) * (1 - reference.amount);
      }
  return { ...lut, data };
}

/** 16-bit lookup/blend keeps quantization below one displayed RGB level.
 * The opaque/transparent source alpha is unchanged throughout this stage. */
export function colorLutFilter(
  reference: ClipColorLut,
  lut: CubeLut,
  scope: number
): string {
  if (reference.amount === 0) return "null";
  if (canBakeColorLut(reference, lut))
    return `format=rgba,lut3d=file=${colorLutFilename(reference)}:interp=trilinear`;
  const channels = ["r", "g", "b"];
  const domain = lut.domainMin.some(
    (value, channel) => value !== 0 || lut.domainMax[channel] !== 1
  )
    ? `lutrgb=${channels.map((channel, index) => `${channel}='clip((val/65535-(${lut.domainMin[index]}))/(${lut.domainMax[index] - lut.domainMin[index]}),0,1)*65535'`).join(":")},`
    : "";
  const lookup = `${domain}lut3d=file=${colorLutFilename(reference)}:interp=trilinear`;
  const prefix = `look${scope}`;
  const amount = Number(reference.amount.toFixed(6));
  const rgb =
    reference.amount === 1
      ? `format=gbrap16le,${lookup}`
      : `format=gbrap16le,split[${prefix}original][${prefix}in];[${prefix}in]${lookup}[${prefix}processed];[${prefix}original][${prefix}processed]blend=all_expr='A*${1 - amount}+B*${amount}'`;
  // Preserve the original 8-bit alpha separately: swscale's 8→16→8 alpha
  // conversion changes half-transparent values by one in the shipped core.
  return `format=rgba,split[${prefix}alphaIn][${prefix}rgbIn];[${prefix}alphaIn]alphaextract[${prefix}alpha];[${prefix}rgbIn]${rgb},format=gbrp[${prefix}rgb];[${prefix}rgb][${prefix}alpha]alphamerge`;
}
