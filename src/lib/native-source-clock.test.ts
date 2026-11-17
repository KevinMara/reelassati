import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { TimelineClip } from "@contracts/workspace";
import { normalizeVisual } from "@contracts/clip-visual";
import { visualLayerSourceFilter } from "./visual-layer-rendering";

describe("native source clock across decode batches", () => {
  it("retains every frame and its motion phase for slow, fast and non-aligned source clocks", () => {
    const folder = mkdtempSync(join(tmpdir(), "reel-native-clock-")),
      input = join(folder, "source.mp4");
    try {
      execFileSync("ffmpeg", [
        "-v",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=s=64x64:r=30:d=4",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        input,
      ]);
      for (const [speed, fps, duration, sourceIn] of [
        [0.5, 25, 0.8, 0.8],
        [1, 30, 0.45, 0.817],
        [2, 24, 0.45, 0.811],
        [0.25, 60, 0.45, 1.017],
      ]) {
        const count = Math.ceil(duration * fps);
        const clip = {
          id: "source",
          track: "video",
          start: 0,
          inPoint: sourceIn,
          outPoint: sourceIn + duration * speed,
          duration,
          speed,
          visualStart: sourceIn + 0.2,
          visualDuration: 2,
          visual: normalizeVisual({
            keyframes: [
              { at: 0, x: 0, scale: 1 },
              { at: 1, x: 4, scale: 1.1 },
            ],
          }),
        } as TimelineClip;
        const filter = (start: number, size: number) =>
          visualLayerSourceFilter(
            clip,
            { width: 64, height: 64, frameRate: fps },
            { scope: 1, still: false, frameWindow: { start, count: size } }
          ) + ",setpts=PTS-STARTPTS";
        const decode = (chain: string, frames: number, seek = true) =>
          execFileSync(
            "ffmpeg",
            [
              "-v",
              "error",
              ...(seek
                ? [
                    "-copyts",
                    "-start_at_zero",
                    "-noaccurate_seek",
                    "-ss",
                    String(sourceIn),
                  ]
                : []),
              "-i",
              input,
              "-an",
              "-vf",
              chain,
              "-frames:v",
              String(frames),
              "-f",
              "rawvideo",
              "-pix_fmt",
              "rgba",
              "-",
            ],
            { maxBuffer: 10_000_000 }
          );
        const whole = decode(filter(0, count), count);
        expect(whole.length, `whole ${speed}x at ${fps}fps`).toBe(
          count * 64 * 64 * 4
        );
        expect(
          whole.equals(decode(filter(0, count), count, false)),
          "seek must preserve original source PTS"
        ).toBe(true);
        const batches: Buffer[] = [];
        for (let start = 0; start < count; start += 4) {
          const size = Math.min(4, count - start);
          const bytes = decode(filter(start, size), size);
          expect(bytes.length, `batch ${start} at ${speed}x/${fps}fps`).toBe(
            size * 64 * 64 * 4
          );
          batches.push(bytes);
        }
        expect(
          Buffer.concat(batches).equals(whole),
          `phase at ${speed}x/${fps}fps`
        ).toBe(true);
      }
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }, 30000);
});
