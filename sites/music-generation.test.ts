import { expect, it } from "vitest";
import {
  finishMusicWave,
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
