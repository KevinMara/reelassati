/** Check container dimensions before handing untrusted bytes to an image decoder. */
export const STILL_IMAGE_LIMITS = {
  bytes: 20 * 1024 * 1024,
  pixels: 4_000_000,
  side: 4096,
  aspect: 20,
  headerBytes: 1024 * 1024,
} as const;

export interface StillImageSize {
  width: number;
  height: number;
  format: "png" | "jpeg" | "webp";
}

export function assertStillImageDimensions(width: number, height: number) {
  if (
    !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
    width < 1 || height < 1 ||
    width > STILL_IMAGE_LIMITS.side || height > STILL_IMAGE_LIMITS.side ||
    width * height > STILL_IMAGE_LIMITS.pixels ||
    Math.max(width / height, height / width) > STILL_IMAGE_LIMITS.aspect
  ) {
    throw new Error("Use an image up to 4 megapixels, 4096 pixels per side, with an aspect ratio within 20:1.");
  }
}

export function inspectStillImageHeader(bytes: Uint8Array): StillImageSize {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number, text: string) =>
    offset + text.length <= bytes.length &&
    [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0));
  const finish = (width: number, height: number, format: StillImageSize["format"]) => {
    assertStillImageDimensions(width, height);
    return { width, height, format };
  };
  if (bytes.length >= 33 && bytes[0] === 137 && ascii(1, "PNG\r\n\x1a\n")) {
    if (view.getUint32(8) !== 13 || !ascii(12, "IHDR")) throw new Error("Invalid PNG image header.");
    return finish(view.getUint32(16), view.getUint32(20), "png");
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 0xff) break;
      while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const size = view.getUint16(offset);
      if (size < 2 || offset + size > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (size < 8) break;
        return finish(view.getUint16(offset + 5), view.getUint16(offset + 3), "jpeg");
      }
      offset += size;
    }
    throw new Error("JPEG dimensions were not found in the bounded image header.");
  }
  if (bytes.length >= 20 && ascii(0, "RIFF") && ascii(8, "WEBP")) {
    let offset = 12;
    const uint24 = (at: number) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
    while (offset + 8 <= bytes.length) {
      const size = view.getUint32(offset + 4, true);
      const data = offset + 8;
      if (ascii(offset, "VP8X") && size >= 10 && data + 10 <= bytes.length) {
        if (bytes[data] & 2) throw new Error("Choose a still WebP image, rather than an animation.");
        return finish(uint24(data + 4) + 1, uint24(data + 7) + 1, "webp");
      }
      if (ascii(offset, "VP8 ") && size >= 10 && data + 10 <= bytes.length && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
        return finish(view.getUint16(data + 6, true) & 0x3fff, view.getUint16(data + 8, true) & 0x3fff, "webp");
      }
      if (ascii(offset, "VP8L") && size >= 5 && data + 5 <= bytes.length && bytes[data] === 0x2f) {
        const bits = view.getUint32(data + 1, true);
        return finish((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1, "webp");
      }
      offset = data + size + (size & 1);
    }
    throw new Error("WebP dimensions were not found in the bounded image header.");
  }
  throw new Error("Choose a PNG, JPEG or WebP still image.");
}

export async function inspectStillImage(blob: Blob): Promise<StillImageSize> {
  if (blob.size < 12 || blob.size > STILL_IMAGE_LIMITS.bytes) throw new Error("Use a PNG, JPEG or WebP image up to 20 MB.");
  return inspectStillImageHeader(new Uint8Array(await blob.slice(0, STILL_IMAGE_LIMITS.headerBytes).arrayBuffer()));
}
