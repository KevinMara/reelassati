import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import {
  pcmWaveform,
  sourceTimeAtClipFraction,
  waveformColumns,
  TimelineMediaCache,
  timelineWaveform,
} from "./timeline-media";
import type { Asset } from "@contracts/workspace";

describe("actual timeline media samples", () => {
  it("maps a trimmed sped-up clip onto its original source clock", () => {
    const clip = { inPoint: 10, duration: 4, speed: 2 };
    expect(sourceTimeAtClipFraction(clip, 0)).toBe(10);
    expect(sourceTimeAtClipFraction(clip, 0.5)).toBe(14);
    expect(sourceTimeAtClipFraction(clip, 1)).toBe(18);
    const waveform = {
      duration: 4,
      peaks: Float32Array.of(0.1, 0.2, 0.3, 0.4),
    };
    expect(
      Array.from(
        waveformColumns(
          waveform,
          { inPoint: 1, duration: 1, speed: 2 },
          0,
          1,
          2
        )
      )
    ).toEqual([expect.closeTo(0.2), expect.closeTo(0.3)]);
    expect(
      Array.from(
        waveformColumns(
          waveform,
          { inPoint: 3, duration: 2, speed: 1 },
          0,
          1,
          2
        )
      )
    ).toEqual([expect.closeTo(0.4), 0]);
  });

  it("preserves silence, an isolated transient and opposite-phase stereo", () => {
    const left = new Float32Array(8000),
      right = new Float32Array(8000);
    left[1200] = 0.25;
    right[1200] = -0.25;
    right[6000] = -0.8;
    const wave = pcmWaveform([left, right], 8000);
    expect(wave.duration).toBe(1);
    expect(wave.peaks).toHaveLength(60);
    expect(wave.peaks[0]).toBe(0);
    expect(wave.peaks[9]).toBeCloseTo(0.25);
    expect(wave.peaks[45]).toBeCloseTo(0.8);
    expect(wave.peaks[59]).toBe(0);
  });

  it("refuses oversized or unmeasured sources before downloading", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const source = {
      id: "oversized",
      size: 20 * 1024 * 1024,
      duration: 10,
      createdAt: "now",
      url: "https://example.test/large.wav",
    } as Asset;
    await expect(
      timelineWaveform(source, new AbortController().signal)
    ).rejects.toThrow("size limit");
    await expect(
      timelineWaveform(
        { ...source, id: "unmeasured", size: 100, duration: undefined },
        new AbortController().signal
      )
    ).rejects.toThrow("measured audio");
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });
});

describe("shared cancellable media cache", () => {
  it("shares one job and keeps it alive while another visible clip still needs it", async () => {
    const cache = new TimelineMediaCache<number>(() => 4);
    let complete: ((value: number) => void) | undefined;
    let jobSignal: AbortSignal | undefined;
    const producer = vi.fn((signal: AbortSignal) => {
      jobSignal = signal;
      return new Promise<number>(resolve => {
        complete = resolve;
      });
    });
    const first = new AbortController(),
      second = new AbortController();
    const a = cache.get("owner-asset", producer, first.signal);
    const b = cache.get("owner-asset", producer, second.signal);
    await Promise.resolve();
    expect(producer).toHaveBeenCalledTimes(1);
    const rejected = expect(a).rejects.toMatchObject({ name: "AbortError" });
    first.abort();
    await rejected;
    expect(jobSignal!.aborted).toBe(false);
    complete!(17);
    expect(await b).toBe(17);
    expect(
      await cache.get("owner-asset", producer, new AbortController().signal)
    ).toBe(17);
    expect(producer).toHaveBeenCalledTimes(1);
  });

  it("aborts abandoned work and evicts stale results within the byte budget", async () => {
    const cache = new TimelineMediaCache<number>(() => 4, 10, 4);
    let signal: AbortSignal | undefined;
    const cancel = new AbortController();
    const pending = cache.get(
      "cancel",
      observed => {
        signal = observed;
        return new Promise<number>((_resolve, reject) =>
          observed.addEventListener(
            "abort",
            () => reject(new DOMException("Cancelled", "AbortError")),
            { once: true }
          )
        );
      },
      cancel.signal
    );
    await Promise.resolve();
    const rejected = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    cancel.abort();
    await rejected;
    expect(signal!.aborted).toBe(true);
    const first = vi.fn(async () => 1),
      second = vi.fn(async () => 2);
    await cache.get("first", first, new AbortController().signal);
    await cache.get("second", second, new AbortController().signal);
    await cache.get("first", first, new AbortController().signal);
    expect(first).toHaveBeenCalledTimes(2);
  });

  it("retries cached failures after their cooldown and never starts an already-cancelled request", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(0);
    try {
      const cache = new TimelineMediaCache<number>(() => 4);
      const produce = vi.fn(async () => {
        throw new Error("Unsupported source");
      });
      await expect(
        cache.get("failed", produce, new AbortController().signal)
      ).rejects.toThrow("Unsupported");
      await expect(
        cache.get("failed", produce, new AbortController().signal)
      ).rejects.toThrow("Unsupported");
      expect(produce).toHaveBeenCalledTimes(1);
      now.mockReturnValue(61_000);
      await expect(
        cache.get("failed", produce, new AbortController().signal)
      ).rejects.toThrow("Unsupported");
      expect(produce).toHaveBeenCalledTimes(2);
      const abort = new AbortController();
      abort.abort();
      await expect(
        cache.get("cancelled", produce, abort.signal)
      ).rejects.toMatchObject({ name: "AbortError" });
      expect(produce).toHaveBeenCalledTimes(2);
    } finally {
      now.mockRestore();
    }
  });
});

let ffmpegAvailable = false;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  ffmpegAvailable = true;
} catch {
  /* Optional native fixture validation, never represented as browser QA. */
}

it.skipIf(!ffmpegAvailable)(
  "measures a real decoded WAV fixture without normalizing its amplitude",
  () => {
    const sampleRate = 8000,
      length = sampleRate * 2;
    const pcm = Buffer.alloc(length * 4);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const gain = t < 0.5 ? 0 : t < 1 ? 0.25 : t < 1.5 ? 0.75 : 0;
      const sample = Math.round(Math.sin(2 * Math.PI * 200 * t) * gain * 32767);
      pcm.writeInt16LE(sample, i * 4);
      pcm.writeInt16LE(-sample, i * 4 + 2);
    }
    const wav = execFileSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-f",
        "s16le",
        "-ar",
        String(sampleRate),
        "-ac",
        "2",
        "-i",
        "pipe:0",
        "-f",
        "wav",
        "pipe:1",
      ],
      { input: pcm }
    );
    const decoded = execFileSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-i",
        "pipe:0",
        "-f",
        "f32le",
        "-ar",
        String(sampleRate),
        "-ac",
        "2",
        "pipe:1",
      ],
      { input: wav }
    );
    const channels = [new Float32Array(length), new Float32Array(length)];
    for (let i = 0; i < length; i++) {
      channels[0][i] = decoded.readFloatLE(i * 8);
      channels[1][i] = decoded.readFloatLE(i * 8 + 4);
    }
    const waveform = pcmWaveform(channels, sampleRate);
    const columns = waveformColumns(
      waveform,
      { inPoint: 0, duration: 2, speed: 1 },
      0,
      1,
      4
    );
    expect(Array.from(columns)).toEqual([
      0,
      expect.closeTo(0.25, 3),
      expect.closeTo(0.75, 3),
      0,
    ]);
  }
);
