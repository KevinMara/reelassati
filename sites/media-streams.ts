import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  embedMediaProvenanceMarker,
  inspectMediaProvenanceMarker,
} from "./media-provenance";

/** Keeps a small trailing window while hashing arbitrarily large MP4 files. */
export async function inspectMp4Stream(body: ReadableStream<Uint8Array>) {
  const hash = sha256.create();
  const reader = body.getReader();
  let tail = new Uint8Array(0);
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      const merged = new Uint8Array(tail.length + value.length);
      merged.set(tail);
      merged.set(value, tail.length);
      const keep = Math.max(0, merged.length - 512);
      hash.update(merged.subarray(0, keep));
      tail = merged.slice(keep);
    }
  } finally {
    reader.releaseLock();
  }
  const marker = inspectMediaProvenanceMarker(tail.buffer);
  hash.update(marker ? new Uint8Array(marker.unmarkedBytes) : tail);
  return { size, fingerprint: bytesToHex(hash.digest()), marker };
}

export async function hashMediaStream(body: ReadableStream<Uint8Array>) {
  const hash = sha256.create();
  const reader = body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
    }
    return bytesToHex(hash.digest());
  } finally {
    reader.releaseLock();
  }
}

export function mp4Marker(token: string): Uint8Array {
  const marked = embedMediaProvenanceMarker(
    new ArrayBuffer(0),
    "video/mp4",
    token
  );
  if (!marked) throw new Error("Could not mark the finished video");
  return new Uint8Array(marked.bytes);
}

/** Fixed-size parts satisfy R2's minimum/equal-part-size requirements. */
export async function* mediaParts(
  body: ReadableStream<Uint8Array>,
  suffix: Uint8Array,
  partSize: number
) {
  const reader = body.getReader();
  let part = new Uint8Array(partSize);
  let filled = 0;
  try {
    let ended = false;
    while (!ended) {
      const next = await reader.read();
      ended = next.done;
      const value = next.done ? suffix : next.value;
      let offset = 0;
      while (offset < value.length) {
        const count = Math.min(partSize - filled, value.length - offset);
        part.set(value.subarray(offset, offset + count), filled);
        filled += count;
        offset += count;
        if (filled === partSize) {
          yield part;
          part = new Uint8Array(partSize);
          filled = 0;
        }
      }
    }
    if (filled) yield part.slice(0, filled);
  } finally {
    reader.releaseLock();
  }
}
