import { describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
const zoomCanvas = { width: 160, height: 90 };
const zoomClip = (easing = "ease-in-out"): TimelineClip => ({
  ...clip,
  visual: normalizeVisual({
    keyframes: [
      { at: 0, scale: 1, easing },
      { at: 1, scale: 1.06 },
    ],
  }),
});
const zoomInput = (duration: number) =>
  `nullsrc=s=${zoomCanvas.width}x${zoomCanvas.height}:r=10:d=${duration},format=gbrap,geq=r='255*X/(W-1)':g='255*Y/(H-1)':b='N*8':a='255',format=rgba`;
const zoomArgs = (c: TimelineClip, optimized: boolean, output = "pipe:1") => [
  "-v",
  "error",
  "-filter_threads",
  "1",
  "-f",
  "lavfi",
  "-i",
  zoomInput(c.duration),
  "-vf",
  `${visualRenderFilter(c, optimized ? zoomCanvas : undefined)},format=rgba`,
  "-fps_mode",
  "passthrough",
  "-f",
  "rawvideo",
  output,
];
function checkZoomFrames(
  actual: Uint8Array,
  reference: Uint8Array,
  c: TimelineClip
) {
  const frameSize = zoomCanvas.width * zoomCanvas.height * 4;
  expect(actual.length).toBe(Math.round(c.duration * 10) * frameSize);
  expect(actual.length).toBe(reference.length);
  let maximumDifference = 0;
  let minimumAlpha = 255;
  for (let i = 0; i < actual.length; i++) {
    if (i % 4 === 3) minimumAlpha = Math.min(minimumAlpha, actual[i]);
    else
      maximumDifference = Math.max(
        maximumDifference,
        Math.abs(actual[i] - reference[i])
      );
  }
  expect(minimumAlpha).toBe(255);
  // Whole-pixel scale rounding and swscale/geq interpolation may differ by a
  // few 8-bit levels; every frame must still follow the same source clock.
  expect(maximumDifference).toBeLessThanOrEqual(4);
  for (const frame of [
    0,
    Math.floor(c.duration * 5),
    Math.round(c.duration * 10) - 1,
  ]) {
    const pose = visualFrame(c, c.start + frame / 10);
    const x = 20,
      y = 20;
    const pixel = frame * frameSize + (y * zoomCanvas.width + x) * 4;
    const sourceX =
      (x + 0.5 - zoomCanvas.width / 2) / pose.scale +
      zoomCanvas.width / 2 -
      0.5;
    expect(
      Math.abs(actual[pixel] - (255 * sourceX) / (zoomCanvas.width - 1))
    ).toBeLessThanOrEqual(4);
    expect(actual[pixel + 2]).toBe(frame * 8);
  }
}
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
  it.each(["linear", "ease-in", "ease-out", "ease-in-out", "hold"])(
    "matches the inverse sampler and preview for a centered %s push-in in native FFmpeg",
    easing => {
      const c = zoomClip(easing);
      const filter = visualRenderFilter(c, zoomCanvas);
      expect(filter).toContain("eval=frame");
      expect(filter).not.toContain("geq");
      const options = { maxBuffer: 8_000_000, timeout: 15_000 };
      checkZoomFrames(
        execFileSync("ffmpeg", zoomArgs(c, true), options),
        execFileSync("ffmpeg", zoomArgs(c, false), options),
        c
      );
    },
    15000
  );
  it("preserves the original zoom clock after a split, trim and speed change", () => {
    const c = {
      ...zoomClip(),
      start: 5,
      duration: 1.5,
      inPoint: 11,
      outPoint: 14,
      speed: 2,
      visualStart: 10,
      visualDuration: 4,
      visual: normalizeVisual({
        keyframes: [
          { at: 0, scale: 1, easing: "ease-in" },
          { at: 0.5, scale: 1.04, easing: "ease-out" },
          { at: 1, scale: 1.06 },
        ],
      }),
    };
    const options = { maxBuffer: 8_000_000, timeout: 15_000 };
    checkZoomFrames(
      execFileSync("ffmpeg", zoomArgs(c, true), options),
      execFileSync("ffmpeg", zoomArgs(c, false), options),
      c
    );
  }, 15000);
  it.each([
    { x: 1 },
    { y: 1 },
    { scale: 0.99 },
    { rotation: 1 },
    { opacity: 0.99 },
    { crop: { left: 1 } },
    { mask: "ellipse" },
    { flipX: true },
    { flipY: true },
    { entrance: { kind: "dissolve" } },
    { exit: { kind: "zoom" } },
    {
      keyframes: [
        { at: 0, scale: 1 },
        { at: 1, scale: 1.06, x: 1 },
      ],
    },
  ])(
    "retains inverse sampling for non-centered or alpha-changing animation: %j",
    patch => {
      const c = zoomClip();
      c.visual = normalizeVisual({ ...c.visual, ...patch });
      expect(visualRenderFilter(c, zoomCanvas)).toContain("geq");
    }
  );
  it("retains inverse sampling when canvas parity cannot guarantee a centered whole-pixel crop", () => {
    for (const canvas of [
      { width: 161, height: 90 },
      { width: 160, height: 91 },
    ])
      expect(visualRenderFilter(zoomClip(), canvas)).toContain("geq");
  });
  it("runs the same centered zoom and retained clock in the installed browser WASM core", async () => {
    vi.stubGlobal("self", { location: { href: "file:///ffmpeg-core.js" } });
    try {
      const require = createRequire(import.meta.url);
      const path = require.resolve("@ffmpeg/core");
      const createCore = require(path);
      const core = await createCore({
        wasmBinary: readFileSync(join(dirname(path), "ffmpeg-core.wasm")),
      });
      core.setLogger(() => {});
      const c = {
        ...zoomClip(),
        inPoint: 1,
        outPoint: 3,
        visualStart: 0,
        visualDuration: 4,
      };
      const frames = [];
      for (const optimized of [true, false]) {
        core.exec(...zoomArgs(c, optimized, "zoom.rgba"));
        expect(core.ret).toBe(0);
        core.reset();
        frames.push((core.FS.readFile("zoom.rgba") as Uint8Array).slice());
        core.FS.unlink("zoom.rgba");
      }
      checkZoomFrames(frames[0], frames[1], c);
    } finally {
      vi.unstubAllGlobals();
    }
  }, 15000);
  it("starts centered dissolves at half alpha for fractional-frame durations", () => {
    for (const duration of [0.05, 0.15, 0.35]) {
      const c = {
        ...clip,
        inPoint: 1,
        outPoint: 3,
        visualStart: 1,
        visualDuration: 2,
        visual: normalizeVisual({
          entrance: { kind: "dissolve", duration, at: 1 - duration / 2 },
        }),
      };
      const output = execFileSync("ffmpeg", [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=red:s=16x16:r=30:d=1,format=rgba",
        "-vf",
        visualRenderFilter(c),
        "-frames:v",
        "1",
        "-f",
        "rawvideo",
        "pipe:1",
      ]);
      expect(output[3]).toBeGreaterThanOrEqual(126);
      expect(output[3]).toBeLessThanOrEqual(128);
    }
  });
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
