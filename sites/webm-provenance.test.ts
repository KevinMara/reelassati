import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ebmlSize,
  embedMediaProvenanceMarker,
  inspectMediaProvenanceMarker,
  readWebmSegmentHeader,
  webmMarker,
} from "./media-provenance";
import { inspectWebmStream, markWebmStream } from "./media-streams";

const token = "0123456789abcdef_verified_webm";
function stream(bytes: Uint8Array, chunk = 7) {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset === bytes.length) return controller.close();
      controller.enqueue(bytes.subarray(offset, offset + chunk));
      offset = Math.min(bytes.length, offset + chunk);
    },
  });
}
const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
function fixture(unknown = false) {
  // A WebM-shaped container for malformed-boundary tests; native media below
  // independently checks actual codec playback and public demuxer metadata.
  const header = new Uint8Array([
    0x1a, 0x45, 0xdf, 0xa3, 0x87, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d,
  ]);
  const payload = new Uint8Array([0xec, 0x84, 1, 2, 3, 4]);
  const bytes = new Uint8Array(header.length + 12 + payload.length);
  bytes.set(header);
  bytes.set([0x18, 0x53, 0x80, 0x67], header.length);
  bytes.set(
    unknown
      ? new Uint8Array([1, 255, 255, 255, 255, 255, 255, 255])
      : ebmlSize(payload.length, 8),
    header.length + 4
  );
  bytes.set(payload, header.length + 12);
  return bytes;
}

describe("WebM provenance boundaries", () => {
  for (const unknown of [false, true]) {
    it(`recovers the exact signed upload hash with ${unknown ? "unknown" : "finite"} Segment size and one-byte chunks`, async () => {
      const raw = fixture(unknown);
      const marked = new Uint8Array(
        await new Response(
          markWebmStream(stream(raw, 1), raw.length, token)
        ).arrayBuffer()
      );
      expect(
        (await inspectWebmStream(stream(raw), raw.length)).fingerprint
      ).toBe(sha(raw));
      const verified = await inspectWebmStream(
        stream(marked, 1),
        marked.length,
        token
      );
      expect(verified.fingerprint).toBe(sha(raw));
      expect(verified.marker?.token).toBe(token);
      const inspected = inspectMediaProvenanceMarker(marked.buffer);
      expect(inspected?.method).toBe("webm-simple-tag");
      expect(new Uint8Array(inspected!.unmarkedBytes)).toEqual(raw);
      expect(
        embedMediaProvenanceMarker(marked.buffer, "video/webm", token)?.bytes
      ).toEqual(marked.buffer);
      expect(
        embedMediaProvenanceMarker(
          marked.buffer,
          "video/webm",
          "different_0123456789abcdef"
        )
      ).toBeNull();
    });
  }

  it("rejects false MIME, truncated media, mismatched finite sizes and a private marker hidden inside another element", async () => {
    const raw = fixture();
    const wrongDocType = raw.slice();
    wrongDocType[8] = 0x6d;
    await expect(
      inspectWebmStream(stream(wrongDocType), wrongDocType.length)
    ).rejects.toThrow("document type");
    expect(
      embedMediaProvenanceMarker(
        new Uint8Array([1, 2, 3]).buffer,
        "video/webm",
        token
      )
    ).toBeNull();
    await expect(
      inspectWebmStream(stream(raw.slice(0, -1)), raw.length - 1)
    ).rejects.toThrow();
    await expect(
      inspectWebmStream(stream(raw), raw.length + 1)
    ).rejects.toThrow();
    const hidden = webmMarker(token);
    const segment = readWebmSegmentHeader(raw)!;
    const bytes = new Uint8Array(
      segment.dataOffset + 1 + ebmlSize(hidden.length).length + hidden.length
    );
    bytes.set(raw.subarray(0, segment.dataOffset));
    bytes.set(
      ebmlSize(bytes.length - segment.dataOffset, segment.sizeLength),
      segment.sizeOffset
    );
    bytes[segment.dataOffset] = 0xec;
    bytes.set(ebmlSize(hidden.length), segment.dataOffset + 1);
    bytes.set(hidden, segment.dataOffset + 1 + ebmlSize(hidden.length).length);
    expect(
      (await inspectWebmStream(stream(bytes), bytes.length, token)).marker
    ).toBeNull();
    expect(inspectMediaProvenanceMarker(bytes.buffer)).toBeNull();
  });

  it("does not authenticate stripped marks or changed tokens/bytes under an old fingerprint", async () => {
    const raw = fixture();
    const marked = new Uint8Array(
      await new Response(
        markWebmStream(stream(raw), raw.length, token)
      ).arrayBuffer()
    );
    await expect(
      inspectWebmStream(stream(raw), raw.length, token)
    ).rejects.toThrow();
    const changedBytes = marked.slice();
    changedBytes[readWebmSegmentHeader(changedBytes)!.dataOffset + 2] ^= 1;
    expect(
      (
        await inspectWebmStream(
          stream(changedBytes),
          changedBytes.length,
          token
        )
      ).fingerprint
    ).not.toBe(sha(raw));
    const changedToken = marked.slice();
    changedToken[changedToken.length - 1] ^= 1;
    expect(
      (
        await inspectWebmStream(
          stream(changedToken),
          changedToken.length,
          token
        )
      ).marker?.token
    ).not.toBe(token);
    const appended = new Uint8Array(marked.length + 1);
    appended.set(marked);
    await expect(
      inspectWebmStream(stream(appended), appended.length, token)
    ).rejects.toThrow();
  });
});

