import { AI_BINARY_MARKER_PREFIX } from "../contracts/compliance";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MP4_PROVENANCE_UUID = new Uint8Array([
  0x72, 0x65, 0x65, 0x6c, 0x61, 0x73, 0x73, 0x61, 0x74, 0x69, 0x2d, 0x61, 0x69,
  0x2d, 0x76, 0x31,
]);
const ID3_OWNER = encoder.encode("com.reelassati.provenance");
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,96}$/;

export type EmbeddedMediaMarkingMethod =
  "mp4-uuid-box" | "mp3-id3v2-private-frame";

export interface EmbeddedMediaMark {
  bytes: ArrayBuffer;
  method: EmbeddedMediaMarkingMethod;
}

export interface InspectedMediaMark {
  token: string;
  unmarkedBytes: ArrayBuffer;
  method: EmbeddedMediaMarkingMethod;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    parts.reduce((length, part) => length + part.byteLength, 0)
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const output = new Uint8Array(bytes.byteLength);
  output.set(bytes);
  return output.buffer;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength &&
    left.every((value, index) => value === right[index])
  );
}

function syncSafeBytes(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 21) & 0x7f,
    (value >>> 14) & 0x7f,
    (value >>> 7) & 0x7f,
    value & 0x7f,
  ]);
}

function syncSafeValue(bytes: Uint8Array): number {
  if (bytes.byteLength !== 4 || bytes.some(value => value > 0x7f)) return -1;
  return (bytes[0] << 21) | (bytes[1] << 14) | (bytes[2] << 7) | bytes[3];
}

function isMp4(bytes: Uint8Array, contentType: string): boolean {
  return (
    contentType.toLowerCase() === "video/mp4" ||
    (bytes.byteLength >= 12 && decoder.decode(bytes.slice(4, 8)) === "ftyp")
  );
}

