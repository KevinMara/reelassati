import { describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  normalizeVisual,
  visualFrame,
  type VisualTransition,
} from "@contracts/clip-visual";
import type { TimelineClip } from "@contracts/workspace";
import { visualRenderFilter } from "./visual-rendering";

const width = 40,
  height = 30,
  fps = 10;
function sample(kind: VisualTransition, opacity = 1): TimelineClip {
  return {
    id: "wipe",
    start: 4,
    duration: 1.4,
    inPoint: 8.2,
    outPoint: 9.6,
    speed: 1,
    visualStart: 8,
    visualDuration: 2,
    visual: normalizeVisual({
      opacity,
      entrance: { kind, duration: 0.6, at: 8 },
      exit: { kind: "dissolve", duration: 0.3, at: 9.6 },
    }),
  } as TimelineClip;
}
function args(clip: TimelineClip, output = "pipe:1") {
  return [
    "-v",
    "error",
    "-filter_threads",
    "1",
    "-f",
    "lavfi",
    "-i",
    `nullsrc=s=${width}x${height}:r=${fps}:d=${clip.duration},format=gbrap,geq=r='X+20':g='Y+50':b='N+80':a='100+X+Y',format=rgba`,
    "-vf",
    `${visualRenderFilter(clip) || "null"},format=rgba`,
    "-fps_mode",
    "passthrough",
    "-f",
    "rawvideo",
    "-y",
    output,
  ];
}
function checkFrames(bytes: Uint8Array, clip: TimelineClip) {
  expect(bytes.length).toBe(width * height * 4 * 14);
  for (let frame = 0; frame < 14; frame++) {
    const pose = visualFrame(clip, clip.start + frame / fps);
    const crop = pose.reveal;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const offset = ((frame * height + y) * width + x) * 4;
        // The source generator's integer expressions do not sample neighboring
        // pixels. A reveal must never modify RGB, including the last row/column.
        expect(bytes[offset]).toBe(x + 20);
        expect(bytes[offset + 1]).toBe(y + 50);
        expect(bytes[offset + 2]).toBe(frame + 80);
        const left = (width * crop.left) / 100,
          right = width * (1 - crop.right / 100);
        const top = (height * crop.top) / 100,
          bottom = height * (1 - crop.bottom / 100);
        // Exact mathematical edges may differ by subpixel floating arithmetic
        // between JavaScript and FFmpeg; test every pixel away from those edges.
        if (
          [
            Math.abs(x - left),
            Math.abs(x - right),
            Math.abs(y - top),
            Math.abs(y - bottom),
          ].some(d => d > 0 && d < 1e-5)
        )
          continue;
        const visible = x >= left && x < right && y >= top && y < bottom;
        const expected = visible ? (100 + x + y) * pose.opacity : 0;
        expect(Math.abs(bytes[offset + 3] - expected)).toBeLessThanOrEqual(
          1.01
        );
      }
  }
}

function checkMovingTransition(actual: Uint8Array, reference: Uint8Array) {
  expect(actual.length).toBe(width * height * 4 * 14);
  expect(actual.length).toBe(reference.length);
  let maximum = 0;
  for (let i = 0; i < actual.length; i++)
    maximum = Math.max(maximum, Math.abs(actual[i] - reference[i]));
  // The general bilinear sampler clamps the last row/column. Bypassing an
  // identity pose instead preserves those original edge pixels exactly.
  expect(maximum).toBeLessThanOrEqual(2);
  const frame = 6;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const offset = ((frame * height + y) * width + x) * 4;
      expect([...actual.subarray(offset, offset + 3)]).toEqual([
        x + 20,
        y + 50,
        frame + 80,
      ]);
      // The shipped swscale RGBA/GBRAP round trip rounds some half-alpha
      // values up by one (also in the unoptimized reference). RGB is exact.
      expect(Math.abs(actual[offset + 3] - (100 + x + y))).toBeLessThanOrEqual(
        1
      );
    }
}

function referenceClip(clip: TimelineClip): TimelineClip {
  return {
    ...clip,
    visual: normalizeVisual({
      ...clip.visual,
      keyframes: [{ at: 0 }, { at: 1 }],
    }),
  };
}

describe("stationary wipe rendering", () => {
  it.each(["slide-left", "slide-right", "zoom"] as const)(
    "preserves %s motion and bypasses only its completed identity phase",
    kind => {
      for (const speed of [1, 2]) {
        const clip = sample(kind);
        clip.speed = speed;
        clip.outPoint = clip.inPoint + clip.duration * speed;
        clip.visual = normalizeVisual({
          ...clip.visual,
          exit: { kind: "dissolve", duration: 0.3, at: clip.outPoint },
        });
        expect(visualRenderFilter(clip)).toContain(":enable=");
        expect(visualRenderFilter(referenceClip(clip))).not.toContain(
          ":enable="
        );
        const options = {
          maxBuffer: 1_000_000,
          timeout: 15000,
          windowsHide: true,
        };
        checkMovingTransition(
          execFileSync("ffmpeg", args(clip), options),
          execFileSync("ffmpeg", args(referenceClip(clip)), options)
        );
      }
    },
    30000
  );
  it.each(["wipe-left", "wipe-right", "wipe-up", "wipe-down"] as const)(
    "preserves every RGB pixel and source alpha through a split %s and exit fade",
    kind => {
      for (const opacity of [1, 0.6]) {
        const clip = sample(kind, opacity);
        const filter = visualRenderFilter(clip);
        expect(filter).not.toContain("st(2,");
        expect(filter.includes(":enable=")).toBe(opacity === 1);
        checkFrames(
          execFileSync("ffmpeg", args(clip), {
            maxBuffer: 1_000_000,
            timeout: 15000,
            windowsHide: true,
          }),
          clip
        );
      }
    },
    30000
  );
  it.each([
    { x: 2 },
    { scale: 1.1 },
    { rotation: 2 },
    { flipX: true },
    { mask: "ellipse" },
    { crop: { left: 2 } },
  ])("retains geometry processing for %j", patch => {
    const clip = sample("wipe-left");
    clip.visual = normalizeVisual({ ...clip.visual, ...patch });
    expect(visualRenderFilter(clip)).toContain("st(2,");
  });
  it("runs the same alpha and time bypass in the shipped browser WASM core", async () => {
    vi.stubGlobal("self", { location: { href: "file:///ffmpeg-core.js" } });
    try {
      const require = createRequire(import.meta.url),
        path = require.resolve("@ffmpeg/core");
      const core = await require(path)({
        wasmBinary: readFileSync(join(dirname(path), "ffmpeg-core.wasm")),
      });
      core.setLogger(() => {});
      for (const kind of [
        "wipe-left",
        "wipe-right",
        "wipe-up",
        "wipe-down",
      ] as const) {
        const clip = sample(kind);
        core.setTimeout(10000);
        core.exec(...args(clip, "wipe.rgba"));
        expect(core.ret).toBe(0);
        core.reset();
        checkFrames(core.FS.readFile("wipe.rgba"), clip);
        core.FS.unlink("wipe.rgba");
      }
      for (const kind of ["slide-left", "slide-right", "zoom"] as const) {
        const clip = sample(kind),
          frames: Uint8Array[] = [];
        for (const c of [clip, referenceClip(clip)]) {
          core.setTimeout(10000);
          core.exec(...args(c, "motion.rgba"));
          expect(core.ret).toBe(0);
          core.reset();
          frames.push(core.FS.readFile("motion.rgba").slice());
          core.FS.unlink("motion.rgba");
        }
        checkMovingTransition(frames[0], frames[1]);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  }, 30000);
});
