import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  hashMediaStream,
  inspectMp4Stream,
  mediaParts,
  mp4Marker,
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
});
