import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  applyCubeLutPixels,
  parseCubeLut,
  serializeCubeLut,
} from "@contracts/color-lut";
import { cubeFixture } from "@contracts/test-fixtures/color-lut";
import {
  colorLutFilename,
  colorLutFilter,
  loadColorLut,
  prepareColorLutExport,
} from "./color-lut";
import { buildRenderPlan } from "./render-plan";
import type { Asset, EditProject } from "@contracts/workspace";

const folder = mkdtempSync(join(tmpdir(), "reel-lut-test-"));
afterAll(() => rmSync(folder, { recursive: true, force: true }));
const sha256 = "b".repeat(64);
const reference = {
  id: `stock-${sha256.slice(0, 24)}`,
  sha256,
  name: "Test look",
  amount: 1,
};
const lut = parseCubeLut(cubeFixture(16));
const pixels = new Uint8ClampedArray(32 * 32 * 4);
for (let i = 0; i < pixels.length; i += 4) {
  pixels[i] = (i * 13) % 256;
  pixels[i + 1] = Math.floor(i / 16) % 256;
  pixels[i + 2] = (i * 7 + 19) % 256;
  pixels[i + 3] = Math.floor(i / 4) % 256;
}
const args = (filter: string, input: string, output: string) => [
  "-y",
  "-v",
  "error",
  "-filter_threads",
  "1",
  "-f",
  "rawvideo",
  "-pix_fmt",
  "rgba",
  "-s",
  "32x32",
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
function compare(actual: Uint8Array, amount: number, source = lut) {
  const expected = pixels.slice();
  applyCubeLutPixels(source, expected, amount);
  let maximum = 0;
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    if (i % 4 === 3) expect(actual[i]).toBe(expected[i]);
    else maximum = Math.max(maximum, Math.abs(actual[i] - expected[i]));
  }
  expect(maximum).toBeLessThanOrEqual(1);
}

