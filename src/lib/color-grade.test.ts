import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { colorGradeFilter, colorGradeMatrix } from "./color-grade";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import { buildRenderPlan } from "./render-plan";

const basicGrades = [
  { brightness: 0.02, contrast: 1.06, saturation: 1.05 },
  // Actual live edit: this formerly evaluated nine channel samples per pixel.
  {
    brightness: 0.02,
    contrast: 1.05,
    saturation: 1.04,
    temperature: 0.12,
    highlights: -0.1,
    shadows: 0.08,
  },
  ...[-0.1, 0.1].flatMap(brightness =>
    [0.85, 1.15].flatMap(contrast =>
      [0.85, 1.15].map(saturation => ({ brightness, contrast, saturation }))
    )
  ),
  ...[-0.25, 0.25].flatMap(exposure =>
    [-0.2, 0.2].flatMap(temperature =>
      [-0.2, 0.2].flatMap(tint =>
        [0.85, 1.15].map(saturation => ({
          exposure,
          temperature,
          tint,
          saturation,
          brightness: temperature > 0 ? 0.1 : -0.1,
          contrast: exposure > 0 ? 1.15 : 0.85,
          highlights: -0.2,
          shadows: 0.2,
          whites: -0.2,
          blacks: 0.2,
        }))
      )
    )
  ),
];
const preservedGrades = [
  {
    brightness: 0.5,
    contrast: 2,
    saturation: 3,
    exposure: 2,
    temperature: 1,
    tint: -1,
  },
  {
    brightness: -0.5,
    contrast: 0.5,
    saturation: 3,
    exposure: -2,
    temperature: -1,
    tint: 1,
  },
  { saturation: 1.05, highlights: 1, shadows: -1, whites: 1, blacks: -1 },
  { saturation: 1.05, highlights: -1, shadows: 1, whites: -1, blacks: 1 },
];
// Every channel and alpha byte occurs, with 65,536 distinct RGB combinations.
// Correlated gray ramps alone miss matrix clipping and channel-mixing errors.
const colorGrid = Buffer.alloc(256 * 256 * 4);
for (let y = 0; y < 256; y++)
  for (let x = 0; x < 256; x++) {
    const i = (y * 256 + x) * 4;
    colorGrid[i] = x;
    colorGrid[i + 1] = y;
    colorGrid[i + 2] = (x * 13 + y * 7) % 256;
    colorGrid[i + 3] = x ^ y;
  }
function originalMatrixFilter(grade: Partial<TimelineClip>) {
  const matrix = colorGradeMatrix(grade);
  const channels = ["r", "g", "b"];
  const expressions = channels.map(
    (channel, row) =>
      `${channel}='clip(${channels.map((c, col) => `${Number(matrix[row * 5 + col].toFixed(8))}*${c}(X,Y)`).join("+")}+${Number((matrix[row * 5 + 4] * 255).toFixed(8))},0,255)'`
  );
  let filter = `format=gbrap,geq=${expressions.join(":")}:a='alpha(X,Y)':interpolation=nearest`;
  if (
    [grade.shadows, grade.highlights, grade.whites, grade.blacks].some(Boolean)
  ) {
    const tone = `'clip(val+255*(${grade.shadows ?? 0}*0.25*pow(1-val/255,2)+${grade.highlights ?? 0}*0.25*pow(val/255,2)+${grade.whites ?? 0}*0.15*pow(val/255,4)+${grade.blacks ?? 0}*0.15*pow(1-val/255,4)),0,255)'`;
    filter += `,lutrgb=r=${tone}:g=${tone}:b=${tone}`;
  }
  return filter;
}
const gridArgs = (filter: string, input = "pipe:0", output = "pipe:1") => [
  "-v",
  "error",
  "-filter_threads",
  "1",
  "-f",
  "rawvideo",
  "-pix_fmt",
  "rgba",
  "-s",
  "256x256",
  "-i",
  input,
  "-vf",
  `${filter},format=rgba`,
  "-frames:v",
  "1",
  "-f",
  "rawvideo",
  output,
];
const nativeGrid = (filter: string) =>
  execFileSync("ffmpeg", gridArgs(filter), {
    input: colorGrid,
    timeout: 15_000,
    maxBuffer: 2_000_000,
  });
