import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { TimelineClip } from "@contracts/workspace";
import { normalizeVisual } from "@contracts/clip-visual";
import { visualCompositeFilters, visualRenderFilter } from "./visual-rendering";

const modes = [
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "difference",
] as const;
const upper = (blendMode: (typeof modes)[number]): TimelineClip => ({
  id: "top",
  label: "Top",
  track: "video",
  start: 0.2,
  duration: 0.6,
  inPoint: 0,
  outPoint: 0.6,
  locked: false,
  color: "#ffffff",
  visual: normalizeVisual({
    blendMode,
    opacity: 0.5,
    mask: "polygon",
    polygon: [
      { x: 50, y: 5 },
      { x: 95, y: 95 },
      { x: 5, y: 95 },
    ],
  }),
});
const graph = (clip: TimelineClip) =>
  [
    "color=c=0x4080c0:s=64x64:r=10:d=1,format=rgba[base]",
    `color=c=0xc04080:s=64x64:r=10:d=0.6,format=rgba,${visualRenderFilter(clip)},setpts=PTS+0.2/TB[top]`,
    ...visualCompositeFilters(clip, "base", "top", "out"),
    "[out]format=rgba[rgba]",
  ].join(";");
const pixel = (bytes: Uint8Array, frame: number, x: number, y: number) => [
  ...bytes.subarray(
    (frame * 64 * 64 + y * 64 + x) * 4,
    (frame * 64 * 64 + y * 64 + x) * 4 + 3
  ),
];
const blend = (mode: (typeof modes)[number], a: number, b: number) =>
  mode === "multiply"
    ? (a * b) / 255
    : mode === "screen"
      ? 255 - ((255 - a) * (255 - b)) / 255
      : mode === "overlay"
        ? a < 128
          ? (2 * a * b) / 255
          : 255 - (2 * (255 - a) * (255 - b)) / 255
        : mode === "darken"
          ? Math.min(a, b)
          : mode === "lighten"
            ? Math.max(a, b)
            : Math.abs(a - b);
function check(bytes: Uint8Array, mode: (typeof modes)[number]) {
  expect(bytes.length).toBe(10 * 64 * 64 * 4);
  const background = pixel(bytes, 0, 32, 40);
  const inside = pixel(bytes, 5, 32, 40),
    outside = pixel(bytes, 5, 2, 2),
    after = pixel(bytes, 9, 32, 40);
  for (let c = 0; c < 3; c++) {
    const expected =
      background[c] * 0.5 + blend(mode, background[c], [192, 64, 128][c]) * 0.5;
    expect(Math.abs(inside[c] - expected)).toBeLessThan(7);
    expect(Math.abs(outside[c] - background[c])).toBeLessThan(3);
    expect(Math.abs(after[c] - background[c])).toBeLessThan(3);
  }
}
const logoPose: TimelineClip = {
  id: "logo",
  label: "Logo",
  track: "overlay",
  start: 0,
  duration: 1,
  inPoint: 0,
  outPoint: 1,
  visualStart: 0,
  visualDuration: 1,
  locked: false,
  color: "#ffffff",
  visual: normalizeVisual({
    scale: 0.25,
    y: -25,
    entrance: { kind: "dissolve", duration: 0.2 },
    exit: { kind: "dissolve", duration: 0.2 },
  }),
};
const logoGraph = (clip = logoPose) =>
  `color=white:s=64x64:r=10:d=${clip.duration},format=rgba,${visualRenderFilter(clip, { width: 64, height: 64 })},format=rgba[rgba]`;
