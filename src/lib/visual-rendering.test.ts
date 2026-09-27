import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  normalizeVisual,
  visualFrame,
  patchVisual,
} from "@contracts/clip-visual";
import type { TimelineClip } from "@contracts/workspace";
import { preserveGraphicDuration } from "./timeline-lanes";
import { visualRenderFilter } from "./visual-rendering";

const clip = {
  id: "shot",
  start: 0,
  duration: 2,
  inPoint: 0,
  outPoint: 2,
  speed: 1,
  visual: normalizeVisual(),
} as TimelineClip;
function pixel(c: TimelineClip, time: number, x: number, y: number) {
  const output = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-filter_complex_threads",
      "1",
      "-f",
      "lavfi",
      "-i",
      "color=red:s=80x80:r=10:d=2,format=rgba",
      "-vf",
      `${visualRenderFilter(c)},select='eq(n,${Math.round(time * 10)})',format=rgba`,
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "pipe:1",
    ],
    { maxBuffer: 4_000_000 }
  );
  return [...output.subarray((y * 80 + x) * 4, (y * 80 + x) * 4 + 4)];
}
describe("footage transforms and visual transitions", () => {
  it("preserves source animation across trims, splits and speed changes", () => {
    const original = preserveGraphicDuration({
      ...clip,
      inPoint: 10,
      outPoint: 14,
      duration: 4,
      visual: normalizeVisual({
        keyframes: [
          { at: 0, x: -20, scale: 1 },
          { at: 1, x: 20, scale: 2 },
        ],
      }),
    });
    const right = { ...original, start: 2, inPoint: 12, duration: 2 };
    expect(visualFrame(original, 3).x).toBeCloseTo(visualFrame(right, 3).x);
    expect(
      visualFrame({ ...right, speed: 2, duration: 1 }, 2.5).scale
    ).toBeCloseTo(visualFrame(original, 3).scale);
  });
  it("renders transparent transformed edges and preserves scale animation bounds", () => {
    const c = {
      ...clip,
      visual: normalizeVisual({
        keyframes: [
          { at: 0, scale: 0.5 },
          { at: 1, scale: 1.5 },
        ],
        opacity: 0.8,
      }),
    };
    expect(pixel(c, 0, 1, 40)[3]).toBe(0);
    expect(pixel(c, 1.8, 1, 40)[3]).toBeGreaterThan(190);
    expect(pixel(c, 0, 40, 40)[0]).toBeGreaterThan(245);
  });
  it("flips and rotates without losing boundary pixels", () => {
    for (const patch of [{ flipX: true }, { flipY: true }, { rotation: 180 }]) {
      const transformed = { ...clip, visual: normalizeVisual(patch) };
      expect(pixel(transformed, 0, 0, 0)[3]).toBe(255);
      expect(pixel(transformed, 0, 79, 79)[3]).toBe(255);
    }
  });
  it("applies new transitions to a trimmed clip without restarting pose animation", () => {
    const original = {
      ...clip,
      visualStart: 0,
      visualDuration: 10,
      inPoint: 2,
      outPoint: 4,
      visual: normalizeVisual({
        keyframes: [
          { at: 0, x: 0 },
          { at: 1, x: 50 },
        ],
      }),
    };
    const updated = {
      ...original,
      visual: patchVisual(original, {
        entrance: { kind: "dissolve", duration: 0.5 },
      }),
    };
    expect(visualFrame(updated, 0).opacity).toBe(0);
    expect(visualFrame(updated, 0.5).opacity).toBe(1);
    expect(visualFrame(updated, 0).x).toBe(visualFrame(original, 0).x);
    expect(pixel(updated, 0, 40, 40)[3]).toBe(0);
    expect(pixel(updated, 0.5, 40, 40)[3]).toBe(255);
  });
  it("updates animated AI pose and merges crop edges without silently ignoring changes", () => {
    const original = {
      ...clip,
      visual: normalizeVisual({
        crop: { top: 5, right: 7 },
        keyframes: [
          { at: 0, x: 0 },
          { at: 1, x: 10 },
        ],
      }),
    };
    const updated = patchVisual(original, {
      x: 20,
      crop: { left: 10 } as never,
    });
    expect(updated.keyframes.map(k => k.x)).toEqual([20, 30]);
    expect(updated.crop).toEqual({ top: 5, right: 7, bottom: 0, left: 10 });
  });
  it("masks the picture while leaving audio untouched", () => {
    const c = {
      ...clip,
      visual: normalizeVisual({ mask: "ellipse", opacity: 0.5 }),
    };
    expect(pixel(c, 0, 0, 0)[3]).toBe(0);
    expect(pixel(c, 0, 40, 40)[3]).toBeCloseTo(127, 0);
    expect(c).not.toHaveProperty("volume");
  });
  it("matches wipe timing between exported pixels and preview", () => {
    const c = {
      ...clip,
      visual: normalizeVisual({ entrance: { kind: "wipe-left", duration: 1 } }),
    };
    expect(visualFrame(c, 0.5).reveal.right).toBe(50);
    expect(pixel(c, 0.5, 20, 40)[3]).toBe(255);
    expect(pixel(c, 0.5, 60, 40)[3]).toBe(0);
  });
});
