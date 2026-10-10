import { describe, expect, it } from "vitest";
import { assertDepthImageDimensions, inspectStillImage, inspectStillImageHeader, STILL_IMAGE_LIMITS } from "./still-image-bounds";

function png(width: number, height: number) {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set(new TextEncoder().encode("IHDR"), 12);
  view.setUint32(16, width); view.setUint32(20, height);
  return bytes;
}
function webp(width: number, height: number, animated = false) {
  const bytes = new Uint8Array(30);
  bytes.set(new TextEncoder().encode("RIFF"));
  bytes.set(new TextEncoder().encode("WEBPVP8X"), 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(4, 22, true); view.setUint32(16, 10, true);
  bytes[20] = animated ? 2 : 0;
  for (let index = 0; index < 3; index += 1) {
    bytes[24 + index] = ((width - 1) >>> (index * 8)) & 255;
    bytes[27 + index] = ((height - 1) >>> (index * 8)) & 255;
  }
  return bytes;
}

describe("still-image predecode bounds", () => {
  it("reads PNG, extended WebP and progressive JPEG dimensions without decoding", () => {
    expect(inspectStillImageHeader(png(1080, 1920))).toEqual({ width: 1080, height: 1920, format: "png" });
    expect(inspectStillImageHeader(webp(1920, 1080))).toEqual({ width: 1920, height: 1080, format: "webp" });
    const jpeg = Uint8Array.from([255, 216, 255, 194, 0, 11, 8, 1, 224, 2, 128, 3, 1, 17, 0]);
    expect(inspectStillImageHeader(jpeg)).toEqual({ width: 640, height: 480, format: "jpeg" });
  });
  it.each([[4097, 100], [2001, 2000], [100, 0], [21, 1]])("rejects oversized or invalid %i × %i pixels before decoding", (width, height) => {
    expect(() => inspectStillImageHeader(png(width, height))).toThrow("4 megapixels");
  });
  it("rejects animated WebP, unsupported formats and truncated size headers", () => {
    expect(() => inspectStillImageHeader(webp(100, 100, true))).toThrow("still WebP");
    expect(() => inspectStillImageHeader(new TextEncoder().encode("GIF89a fake data"))).toThrow("PNG, JPEG or WebP");
    expect(() => inspectStillImageHeader(png(100, 100).slice(0, 22))).toThrow();
  });
  it("bounds the original byte count and reads only a bounded header", async () => {
    await expect(inspectStillImage(new Blob([new Uint8Array(STILL_IMAGE_LIMITS.bytes + 1)]))).rejects.toThrow("20 MB");
    const blob = new Blob([png(100, 100), new Uint8Array(STILL_IMAGE_LIMITS.headerBytes)]);
    await expect(inspectStillImage(blob)).resolves.toMatchObject({ width: 100, height: 100 });
  });
  it("supports landscape and portrait video ratios but rejects extreme depth inputs", () => {
    expect(() => assertDepthImageDimensions(1920, 1080)).not.toThrow();
    expect(() => assertDepthImageDimensions(1080, 1920)).not.toThrow();
    expect(() => assertDepthImageDimensions(1024, 512)).not.toThrow();
    expect(() => assertDepthImageDimensions(1025, 512)).toThrow("1:2 and 2:1");
  });
});