function checkLogo(bytes: Uint8Array, trimmed = false) {
  const alpha = (frame: number, x: number, y: number) =>
    bytes[(frame * 64 * 64 + y * 64 + x) * 4 + 3];
  expect(bytes.length).toBe((trimmed ? 5 : 10) * 64 * 64 * 4);
  expect(alpha(0, 32, 16)).toBe(trimmed ? 255 : 0);
  expect(alpha(trimmed ? 2 : 5, 32, 16)).toBe(255);
  expect(alpha(trimmed ? 2 : 5, 32, 40)).toBe(0);
  expect(alpha(trimmed ? 2 : 5, 1, 1)).toBe(0);
}
describe("actual polygon masks and alpha-aware layer blending", () => {
  it("scales contained logos with transparent padding and preserves a trimmed fade clock in native FFmpeg", () => {
    for (const trimmed of [false, true]) {
      const clip = trimmed
        ? { ...logoPose, inPoint: 0.25, duration: 0.5 }
        : logoPose;
      const bytes = execFileSync("ffmpeg", [
        "-v",
        "error",
        "-filter_complex_threads",
        "1",
        "-f",
        "lavfi",
        "-i",
        "anullsrc",
        "-filter_complex",
        logoGraph(clip),
        "-map",
        "[rgba]",
        // Match the render plan's explicit output rate; FFmpeg versions infer
        // different rates from the audio-only input and the AVTB filter clock.
        "-r",
        "10",
        "-t",
        String(clip.duration),
        "-f",
        "rawvideo",
        "pipe:1",
      ]);
      checkLogo(bytes, trimmed);
    }
  });
  for (const mode of modes)
    it(`composites ${mode} pixels, transparent corners and gaps in native FFmpeg`, () => {
      const bytes = execFileSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-filter_complex_threads",
          "1",
          "-f",
          "lavfi",
          "-i",
          "anullsrc",
          "-filter_complex",
          graph(upper(mode)),
          "-map",
          "[rgba]",
          "-t",
          "1",
          "-f",
          "rawvideo",
          "pipe:1",
        ],
        { maxBuffer: 2000000, timeout: 15000 }
      );
      check(bytes, mode);
    });
  it("rejects invalid masks and bounds points instead of emitting nonfinite render expressions", () => {
    expect(
      normalizeVisual({
        mask: "polygon",
        polygon: [
          { x: NaN, y: 0 },
          { x: 0, y: 0 },
          { x: 1, y: 2 },
        ],
      }).polygon
    ).toHaveLength(4);
    expect(
      normalizeVisual({
        polygon: Array.from({ length: 100 }, () => ({ x: -2, y: 102 })),
      }).polygon
    ).toHaveLength(12);
    expect(normalizeVisual({ blendMode: "arbitrary-filter" }).blendMode).toBe(
      "normal"
    );
  });
});

type Core = {
  ret: number;
  exec: (...args: string[]) => void;
  reset: () => void;
  setLogger: (logger: (data: { message: string }) => void) => void;
  FS: {
    readFile: (path: string) => Uint8Array;
    unlink: (path: string) => void;
  };
};
describe("shipped browser WASM compositor", () => {
  let core: Core;
  beforeAll(async () => {
    vi.stubGlobal("self", { location: { href: "file:///ffmpeg-core.js" } });
    const require = createRequire(import.meta.url),
      path = require.resolve("@ffmpeg/core");
    const create = require(path) as (options: {
      wasmBinary: Uint8Array;
    }) => Promise<Core>;
    core = await create({
      wasmBinary: readFileSync(join(dirname(path), "ffmpeg-core.wasm")),
    });
    core.setLogger(() => {});
  });
  afterAll(() => vi.unstubAllGlobals());
  it("runs the contained-logo fast path and trimmed animation in the shipped browser core", () => {
    for (const trimmed of [false, true]) {
      const clip = trimmed
        ? { ...logoPose, inPoint: 0.25, duration: 0.5 }
        : logoPose;
      core.exec(
        "-v",
        "error",
        "-filter_complex_threads",
        "1",
        "-f",
        "lavfi",
        "-i",
        "anullsrc",
        "-filter_complex",
        logoGraph(clip),
        "-map",
        "[rgba]",
        "-r",
        "10",
        "-t",
        String(clip.duration),
        "-f",
        "rawvideo",
        "logo.rgba"
      );
      expect(core.ret).toBe(0);
      checkLogo(core.FS.readFile("logo.rgba"), trimmed);
      core.FS.unlink("logo.rgba");
      core.reset();
    }
  }, 30000);
  for (const mode of modes)
    it(`runs real ${mode} plus polygon/opacity in the installed browser core`, () => {
      core.exec(
        "-v",
        "error",
        "-filter_complex_threads",
        "1",
        "-f",
        "lavfi",
        "-i",
        "anullsrc",
        "-filter_complex",
        graph(upper(mode)),
        "-map",
        "[rgba]",
        "-t",
        "1",
        "-f",
        "rawvideo",
        "blend.rgba"
      );
      expect(core.ret).toBe(0);
      check(core.FS.readFile("blend.rgba"), mode);
      core.FS.unlink("blend.rgba");
      core.reset();
    }, 30000);
});