let nativeAvailable = false;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  nativeAvailable = true;
} catch {
  /* Optional native renderer. */
}
it.skipIf(!nativeAvailable)(
  "preserves actual VP8/Opus playback, cues, benign tags, and signed hash for finite and unknown Segments",
  async () => {
    const directory = mkdtempSync(
      join(tmpdir(), "reelassati-webm-provenance-")
    );
    try {
      const input = join(directory, "input.webm");
      execFileSync("ffmpeg", [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=red:s=64x64:r=12:d=1",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:sample_rate=48000:duration=1",
        "-c:v",
        "libvpx",
        "-threads",
        "1",
        "-deadline",
        "realtime",
        "-cpu-used",
        "8",
        "-b:v",
        "100k",
        "-c:a",
        "libopus",
        "-metadata",
        "title=Customer title",
        "-y",
        input,
      ]);
      const source = new Uint8Array(readFileSync(input));
      for (const unknown of [false, true]) {
        const raw = source.slice();
        const segment = readWebmSegmentHeader(raw)!;
        expect(segment.sizeLength).toBe(8);
        if (unknown)
          raw.set([1, 255, 255, 255, 255, 255, 255, 255], segment.sizeOffset);
        const marked = new Uint8Array(
          await new Response(
            markWebmStream(stream(raw, 13), raw.length, token)
          ).arrayBuffer()
        );
        const output = join(directory, `marked-${unknown}.webm`);
        writeFileSync(output, marked);
        const probe = JSON.parse(
          execFileSync(
            "ffprobe",
            [
              "-v",
              "error",
              "-show_format",
              "-show_streams",
              "-of",
              "json",
              output,
            ],
            { encoding: "utf8" }
          )
        );
        expect(probe.format.format_name).toBe("matroska,webm");
        expect(
          probe.streams.map((s: { codec_name: string }) => s.codec_name)
        ).toEqual(["vp8", "opus"]);
        expect(probe.format.tags.title).toBe("Customer title");
        // FFmpeg only exposes indexed header tags during probing. The extra
        // standards-compliant global Tags at EOF is read by our EBML inspector;
        // existing SeekHead/Cues offsets and the customer's header tags stay intact.
        expect(inspectMediaProvenanceMarker(marked.buffer)?.token).toBe(token);
        expect(Number(probe.format.duration)).toBeCloseTo(1, 1);
        execFileSync(
          "ffmpeg",
          ["-v", "error", "-i", output, "-f", "null", "-"],
          { stdio: "pipe" }
        );
        const decodedOriginal = execFileSync("ffmpeg", [
          "-v",
          "error",
          "-i",
          input,
          "-map",
          "0:v",
          "-f",
          "framemd5",
          "-",
        ]);
        const decodedMarked = execFileSync("ffmpeg", [
          "-v",
          "error",
          "-i",
          output,
          "-map",
          "0:v",
          "-f",
          "framemd5",
          "-",
        ]);
        expect(decodedMarked).toEqual(decodedOriginal);
        const verified = await inspectWebmStream(
          stream(marked, 3),
          marked.length,
          token
        );
        expect(verified.marker?.token).toBe(token);
        expect(verified.fingerprint).toBe(sha(raw));
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
  15000
);
