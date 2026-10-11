import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  soundEffectCredits,
  soundEffectPrompt,
  soundEffectQuote,
} from "../contracts/audio-generation";
import {
  finishSoundEffectAudio,
  readSoundEffectAudio,
} from "./music-generation";

const fixture = (kind: "vbr" | "cbr") =>
  new Uint8Array(
    readFileSync(
      new URL(`./__fixtures__/music-mp3-${kind}.mp3`, import.meta.url)
    )
  ).buffer;

it("prices actual provider seconds with the agreed allowance and reserves the global maximum", () => {
  expect(soundEffectCredits(5)).toBe(7);
  expect(soundEffectCredits(30)).toBe(38);
  expect(soundEffectCredits(120)).toBe(150);
  expect(soundEffectQuote(0.5)).toBe(150);
  expect(soundEffectQuote(30)).toBe(150);
  for (const invalid of [0, -1, 30.1, NaN, Infinity])
    expect(() => soundEffectQuote(invalid)).toThrow();
  for (const invalid of [0, 120.1, NaN, Infinity])
    expect(() => soundEffectCredits(invalid)).toThrow();
  expect(soundEffectPrompt("x".repeat(2700), 30).length).toBeLessThanOrEqual(
    3000
  );
  expect(() => soundEffectPrompt("x".repeat(2701), 5)).toThrow("2,700");
});

it.each(["vbr", "cbr"] as const)(
  "measures the complete native %s take before trimming, and accepts a shorter one-shot",
  kind => {
    const source = fixture(kind);
    const short = finishSoundEffectAudio(source, 0.5);
    const full = finishSoundEffectAudio(source, 30);
    expect(short.duration).toBeGreaterThanOrEqual(0.5);
    expect(short.duration).toBeLessThan(0.54);
    expect(short.providerDuration).toBeGreaterThan(3);
    expect(short.providerDuration).toBe(full.providerDuration);
    expect(full.duration).toBeLessThan(30);
    expect(soundEffectCredits(short.providerDuration)).toBe(
      soundEffectCredits(full.providerDuration)
    );
    expect(short.bytes.byteLength).toBeLessThan(source.byteLength);
  }
);

it("rejects damaged, non-MP3, and over-cap output instead of billing an arbitrary excerpt", () => {
  for (const data of [
    new ArrayBuffer(0),
    new ArrayBuffer(100),
    fixture("vbr").slice(0, 100),
  ])
    expect(() => finishSoundEffectAudio(data, 5)).toThrow();
  const source = new Uint8Array(fixture("cbr"));
  // Real contiguous 48kHz frames; ID3 header omitted so this is a valid long stream.
  const frames = source.subarray(45);
  const long = new Uint8Array(frames.length * 40);
  for (let i = 0; i < 40; i++) long.set(frames, i * frames.length);
  expect(() => finishSoundEffectAudio(long.buffer, 1)).toThrow();
});

it("bounds raw audio even when Content-Length is absent and cancels oversized streams", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(16 * 1024 * 1024 + 1));
    },
    cancel() {
      cancelled = true;
    },
  });
  await expect(
    readSoundEffectAudio(
      new Response(body, { headers: { "Content-Type": "audio/mpeg" } })
    )
  ).rejects.toThrow("size limit");
  expect(cancelled).toBe(true);
  await expect(
    readSoundEffectAudio(Response.json({ error: "private" }))
  ).rejects.toThrow("unsupported");
  const bytes = fixture("vbr");
  expect(
    await readSoundEffectAudio(
      new Response(bytes, { headers: { "Content-Type": "audio/mpeg" } })
    )
  ).toEqual(bytes);
});
