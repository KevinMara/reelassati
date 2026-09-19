import { expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MusicGenerationError,
  finishMusicWave,
  finishMusicAudio,
  musicQuote,
  readMusicAudio,
} from "./music-generation";
import {
  embedMediaProvenanceMarker,
  inspectMediaProvenanceMarker,
} from "./media-provenance";

function wave(seconds = 4) {
  const size = seconds * 48000 * 4;
  const bytes = new Uint8Array(44 + size),
    view = new DataView(bytes.buffer);
  const text = (at: number, s: string) =>
    bytes.set(new TextEncoder().encode(s), at);
  text(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, 48000, true);
  view.setUint32(28, 192000, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, size, true);
  for (let i = 44; i < bytes.length; i += 2) view.setInt16(i, 12000, true);
  return bytes.buffer;
}
it("quotes the full music generation, even when the requested excerpt is shorter", () => {
  expect(musicQuote(3)).toBe(15);
  expect(musicQuote(30)).toBe(15);
  for (const value of [0, 31, NaN, Infinity])
    expect(() => musicQuote(value)).toThrow();
});
it("reports malformed, corrupted, and empty provider output without leaking response contents", async () => {
  for (const data of [
    "data: not-json\n",
    "data: null\n",
    'data: {"choices":{}}\n',
    'data: {"choices":[{"delta":{"audio":{"data":"%broken"}}}]}\n',
    "data: [DONE]\n",
  ]) {
    await expect(readMusicAudio(new Response(data))).rejects.toBeInstanceOf(
      MusicGenerationError
    );
  }
});
it("reads audio SSE split across network chunks and rejects incomplete/provider-failed streams", async () => {
  const a = btoa("RIFF"),
    b = btoa("data");
  const text = `data: ${JSON.stringify({ choices: [{ delta: { audio: { data: a } } }] })}\r\n\r\ndata: ${JSON.stringify({ choices: [{ delta: { audio: { data: b } } }] })}\n\ndata: [DONE]\n`;
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < text.length; i += 7)
        controller.enqueue(new TextEncoder().encode(text.slice(i, i + 7)));
      controller.close();
    },
  });
  expect(
    new TextDecoder().decode(await readMusicAudio(new Response(stream)))
  ).toBe("RIFFdata");
  await expect(
    readMusicAudio(new Response(text.replace("data: [DONE]", "")))
  ).rejects.toThrow("incomplete");
  await expect(
    readMusicAudio(new Response('data: {"error":{"message":"failed"}}\n'))
  ).rejects.toThrow("provider");
});
it("keeps native sample rate and channels, trims precisely, fades the ending, and round-trips provenance", () => {
  const before = wave();
  const after = finishMusicWave(before, 3);
  const view = new DataView(after);
  expect(after.byteLength).toBe(44 + 3 * 192000);
  expect(view.getUint32(24, true)).toBe(48000);
  expect(view.getUint16(22, true)).toBe(2);
  expect(view.getInt16(after.byteLength - 2, true)).toBe(0);
  expect(new DataView(before).getInt16(before.byteLength - 2, true)).toBe(
    12000
  );
  const marked = embedMediaProvenanceMarker(
    after,
    "audio/wav",
    "test_music_token_123456789"
  )!;
  expect(marked.method).toBe("wav-provenance-chunk");
  const inspected = inspectMediaProvenanceMarker(marked.bytes)!;
  expect(inspected.unmarkedBytes).toEqual(after);
  expect(inspected.token).toBe("test_music_token_123456789");
  expect(
    embedMediaProvenanceMarker(
      marked.bytes,
      "audio/wav",
      "different_valid_token_12345"
    )
  ).toBeNull();
});
it("rejects too-short, invalid, or truncated music rather than saving an unusable asset", () => {
  expect(() => finishMusicWave(wave(), 5)).toThrow("shorter");
  expect(() => finishMusicWave(new ArrayBuffer(50), 3)).toThrow("WAV");
  expect(() => finishMusicWave(wave().slice(0, 60), 3)).toThrow("truncated");
});

function mp3Fixture(kind: "vbr" | "cbr") {
  return new Uint8Array(
    readFileSync(
      new URL(`./__fixtures__/music-mp3-${kind}.mp3`, import.meta.url)
    )
  ).buffer;
}

