import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  hashMediaStream,
  inspectMp4Stream,
  mediaParts,
  mp4Marker,
  storeMediaParts,
} from "./media-streams";

function stream(bytes: Uint8Array, chunkSize = 73) {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset === bytes.length) return controller.close();
      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset = Math.min(bytes.length, offset + chunkSize);
    },
  });
}
describe("streamed MP4 saving", () => {
  it("preserves and verifies original bytes with a marker split across arbitrary chunks", async () => {
    const raw = new Uint8Array(120_003).map((_, i) => i % 251);
    const token = "0123456789abcdef_streamed_video";
    const marker = mp4Marker(token);
    const stored = new Uint8Array(raw.length + marker.length);
    stored.set(raw);
    stored.set(marker, raw.length);
    const verified = await inspectMp4Stream(stream(stored));
    const expected = createHash("sha256").update(raw).digest("hex");
    expect(await hashMediaStream(stream(raw))).toBe(expected);
    expect(verified.fingerprint).toBe(expected);
    expect(verified.marker?.token).toBe(token);
    expect(verified.size).toBe(stored.length);
    stored[4000] ^= 1;
    expect((await inspectMp4Stream(stream(stored))).fingerprint).not.toBe(
      expected
    );
  });
  it("produces equally sized multipart chunks, except the final chunk, without losing the suffix", async () => {
    const raw = new Uint8Array(251).fill(17);
    const suffix = new Uint8Array([1, 2, 3, 4, 5]);
    const parts: Uint8Array[] = [];
    for await (const part of mediaParts(stream(raw, 13), suffix, 100))
      parts.push(part);
    expect(parts.map(p => p.length)).toEqual([100, 100, 56]);
    expect([...parts.flatMap(p => [...p])]).toEqual([...raw, ...suffix]);
    expect((await inspectMp4Stream(stream(raw))).marker).toBeNull();
  });
  it("stores unknown-length provider streams as fixed-size arrays and verifies the marked output", async () => {
    const raw = new Uint8Array(500_009).map((_, i) => i % 251);
    const suffix = mp4Marker("0123456789abcdef_provider_video");
    const stored: Uint8Array[] = [];
    const upload = {
      uploadPart: vi.fn(async (partNumber: number, value: Uint8Array) => {
        expect(value).toBeInstanceOf(Uint8Array);
        stored.push(value);
        return { partNumber, etag: `part-${partNumber}` };
      }),
      complete: vi.fn(async () => ({
        size: stored.reduce((sum, b) => sum + b.length, 0),
      })),
      abort: vi.fn(async () => undefined),
    };
    const result = await storeMediaParts(upload, stream(raw, 127), {
      partSize: 100_000,
      maxBytes: 600_000,
      expectedBytes: raw.length,
      suffix,
    });
    expect(result).toEqual({
      size: raw.length + suffix.length,
      sourceSize: raw.length,
    });
    expect(stored.slice(0, -1).every(part => part.length === 100_000)).toBe(
      true
    );
    const output = new Uint8Array(result.size);
    let offset = 0;
    for (const part of stored) {
      output.set(part, offset);
      offset += part.length;
    }
    const verified = await inspectMp4Stream(stream(output));
    expect(verified.fingerprint).toBe(
      createHash("sha256").update(raw).digest("hex")
    );
    expect(verified.marker?.token).toBe("0123456789abcdef_provider_video");
    expect(upload.abort).not.toHaveBeenCalled();
  });
  it("aborts truncated, empty and oversized downloads and cancels a failed upload's source", async () => {
    for (const input of [
      { bytes: new Uint8Array(0), max: 300, expected: undefined },
      { bytes: new Uint8Array(201), max: 300, expected: 220 },
      { bytes: new Uint8Array(201), max: 150, expected: undefined },
    ]) {
      const upload = {
        uploadPart: vi.fn(async (partNumber: number) => ({
          partNumber,
          etag: "part",
        })),
        complete: vi.fn(async () => ({ size: input.bytes.length })),
        abort: vi.fn(async () => undefined),
      };
      await expect(
        storeMediaParts(upload, stream(input.bytes), {
          partSize: 100,
          maxBytes: input.max,
          expectedBytes: input.expected,
        })
      ).rejects.toThrow();
      expect(upload.complete).not.toHaveBeenCalled();
      expect(upload.abort).toHaveBeenCalledOnce();
    }
    const cancel = vi.fn();
    const source = new ReadableStream<Uint8Array>({
      pull(c) {
        c.enqueue(new Uint8Array(50));
      },
      cancel,
    });
    const upload = {
      uploadPart: vi.fn(async () => {
        throw new TypeError("R2 failed");
      }),
      complete: vi.fn(async () => ({ size: 1 })),
      abort: vi.fn(async () => undefined),
    };
    await expect(
      storeMediaParts(upload, source, { partSize: 100, maxBytes: 1000 })
    ).rejects.toThrow("R2 failed");
    expect(cancel).toHaveBeenCalledOnce();
    expect(upload.abort).toHaveBeenCalledOnce();
  });
});
