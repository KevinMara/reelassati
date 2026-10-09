import { assertStillImageDimensions } from "./still-image-bounds";

export interface StillImageInference {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  values: Uint8Array;
}

function validate(result: StillImageInference) {
  assertStillImageDimensions(result.width, result.height);
  if (result.rgba.length !== result.width * result.height * 4 || result.values.length !== result.width * result.height) {
    throw new Error("The image model returned an incomplete result.");
  }
}

export function personCutoutPixels(result: StillImageInference, threshold: number, softness: number): Uint8ClampedArray {
  validate(result);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1 || !Number.isFinite(softness) || softness < 0 || softness > 0.5) {
    throw new Error("Invalid person cutout controls.");
  }
  const pixels = new Uint8ClampedArray(result.rgba);
  const low = threshold - softness / 2;
  for (let index = 0; index < result.values.length; index += 1) {
    const value = result.values[index] / 255;
    const linear = softness === 0 ? Number(value >= threshold) : Math.min(1, Math.max(0, (value - low) / softness));
    const smooth = linear * linear * (3 - 2 * linear);
    pixels[index * 4 + 3] = Math.round(result.rgba[index * 4 + 3] * smooth);
  }
  return pixels;
}

export function relativeDepthPixels(result: StillImageInference, invert: boolean): Uint8ClampedArray {
  validate(result);
  const pixels = new Uint8ClampedArray(result.rgba.length);
  for (let index = 0; index < result.values.length; index += 1) {
    const value = invert ? 255 - result.values[index] : result.values[index];
    pixels[index * 4] = value;
    pixels[index * 4 + 1] = value;
    pixels[index * 4 + 2] = value;
    pixels[index * 4 + 3] = result.rgba[index * 4 + 3];
  }
  return pixels;
}

export async function stillPixelsPng(result: StillImageInference, pixels: Uint8ClampedArray): Promise<Blob> {
  validate(result);
  if (pixels.length !== result.rgba.length) throw new Error("Incomplete image pixels.");
  const canvas = new OffscreenCanvas(result.width, result.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot render the still-image result.");
  context.putImageData(new ImageData(new Uint8ClampedArray(pixels), result.width, result.height), 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}