function vbriFixture() {
  // Preserve the actual encoded 48 kHz CBR audio, adding a standard metadata
  // frame. The fixed fixture has a 45-byte ID3 header and 384-byte MPEG frames.
  const source = new Uint8Array(mp3Fixture("cbr"));
  const id3Length = 45,
    frameSize = 384,
    audioFrames = (source.length - id3Length) / frameSize,
    perEntry = 16,
    entries = Math.ceil(audioFrames / perEntry);
  const bytes = new Uint8Array(source.length + frameSize);
  bytes.set(source.subarray(0, id3Length));
  bytes.set(source.subarray(id3Length, id3Length + 4), id3Length);
  bytes.set(source.subarray(id3Length), id3Length + frameSize);
  const at = id3Length + 36,
    view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("VBRI"), at);
  view.setUint16(at + 4, 1);
  view.setUint32(at + 10, bytes.length - id3Length);
  view.setUint32(at + 14, audioFrames);
  view.setUint16(at + 18, entries);
  view.setUint16(at + 20, 1);
  view.setUint16(at + 22, 2);
  view.setUint16(at + 24, perEntry);
  for (let index = 0; index < entries; index++)
    view.setUint16(
      at + 26 + index * 2,
      (Math.min(perEntry, audioFrames - index * perEntry) +
        (index === 0 ? 1 : 0)) *
        frameSize
    );
  return bytes.buffer;
}

it("accepts actual MP3 with variable bitrate, trims without re-encoding, and updates gapless and seek metadata", () => {
  const source = mp3Fixture("vbr");
  const before = new Uint8Array(source).slice();
  const finished = finishMusicAudio(source, 3);
  expect(finished.contentType).toBe("audio/mpeg");
  expect(finished.extension).toBe("mp3");
  expect(finished.duration).toBe(3);
  expect(finished.bytes.byteLength).toBeLessThan(source.byteLength);
  expect(new Uint8Array(source)).toEqual(before);
  expect(new TextDecoder().decode(new Uint8Array(finished.bytes, 0, 3))).toBe(
    "ID3"
  );
  // Trimming an already precise three-second asset must preserve that duration.
  expect(finishMusicAudio(finished.bytes, 3).duration).toBe(3);
  const marked = embedMediaProvenanceMarker(
    finished.bytes,
    finished.contentType,
    "music_mp3_token_123456789"
  )!;
  expect(marked.method).toBe("mp3-id3v2-private-frame");
  expect(inspectMediaProvenanceMarker(marked.bytes)?.unmarkedBytes).toEqual(
    finished.bytes
  );
});

it("handles native CBR without an index, retains complete frames, and limits duration rounding to one frame", () => {
  const source = mp3Fixture("cbr");
  const finished = finishMusicAudio(source, 3);
  expect(finished.contentType).toBe("audio/mpeg");
  expect(finished.duration).toBeGreaterThanOrEqual(3);
  expect(finished.duration - 3).toBeLessThan(1152 / 48000);
  // No compressed audio frame is rewritten when there is no seek metadata.
  expect(new Uint8Array(finished.bytes)).toEqual(
    new Uint8Array(source).slice(0, finished.bytes.byteLength)
  );
});

it("rewrites Fraunhofer VBRI counts and seek entries to cover only retained audio", () => {
  const source = vbriFixture();
  const finished = finishMusicAudio(source, 3.01);
  const view = new DataView(finished.bytes),
    at = 45 + 36;
  expect(finished.duration).toBe(3.024);
  expect(view.getUint32(at + 10)).toBe(finished.bytes.byteLength - 45);
  expect(view.getUint32(at + 14)).toBe(126);
  expect(view.getUint16(at + 18)).toBe(8);
  // Seek spans include the header once and the final partial span exactly.
  let indexedBytes = 0;
  for (let index = 0; index < 8; index++)
    indexedBytes += view.getUint16(at + 26 + index * 2);
  expect(indexedBytes).toBe(finished.bytes.byteLength - 45);
  expect(view.getUint16(at + 26 + 8 * 2)).toBe(0);
  expect(finishMusicAudio(finished.bytes, 3.01).duration).toBe(3.024);
  // Header rewriting must never touch compressed audio payloads.
  expect(new Uint8Array(finished.bytes).subarray(45 + 384)).toEqual(
    new Uint8Array(source).subarray(45 + 384, finished.bytes.byteLength)
  );
});

