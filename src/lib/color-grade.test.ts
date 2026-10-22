import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { colorGradeFilter, colorGradeMatrix } from "./color-grade";

describe("color-grade lookup acceleration", () => {
  it("executes the lookup with exact pixels and alpha in the shipped browser core", async () => {
    vi.stubGlobal("self", { location: { href: "file:///ffmpeg-core.js" } });
    try {
      const require = createRequire(import.meta.url),
        path = require.resolve("@ffmpeg/core");
      const create = require(path) as (options: {
        wasmBinary: Uint8Array;
      }) => Promise<{
        exec: (...args: string[]) => void;
        ret: number;
        reset: () => void;
        setLogger: (fn: () => void) => void;
        FS: {
          readFile: (path: string) => Uint8Array;
          unlink: (path: string) => void;
        };
      }>;
      const core = await create({
        wasmBinary: readFileSync(join(dirname(path), "ffmpeg-core.wasm")),
      });
      core.setLogger(() => {});
      core.exec(
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "nullsrc=s=256x2:d=0.1,format=gbrap,geq=r='X':g='255-X':b='X':a='X'",
        "-vf",
        `${colorGradeFilter({ brightness: 0.1 })},format=rgba`,
        "-frames:v",
        "1",
        "-f",
        "rawvideo",
        "proof.rgba"
      );
      expect(core.ret).toBe(0);
      const pixels = core.FS.readFile("proof.rgba");
      for (let x = 0; x < 256; x++) {
        expect(pixels[x * 4]).toBe(Math.min(255, Math.floor(x + 25.5)));
        expect(pixels[x * 4 + 3]).toBe(x);
      }
      core.FS.unlink("proof.rgba");
      core.reset();
      core.exec(
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "nullsrc=s=256x2:d=0.1,format=gbrap,geq=r='X':g='255-X':b='X':a='X'",
        "-vf",
        `${colorGradeFilter({ saturation: 1.3 })},format=rgba`,
        "-frames:v",
        "1",
        "-f",
        "rawvideo",
        "saturation.rgba"
      );
      expect(core.ret).toBe(0);
      const saturationPixels = core.FS.readFile("saturation.rgba");
      for (let x = 0; x < 256; x++) {
        expect(saturationPixels[x * 4 + 3]).toBe(x);
        expect(saturationPixels[1024 + x * 4 + 3]).toBe(x);
      }
      expect(saturationPixels[255 * 4]).toBe(255);
      core.FS.unlink("saturation.rgba");
      core.reset();
    } finally {
      vi.unstubAllGlobals();
    }
  }, 30000);
  it("keeps mixed saturation on the full matrix and leaves neutral footage alone", () => {
    expect(colorGradeFilter({})).toBe("null");
    expect(colorGradeFilter({ saturation: 1.3 })).toContain("geq=");
    expect(colorGradeFilter({ contrast: 1.3, brightness: 0.1 })).toContain(
      "lutrgb="
    );
  });
  it.each([
    { brightness: 0.18 },
    { brightness: -0.18 },
    { contrast: 1.7 },
    { contrast: 0.6, brightness: 0.1 },
    { contrast: 0.5, brightness: -0.5 },
  ])(
    "matches the pointwise matrix for every 8-bit channel value, preserving alpha: %j",
    grade => {
      const matrix = colorGradeMatrix(grade);
      const channels = ["r", "g", "b"];
      const expressions = channels.map(
        (channel, row) =>
          `${channel}='clip(${channels.map((c, col) => `${Number(matrix[row * 5 + col].toFixed(8))}*${c}(X,Y)`).join("+")}+${Number((matrix[row * 5 + 4] * 255).toFixed(8))},0,255)'`
      );
      const original = `format=gbrap,geq=${expressions.join(":")}:a='alpha(X,Y)':interpolation=nearest`;
      const pixels = (filter: string) =>
        execFileSync(
          "ffmpeg",
          [
            "-v",
            "error",
            "-filter_complex_threads",
            "1",
            "-f",
            "lavfi",
            "-i",
            "nullsrc=s=256x2:d=0.1,format=gbrap,geq=r='X':g='255-X':b='mod(X*3,256)':a='X'",
            "-vf",
            `${filter},format=rgba`,
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "pipe:1",
          ],
          { timeout: 10000 }
        );
      expect(pixels(colorGradeFilter(grade))).toEqual(pixels(original));
    }
  );
});
