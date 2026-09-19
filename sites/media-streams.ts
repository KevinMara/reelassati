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
  if (!Number.isSafeInteger(partSize) || partSize < 1)
    throw new Error("Media part size must be a positive integer");
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
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export interface MediaMultipartUpload {
  uploadPart(
    partNumber: number,
    value: Uint8Array
  ): Promise<{ etag: string; partNumber: number }>;
  complete(
    parts: { etag: string; partNumber: number }[]
  ): Promise<{ size: number }>;
  abort(): Promise<void>;
}

/** R2 put() rejects streams with no runtime-known length. Upload bounded byte
 * arrays instead; this works for chunked provider downloads and avoids buffering
 * several copies of a video in the Worker's memory. */
export async function storeMediaParts(
  upload: MediaMultipartUpload,
  body: ReadableStream<Uint8Array>,
  options: {
    partSize: number;
    maxBytes: number;
    expectedBytes?: number;
    suffix?: Uint8Array;
  }
) {
  const suffix = options.suffix ?? new Uint8Array();
  const parts: { etag: string; partNumber: number }[] = [];
  let size = 0;
  try {
    for await (const part of mediaParts(body, suffix, options.partSize)) {
      size += part.length;
      if (size > options.maxBytes + suffix.length)
        throw new Error("The generated media exceeds the supported file size");
      parts.push(await upload.uploadPart(parts.length + 1, part));
    }
    const sourceSize = size - suffix.length;
    if (sourceSize <= 0)
      throw new Error("The generated media download was empty");
    if (
      options.expectedBytes !== undefined &&
      sourceSize !== options.expectedBytes
    )
      throw new Error("The generated media download was incomplete");
    const completed = await upload.complete(parts);
    if (completed.size !== size)
      throw new Error(
        "The stored media size did not match the downloaded file"
      );
    return { size, sourceSize };
  } catch (error) {
    await upload.abort().catch(() => undefined);
    throw error;
  }
}