it("rejects malformed VBRI table geometry and unsupported versions with safe errors", () => {
  for (const [offset, value] of [
    [4, 2],
    [18, 65535],
    [20, 0],
    [22, 5],
    [24, 0],
  ]) {
    const source = vbriFixture();
    new DataView(source).setUint16(45 + 36 + offset, value);
    expect(() => finishMusicAudio(source, 3)).toThrow(MusicGenerationError);
  }
});

let hasNativeFfmpeg = true;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
} catch {
  hasNativeFfmpeg = false;
}
it.skipIf(!hasNativeFfmpeg)(
  "native decoders accept trimmed Xing, CBR, and VBRI audio with the reported playable duration",
  () => {
    const directory = mkdtempSync(join(tmpdir(), "reelassati-music-"));
    try {
      for (const source of [
        mp3Fixture("vbr"),
        mp3Fixture("cbr"),
        vbriFixture(),
      ]) {
        for (const seconds of [3.01, 3.5]) {
          const finished = finishMusicAudio(source, seconds),
            input = join(directory, "trimmed.mp3");
          // A seekable file lets FFmpeg honor tail gapless padding, as a saved
          // library asset does; stdin streaming cannot inspect the final packet.
          writeFileSync(input, new Uint8Array(finished.bytes));
          const pcm = execFileSync(
            "ffmpeg",
            [
              "-v",
              "error",
              "-i",
              input,
              "-f",
              "s16le",
              "-ac",
              "2",
              "-ar",
              "48000",
              "pipe:1",
            ],
            { maxBuffer: 2 * 1024 * 1024 }
          );
          expect(
            Math.abs(pcm.length / (48000 * 4) - finished.duration)
          ).toBeLessThan(1 / 48000);
        }
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
);

it("rejects truncated MP3 frames, invalid tags, non-audio and insufficient duration", () => {
  const source = mp3Fixture("vbr");
  expect(() => finishMusicAudio(source.slice(0, -3), 3)).toThrow("MP3");
  expect(() => finishMusicAudio(source, 5)).toThrow("shorter");
  const invalidTag = new Uint8Array(source.slice(0));
  invalidTag[6] = 255;
  expect(() => finishMusicAudio(invalidTag.buffer, 3)).toThrow("MP3");
  expect(() =>
    finishMusicAudio(new TextEncoder().encode('{"error":"upstream"}').buffer, 3)
  ).toThrow("supported WAV or MP3");
  const wav = finishMusicAudio(wave(), 3);
  expect(wav.contentType).toBe("audio/wav");
  expect(wav.duration).toBe(3);
});

it("accepts complete JSON audio and rejects malformed choice objects as typed failures", async () => {
  const response = new Response(
    JSON.stringify({
      choices: [{ message: { audio: { data: btoa("native-audio") } } }],
    }),
    { headers: { "Content-Type": "application/json" } }
  );
  expect(new TextDecoder().decode(await readMusicAudio(response))).toBe(
    "native-audio"
  );
  await expect(
    readMusicAudio(new Response('data: {"choices":[null]}\n\n'))
  ).rejects.toBeInstanceOf(MusicGenerationError);
});

it("handles multiline SSE and stops at DONE without waiting for the upstream connection to close", async () => {
  let canceled = false;
  const event = `data: {"choices":[\ndata: {"index":0,"delta":{"audio":{"data":"${btoa("first song")}"}}},\ndata: {"index":1,"delta":{"audio":{"data":"${btoa("different song")}"}}}]}\n\ndata: [DONE]\n\n`;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(event));
    },
    cancel() {
      canceled = true;
    },
  });
  expect(
    new TextDecoder().decode(await readMusicAudio(new Response(stream)))
  ).toBe("first song");
  expect(canceled).toBe(true);
});

it("turns interrupted transport reads into a safe music error without returning incomplete audio", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.error(new Error("private upstream diagnostic"));
    },
  });
  await expect(readMusicAudio(new Response(stream))).rejects.toThrow(
    "music stream was interrupted"
  );
});
