import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  audioMixAt,
  audioMixAutomation,
  audioMixFilter,
  audioPanSample,
  normalizeAudioMix,
} from "@contracts/audio-mix";
import type { EditProject, TimelineClip } from "@contracts/workspace";
import { splitClipGroup } from "./editor-manual";

const clip: TimelineClip = {
  id: "sound",
  label: "Sound",
  track: "audio",
  color: "blue",
  locked: false,
  start: 8,
  duration: 4,
  inPoint: 10,
  outPoint: 14,
  speed: 1,
  audioMix: {
    pan: 0.5,
    gainKeys: [
      { at: 10, gain: 0.2 },
      { at: 12, gain: 1.2 },
      { at: 14, gain: 0.6 },
    ],
  },
};

describe("source-clock audio mixing", () => {
  it("holds envelope endpoints, sorts/deduplicates keys, and bounds stored values", () => {
    const mix = normalizeAudioMix({
      pan: 9,
      gainKeys: [
        { at: 12, gain: 9 },
        { at: 10, gain: -1 },
        { at: 12, gain: 0.8 },
        { at: NaN, gain: 1 },
      ],
    });
    expect(mix).toEqual({
      pan: 1,
      gainKeys: [
        { at: 10, gain: 0 },
        { at: 12, gain: 0.8 },
      ],
    });
    expect(audioMixAt({ ...clip, audioMix: mix, inPoint: 5 }, 8).envelope).toBe(
      0
    );
    expect(
      audioMixAt({ ...clip, audioMix: mix, inPoint: 15 }, 8).envelope
    ).toBe(0.8);
    expect(
      normalizeAudioMix({
        gainKeys: Array.from({ length: 80 }, (_, at) => ({ at, gain: 1 })),
      }).gainKeys
    ).toHaveLength(64);
    expect(audioMixAt({ ...clip, audioMix: undefined }, 9).gain).toBe(1);
  });

  it("preserves the source curve through real split, trim, move and speed edits", () => {
    const project = {
      duration: 16,
      clips: [clip],
      transcript: [],
    } as unknown as EditProject;
    const split = splitClipGroup(
      project,
      [clip.id],
      10,
      () => "sound-right"
    ).project;
    expect(split.clips).toHaveLength(2);
    const right = split.clips[1];
    expect(right.audioMix).toEqual(clip.audioMix);
    expect(audioMixAt(right, 11).gain).toBeCloseTo(audioMixAt(clip, 11).gain);
    const trimmed = { ...clip, inPoint: 11, outPoint: 13, duration: 2 };
    expect(audioMixAt(trimmed, 8.5).envelope).toBeCloseTo(
      audioMixAt(clip, 9.5).envelope
    );
    const moved = { ...trimmed, start: 30 };
    expect(audioMixAt(moved, 30.5).envelope).toBeCloseTo(
      audioMixAt(trimmed, 8.5).envelope
    );
    const fast = { ...trimmed, speed: 2, duration: 1 };
    expect(audioMixAt(fast, 8.25).envelope).toBeCloseTo(
      audioMixAt(trimmed, 8.5).envelope
    );
  });

  it("multiplies base/track gain and both fades, preserves legacy percent gain, and respects mute", () => {
    const fading = { ...clip, volume: 50, fadeIn: 4, fadeOut: 4 };
    expect(audioMixAt(fading, 10, 2).gain).toBeCloseTo(0.3);
    expect(
      audioMixAt(
        {
          ...clip,
          volume: 2,
          audioMix: { pan: 0, gainKeys: [{ at: 10, gain: 2 }] },
        },
        9,
        2
      ).gain
    ).toBe(8);
    expect(audioMixAt({ ...clip, muted: true }, 10).gain).toBe(0);
    expect(audioMixAt(clip, 7.9).gain).toBe(0);
    expect(audioMixAt(clip, 12).gain).toBe(0);
  });

  it("schedules envelope corners and keeps a non-fading last frame at full gain", () => {
    const keyed = {
      ...clip,
      audioMix: {
        pan: 0,
        gainKeys: [
          { at: 10, gain: 1 },
          { at: 10.035, gain: 0.1 },
          { at: 10.08, gain: 1 },
        ],
      },
    };
    const points = audioMixAutomation(keyed, 8);
    expect(
      points.find(point => Math.abs(point.after - 0.035) < 1e-9)?.gain
    ).toBeCloseTo(0.1);
    expect(
      points.every(point => point.after >= 0 && point.after <= 0.12 + 1e-9)
    ).toBe(true);
    const ending = audioMixAutomation({ ...clip, audioMix: undefined }, 11.95);
    expect(ending[ending.length - 1].gain).toBe(1);
    expect(audioMixAutomation(clip, 12)).toEqual([]);
  });
});