function isMp3(bytes: Uint8Array, contentType: string): boolean {
  return (
    ["audio/mpeg", "audio/mp3"].includes(contentType.toLowerCase()) ||
    decoder.decode(bytes.slice(0, 3)) === "ID3" ||
    (bytes.byteLength >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  );
}

function embedMp4(bytes: Uint8Array, token: string): EmbeddedMediaMark {
  const payload = encoder.encode(`${AI_BINARY_MARKER_PREFIX}${token}`);
  const box = new Uint8Array(24 + payload.byteLength);
  new DataView(box.buffer).setUint32(0, box.byteLength, false);
  box.set(encoder.encode("uuid"), 4);
  box.set(MP4_PROVENANCE_UUID, 8);
  box.set(payload, 24);
  return {
    bytes: arrayBuffer(concatBytes(bytes, box)),
    method: "mp4-uuid-box",
  };
}

function embedMp3(bytes: Uint8Array, token: string): EmbeddedMediaMark {
  const marker = encoder.encode(`${AI_BINARY_MARKER_PREFIX}${token}`);
  const framePayload = concatBytes(ID3_OWNER, new Uint8Array([0]), marker);
  const frame = new Uint8Array(10 + framePayload.byteLength);
  frame.set(encoder.encode("PRIV"), 0);
  frame.set(syncSafeBytes(framePayload.byteLength), 4);
  frame.set(framePayload, 10);

  const hasId3 =
    bytes.byteLength >= 10 && decoder.decode(bytes.slice(0, 3)) === "ID3";
  const existingSize = hasId3 ? syncSafeValue(bytes.slice(6, 10)) : -1;
  const validExistingTag =
    existingSize >= 0 && 10 + existingSize <= bytes.byteLength;
  const existingPayload = validExistingTag
    ? bytes.slice(10, 10 + existingSize)
    : new Uint8Array();
  const rest = validExistingTag ? bytes.slice(10 + existingSize) : bytes;
  const payload = concatBytes(existingPayload, frame);
  const header = new Uint8Array(10);
  header.set(encoder.encode("ID3"), 0);
  header[3] = validExistingTag ? bytes[3] : 4;
  header[4] = validExistingTag ? bytes[4] : 0;
  header[5] = validExistingTag ? bytes[5] : 0;
  header.set(syncSafeBytes(payload.byteLength), 6);
  return {
    bytes: arrayBuffer(concatBytes(header, payload, rest)),
    method: "mp3-id3v2-private-frame",
  };
}

/**
 * EU-AI-04 — Embed a compact, machine-readable token into the final media
 * bytes without re-encoding audio or video. Unsupported formats return null
 * so generation can fail closed instead of silently producing an unmarked
 * output.
 */
export function embedMediaProvenanceMarker(
  value: ArrayBuffer,
  contentType: string,
  token: string
): EmbeddedMediaMark | null {
  if (!TOKEN_PATTERN.test(token)) return null;
  const existing = inspectMediaProvenanceMarker(value);
  if (existing) {
    return existing.token === token
      ? { bytes: value, method: existing.method }
      : null;
  }
  const bytes = new Uint8Array(value);
  if (isMp4(bytes, contentType)) return embedMp4(bytes, token);
  if (isMp3(bytes, contentType)) return embedMp3(bytes, token);
  return null;
}

function inspectMp4(bytes: Uint8Array): InspectedMediaMark | null {
  const prefix = encoder.encode(AI_BINARY_MARKER_PREFIX);
  const minimumStart = Math.max(24, bytes.byteLength - 160);
  for (
    let markerStart = bytes.byteLength - prefix.byteLength;
    markerStart >= minimumStart;
    markerStart -= 1
  ) {
    if (
      !equalBytes(
        bytes.slice(markerStart, markerStart + prefix.byteLength),
        prefix
      )
    ) {
      continue;
    }
    const boxStart = markerStart - 24;
    if (boxStart < 0) continue;
    const boxSize = new DataView(
      bytes.buffer,
      bytes.byteOffset + boxStart,
      4
    ).getUint32(0, false);
    if (
      boxStart + boxSize !== bytes.byteLength ||
      decoder.decode(bytes.slice(boxStart + 4, boxStart + 8)) !== "uuid" ||
      !equalBytes(bytes.slice(boxStart + 8, boxStart + 24), MP4_PROVENANCE_UUID)
    ) {
      continue;
    }
    const token = decoder
      .decode(bytes.slice(markerStart + prefix.byteLength))
      .trim();
    if (!TOKEN_PATTERN.test(token)) return null;
    return {
      token,
      unmarkedBytes: arrayBuffer(bytes.slice(0, boxStart)),
      method: "mp4-uuid-box",
    };
  }
  return null;
}

function inspectMp3(bytes: Uint8Array): InspectedMediaMark | null {
  if (bytes.byteLength < 10 || decoder.decode(bytes.slice(0, 3)) !== "ID3") {
    return null;
  }
  const tagSize = syncSafeValue(bytes.slice(6, 10));
  const tagEnd = 10 + tagSize;
  if (tagSize < 10 || tagEnd > bytes.byteLength) return null;
  const markerPrefix = concatBytes(
    ID3_OWNER,
    new Uint8Array([0]),
    encoder.encode(AI_BINARY_MARKER_PREFIX)
  );
  const markerStartMinimum = Math.max(10, tagEnd - 180);
  for (
    let markerStart = tagEnd - markerPrefix.byteLength;
    markerStart >= markerStartMinimum;
    markerStart -= 1
  ) {
    if (
      !equalBytes(
        bytes.slice(markerStart, markerStart + markerPrefix.byteLength),
        markerPrefix
      )
    ) {
      continue;
    }
    const frameStart = markerStart - 10;
    if (
      frameStart < 10 ||
      decoder.decode(bytes.slice(frameStart, frameStart + 4)) !== "PRIV"
    ) {
      continue;
    }
    const frameSize = syncSafeValue(
      bytes.slice(frameStart + 4, frameStart + 8)
    );
    if (frameSize < 0 || frameStart + 10 + frameSize !== tagEnd) continue;
    const tokenStart = markerStart + markerPrefix.byteLength;
    const token = decoder.decode(bytes.slice(tokenStart, tagEnd)).trim();
    if (!TOKEN_PATTERN.test(token)) return null;

    const originalPayload = bytes.slice(10, frameStart);
    const rest = bytes.slice(tagEnd);
    const unmarked = originalPayload.byteLength
      ? concatBytes(
          bytes.slice(0, 6),
          syncSafeBytes(originalPayload.byteLength),
          originalPayload,
          rest
        )
      : rest;
    return {
      token,
      unmarkedBytes: arrayBuffer(unmarked),
      method: "mp3-id3v2-private-frame",
    };
  }
  return null;
}

export function inspectMediaProvenanceMarker(
  value: ArrayBuffer
): InspectedMediaMark | null {
  const bytes = new Uint8Array(value);
  return inspectMp4(bytes) || inspectMp3(bytes);
}