describe("preview/export CUBE parity", () => {
  it("keeps out-of-gamut interpolation on the exact general path", () => {
    const data = lut.data.slice();
    for (let i = 0; i < data.length; i += 3) data[i] = data[i] * 3 - 1;
    const extended = { ...lut, data },
      selected = { ...reference, amount: 0.5 };
    expect(prepareColorLutExport(selected, extended)).toBe(extended);
    writeFileSync(
      join(folder, colorLutFilename(selected)),
      serializeCubeLut(extended)
    );
    compare(
      execFileSync(
        "ffmpeg",
        args(colorLutFilter(selected, extended, 0), "pipe:0", "pipe:1"),
        { input: pixels, cwd: folder, maxBuffer: 100000, timeout: 15000 }
      ),
      0.5,
      extended
    );
  });
  it.each([0, 0.25, 0.7, 1])(
    "uses the real native FFmpeg lookup at amount %s with unchanged alpha",
    amount => {
      writeFileSync(
        join(folder, colorLutFilename({ ...reference, amount })),
        serializeCubeLut(prepareColorLutExport({ ...reference, amount }, lut))
      );
      const result = execFileSync(
        "ffmpeg",
        args(
          colorLutFilter({ ...reference, amount }, lut, 0),
          "pipe:0",
          "pipe:1"
        ),
        { input: pixels, cwd: folder, maxBuffer: 100000, timeout: 15000 }
      );
      compare(result, amount);
    }
  );
  it("normalizes non-default CUBE input domains without relying on the FFmpeg parser", () => {
    const ranged = {
      ...lut,
      domainMin: [-0.2, 0.1, 0] as [number, number, number],
      domainMax: [0.8, 0.9, 2] as [number, number, number],
    };
    writeFileSync(
      join(folder, colorLutFilename({ ...reference, amount: 0.65 })),
      serializeCubeLut(ranged)
    );
    compare(
      execFileSync(
        "ffmpeg",
        args(
          colorLutFilter({ ...reference, amount: 0.65 }, ranged, 0),
          "pipe:0",
          "pipe:1"
        ),
        { input: pixels, cwd: folder, maxBuffer: 100000, timeout: 15000 }
      ),
      0.65,
      ranged
    );
  });
  it("ships the same lookup and strength in the actual installed WASM core", async () => {
    vi.stubGlobal("self", { location: { href: "file:///ffmpeg-core.js" } });
    try {
      const require = createRequire(import.meta.url),
        path = require.resolve("@ffmpeg/core");
      const create = require(path);
      const core = await create({
        wasmBinary: readFileSync(join(dirname(path), "ffmpeg-core.wasm")),
      });
      core.setLogger(() => {});
      core.FS.writeFile("input.rgba", pixels);
      for (const amount of [0.25, 1]) {
        core.FS.writeFile(
          colorLutFilename({ ...reference, amount }),
          new TextEncoder().encode(
            serializeCubeLut(
              prepareColorLutExport({ ...reference, amount }, lut)
            )
          )
        );
        core.exec(
          ...args(
            colorLutFilter({ ...reference, amount }, lut, 0),
            "input.rgba",
            "output.rgba"
          )
        );
        expect(core.ret).toBe(0);
        compare(core.FS.readFile("output.rgba"), amount);
        core.reset();
      }
    } finally {
      vi.unstubAllGlobals();
    }
  }, 30000);
  it("includes LUT before editable grade in the actual export plan and refuses missing bytes", () => {
    const asset = { id: "source", kind: "video", status: "ready" } as Asset;
    const project = {
      title: "Look",
      duration: 1,
      aspectRatio: "9:16",
      transcript: [],
      clips: [
        {
          id: "clip",
          assetId: asset.id,
          track: "video",
          start: 0,
          duration: 1,
          inPoint: 0,
          outPoint: 1,
          colorLut: reference,
          brightness: 0.1,
        },
      ],
    } as unknown as EditProject;
    expect(() => buildRenderPlan(project, [asset], new Set())).toThrow(
      "has not loaded"
    );
    const plan = buildRenderPlan(
      project,
      [asset],
      new Set(),
      720,
      new Map(),
      new Map([[sha256, lut]])
    );
    expect(plan.luts).toHaveLength(1);
    const graph = plan.args[plan.args.indexOf("-filter_complex") + 1];
    expect(graph.indexOf("lut3d=")).toBeLessThan(graph.indexOf("lutrgb="));
    expect(graph).toContain("interp=trilinear");
    const mixed = {
      ...project,
      clips: [
        {
          ...project.clips[0],
          duration: 0.5,
          outPoint: 0.5,
          colorLut: { ...reference, amount: 0.25 },
        },
        {
          ...project.clips[0],
          id: "second",
          start: 0.5,
          inPoint: 0.5,
          duration: 0.5,
          colorLut: { ...reference, amount: 0.75 },
        },
      ],
    };
    const varied = buildRenderPlan(
      mixed,
      [asset],
      new Set(),
      720,
      new Map(),
      new Map([[sha256, lut]])
    );
    expect(varied.luts).toHaveLength(2);
    expect(new Set(varied.luts.map(row => row.file)).size).toBe(2);
    expect(varied.luts[0].lut.data).not.toEqual(varied.luts[1].lut.data);
  });
  it("verifies downloaded CUBE bytes before caching or applying the look", async () => {
    const bytes = new TextEncoder().encode(cubeFixture());
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const hash = Array.from(digest, n => n.toString(16).padStart(2, "0")).join(
      ""
    );
    const fetcher = vi.fn(async () => new Response(bytes));
    vi.stubGlobal("fetch", fetcher);
    try {
      await expect(loadColorLut(reference)).rejects.toThrow("does not match");
      const valid = {
        ...reference,
        id: `stock-${hash.slice(0, 24)}`,
        sha256: hash,
      };
      const loaded = await loadColorLut(valid);
      expect(loaded.data).toEqual(parseCubeLut(cubeFixture()).data);
      await loadColorLut(valid);
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