let nativeAudio = false;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  nativeAudio = true;
} catch {
  /* Optional native fixture. */
}
const sampleRate = 48000;
function renderPcm(c: TimelineClip, stereo: boolean, trackGain = 1) {
  const speed = c.speed ?? 1;
  const tempo =
    speed < 0.5
      ? `atempo=0.5,atempo=${speed / 0.5}`
      : speed > 2
        ? `atempo=2,atempo=${speed / 2}`
        : `atempo=${speed}`;
  const bytes = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      `aevalsrc=${stereo ? "0.2|-0.1" : "0.2"}:s=${sampleRate}:d=${c.outPoint + 0.1}:c=${stereo ? "stereo" : "mono"}`,
      "-af",
      `atrim=start=${c.inPoint}:end=${c.outPoint},asetpts=PTS-STARTPTS,${speed === 1 ? "" : `${tempo},`}${audioMixFilter(c, trackGain)}`,
      "-f",
      "f32le",
      "pipe:1",
    ],
    { maxBuffer: 8_000_000 }
  );
  return Float32Array.from({ length: bytes.length / 4 }, (_, index) =>
    bytes.readFloatLE(index * 4)
  );
}

describe.skipIf(!nativeAudio)("native FFmpeg PCM mix", () => {
  it("accepts the full 64-key curve without losing a later quiet section", () => {
    const c = {
      ...clip,
      duration: 0.64,
      inPoint: 0,
      outPoint: 0.64,
      audioMix: {
        pan: -1,
        gainKeys: Array.from({ length: 64 }, (_, index) => ({
          at: index * 0.01,
          gain: index < 60 ? 1 : 0.1,
        })),
      },
    };
    const samples = renderPcm(c, false);
    expect(samples[Math.round(0.2 * sampleRate) * 2]).toBeCloseTo(0.2, 6);
    expect(samples[Math.round(0.63 * sampleRate) * 2]).toBeCloseTo(0.02, 6);
  });
  it("matches source gain keys, fades, track gain, and mono/stereo pan sample energy", () => {
    for (const stereo of [false, true]) {
      const c = {
        ...clip,
        duration: 0.8,
        inPoint: 0.4,
        outPoint: 1.2,
        volume: 0.75,
        fadeIn: 0.1,
        fadeOut: 0.2,
        audioMix: {
          pan: 0.5,
          gainKeys: [
            { at: 0.4, gain: 0.2 },
            { at: 0.8, gain: 1.2 },
            { at: 1.2, gain: 0.6 },
          ],
        },
      };
      const samples = renderPcm(c, stereo, 1.3);
      expect(samples.length / 2).toBe(sampleRate * c.duration);
      let energyLeft = 0,
        energyRight = 0,
        expectedLeft = 0,
        expectedRight = 0;
      const panned = audioPanSample(0.2, stereo ? -0.1 : undefined, 0.5);
      for (let index = 0; index < samples.length / 2; index++) {
        const gain = audioMixAt(c, c.start + index / sampleRate, 1.3).gain;
        const left = panned[0] * gain,
          right = panned[1] * gain;
        // Check individual PCM samples as well as total channel energy.
        if (index % 137 === 0) {
          expect(samples[index * 2]).toBeCloseTo(left, 6);
          expect(samples[index * 2 + 1]).toBeCloseTo(right, 6);
        }
        energyLeft += samples[index * 2] ** 2;
        energyRight += samples[index * 2 + 1] ** 2;
        expectedLeft += left ** 2;
        expectedRight += right ** 2;
      }
      expect(energyLeft / expectedLeft).toBeCloseTo(1, 6);
      expect(energyRight / expectedRight).toBeCloseTo(1, 6);
      if (!stereo)
        expect(energyRight / energyLeft).toBeCloseTo(3 + 2 * Math.SQRT2, 6);
    }
  });

  it("renders a speed-adjusted trim with the same original-source envelope", () => {
    const c = {
      ...clip,
      duration: 0.5,
      inPoint: 0.5,
      outPoint: 1.5,
      speed: 2,
      audioMix: {
        pan: -1,
        gainKeys: [
          { at: 0, gain: 0 },
          { at: 2, gain: 2 },
        ],
      },
    };
    const samples = renderPcm(c, false);
    const unmodulated = renderPcm(
      { ...c, audioMix: { pan: -1, gainKeys: [] } },
      false
    );
    // atempo may shorten its edge; interior samples still use source = .5 + t*2.
    expect(samples.length / 2).toBeGreaterThan(sampleRate * 0.4);
    for (const at of [0.05, 0.15, 0.3]) {
      const index = Math.round(at * sampleRate);
      expect(samples[index * 2]).toBeCloseTo(
        unmodulated[index * 2] * (0.5 + at * 2),
        6
      );
      expect(samples[index * 2 + 1]).toBe(0);
    }
  });
});