function checkMatrixParity(
  actual: Uint8Array,
  reference: Uint8Array,
  tolerance = 1
) {
  expect(actual.length).toBe(reference.length);
  let colorDifference = 0,
    alphaDifference = 0;
  for (let i = 0; i < actual.length; i++) {
    const difference = Math.abs(actual[i] - reference[i]);
    if (i % 4 === 3) alphaDifference = Math.max(alphaDifference, difference);
    else colorDifference = Math.max(colorDifference, difference);
  }
  expect(alphaDifference).toBe(0);
  expect(colorDifference).toBeLessThanOrEqual(tolerance);
}

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
          writeFile: (path: string, bytes: Uint8Array) => void;
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
      core.FS.writeFile("matrix-source.rgba", colorGrid);
      for (const grade of [...basicGrades, ...preservedGrades]) {
        const outputs: Uint8Array[] = [];
        for (const filter of [
          colorGradeFilter(grade),
          originalMatrixFilter(grade),
        ]) {
          core.exec(
            ...gridArgs(filter, "matrix-source.rgba", "matrix-result.rgba")
          );
          expect(core.ret).toBe(0);
          core.reset();
          outputs.push(core.FS.readFile("matrix-result.rgba").slice());
          core.FS.unlink("matrix-result.rgba");
        }
        checkMatrixParity(
          outputs[0],
          outputs[1],
          basicGrades.includes(grade as (typeof basicGrades)[number]) ? 1 : 0
        );
      }
      core.FS.unlink("matrix-source.rgba");
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
  it.each(basicGrades)(
    "matches the pointwise matrix within one color level with exact alpha in native FFmpeg: %j",
    grade => {
      const filter = colorGradeFilter(grade);
      expect(filter).toContain("colorchannelmixer=");
      expect(filter).not.toContain("geq=");
      checkMatrixParity(
        nativeGrid(filter),
        nativeGrid(originalMatrixFilter(grade))
      );
    },
    15000
  );
  it.each(preservedGrades)(
    "keeps extreme and tone-adjusted grades on the original exact path: %j",
    grade => {
      expect(colorGradeFilter(grade)).toContain("geq=");
      checkMatrixParity(
        nativeGrid(colorGradeFilter(grade)),
        nativeGrid(originalMatrixFilter(grade)),
        0
      );
    },
    15000
  );
  it("isolates scoped grades in a multi-clip graph and assigns those scopes in render plans", () => {
    const [first, second] = [basicGrades[0], basicGrades[8]];
    const graph = `split[leftSource][rightSource];[leftSource]${colorGradeFilter(first, 0)}[left];[rightSource]${colorGradeFilter(second, 1)}[right];[left][right]hstack`;
    const reference = `split[leftSource][rightSource];[leftSource]${originalMatrixFilter(first)}[left];[rightSource]${originalMatrixFilter(second)}[right];[left][right]hstack`;
    checkMatrixParity(nativeGrid(graph), nativeGrid(reference));
    const project = {
      duration: 2,
      aspectRatio: "1:1",
      transcript: [],
      clips: [first, second].map((grade, index) => ({
        id: `picture-${index}`,
        assetId: "source",
        track: "video",
        start: index,
        duration: 1,
        inPoint: 0,
        outPoint: 1,
        ...grade,
      })),
    } as unknown as EditProject;
    const assets = [
      { id: "source", kind: "video", status: "ready" },
    ] as Asset[];
    const plan = buildRenderPlan(project, assets, new Set());
    const filter = plan.args[plan.args.indexOf("-filter_complex") + 1];
    expect(filter).toContain("[grade0alphaIn]");
    expect(filter).toContain("[grade1alphaIn]");
  }, 15000);
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
