import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  embedMediaProvenanceMarker,
  ebmlSize,
  inspectWebmMarkerTail,
  inspectMediaProvenanceMarker,
  readEbmlElementHeader,
  readWebmSegmentHeader,
  validateWebmTopLevelHeader,
  webmMarker,
  WEBM_HEADER_LIMIT,
  type EbmlElementHeader,
} from "./media-provenance";

export { webmMarker } from "./media-provenance";

class WebmTopLevelScanner {
  private header = new Uint8Array(0);
  private remaining = 0;
  offset: number;
  lastElementStart = -1;
  lastElementEnd = -1;
  constructor(start: number) {
    this.offset = start;
  }
  feed(value: Uint8Array) {
    let offset = 0;
    while (offset < value.length) {
      if (this.remaining) {
        const count = Math.min(this.remaining, value.length - offset);
        this.remaining -= count;
        offset += count;
        this.offset += count;
        continue;
      }
      const header = new Uint8Array(this.header.length + 1);
      header.set(this.header);
      header[header.length - 1] = value[offset++];
      this.header = header;
      const element = readEbmlElementHeader(header, 0);
      if (!element) continue;
      validateWebmTopLevelHeader(element);
      this.lastElementStart = this.offset;
      this.offset += header.length;
      this.remaining = element.size!;
      this.lastElementEnd = this.offset + this.remaining;
      this.header = new Uint8Array(0);
    }
  }
  finish(size: number) {
    if (this.remaining || this.header.length || this.offset !== size)
      throw new Error(
        "The WebM upload is truncated or contains trailing bytes"
      );
  }
}

/** Validate/hash a WebM in bounded memory. For marked delivery, markerToken is
 * the signed row's expected token: its exact encoded length permits restoring
 * the original finite Segment size before hashing the first bytes. Without a
 * token the fingerprint covers the complete uploaded file, including old Tags. */
export async function inspectWebmStream(
  body: ReadableStream<Uint8Array>,
  expectedBytes: number,
  markerToken?: string
) {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 1)
    throw new Error("Invalid WebM upload size");
  const markerLength = markerToken ? webmMarker(markerToken).length : 0;
  const hash = sha256.create();
  const reader = body.getReader();
  let prefix = new Uint8Array(0),
    tail = new Uint8Array(0);
  let segment: EbmlElementHeader | null = null;
  let scanner: WebmTopLevelScanner | null = null;
  let size = 0;
  const consume = (value: Uint8Array) => {
    scanner!.feed(value);
    if (value.length >= 512) {
      hash.update(tail);
      hash.update(value.subarray(0, value.length - 512));
      tail = value.slice(value.length - 512);
      return;
    }
    const merged = new Uint8Array(tail.length + value.length);
    merged.set(tail);
    merged.set(value, tail.length);
    const keep = Math.max(0, merged.length - 512);
    hash.update(merged.subarray(0, keep));
    tail = merged.slice(keep);
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > expectedBytes) throw new Error("The WebM upload size changed");
      if (segment) {
        consume(value);
        continue;
      }
      const take = Math.min(value.length, WEBM_HEADER_LIMIT - prefix.length);
      const combined = new Uint8Array(prefix.length + take);
      combined.set(prefix);
      combined.set(value.subarray(0, take), prefix.length);
      prefix = combined;
      segment = readWebmSegmentHeader(prefix);
      if (!segment) {
        if (prefix.length === WEBM_HEADER_LIMIT)
          throw new Error("The WebM header is too large");
        continue;
      }
      if (
        segment.size !== null &&
        segment.dataOffset + segment.size !== expectedBytes
      )
        throw new Error("The WebM Segment size does not match the upload");
      scanner = new WebmTopLevelScanner(segment.dataOffset);
      const header = prefix.slice(0, segment.dataOffset);
      if (segment.size !== null && markerLength)
        header.set(
          ebmlSize(segment.size - markerLength, segment.sizeLength),
          segment.sizeOffset
        );
      hash.update(header);
      consume(prefix.subarray(segment.dataOffset));
      consume(value.subarray(take));
      prefix = new Uint8Array(0);
    }
    if (!segment || !scanner || size !== expectedBytes)
      throw new Error("The WebM upload is incomplete");
    scanner.finish(size);
    const found = inspectWebmMarkerTail(tail);
    const marker =
      found &&
      size - tail.length + found.offset === scanner.lastElementStart &&
      scanner.lastElementEnd === size
        ? found
        : null;
    const stripsMarker = Boolean(markerToken && marker?.token === markerToken);
    hash.update(stripsMarker ? tail.subarray(0, marker!.offset) : tail);
    return { size, fingerprint: bytesToHex(hash.digest()), marker };
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Append a global Tags element without moving existing Cues/Seek offsets. The
 * original source has already been inspected and its object etag rechecked. */
export function markWebmStream(
  body: ReadableStream<Uint8Array>,
  expectedBytes: number,
  token: string
): ReadableStream<Uint8Array> {
  const marker = webmMarker(token);
  const reader = body.getReader();
  let prefix = new Uint8Array(0),
    headerDone = false,
    ended = false,
    size = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (ended) {
          controller.close();
          return;
        }
        while (true) {
          const next = await reader.read();
          if (next.done) {
            if (!headerDone || size !== expectedBytes)
              throw new Error("The WebM source changed during marking");
            ended = true;
            reader.releaseLock();
            controller.enqueue(marker);
            return;
          }
          size += next.value.length;
          if (size > expectedBytes)
            throw new Error("The WebM source size changed during marking");
          if (headerDone) {
            controller.enqueue(next.value);
            return;
          }
          const take = Math.min(
            next.value.length,
            WEBM_HEADER_LIMIT - prefix.length
          );
          const combined = new Uint8Array(prefix.length + take);
          combined.set(prefix);
          combined.set(next.value.subarray(0, take), prefix.length);
          prefix = combined;
          const segment = readWebmSegmentHeader(prefix);
          if (!segment) {
            if (prefix.length === WEBM_HEADER_LIMIT)
              throw new Error("The WebM header is too large");
            continue;
          }
          if (segment.size !== null) {
            if (segment.dataOffset + segment.size !== expectedBytes)
              throw new Error("The WebM Segment size changed during marking");
            prefix.set(
              ebmlSize(segment.size + marker.length, segment.sizeLength),
              segment.sizeOffset
            );
          }
          headerDone = true;
          controller.enqueue(prefix);
          if (take < next.value.length)
            controller.enqueue(next.value.subarray(take));
          prefix = new Uint8Array(0);
          return;
        }
      } catch (error) {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
        controller.error(error);
      }
    },
    async cancel(reason) {
      if (!ended) {
        await reader.cancel(reason).catch(() => undefined);
        reader.releaseLock();
        ended = true;
      }
    },
  });
}

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
