import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Asset, EditProject } from "@contracts/workspace";
import { buildRenderPlan } from "./render-plan";

describe("cut boundaries in the shipped browser renderer", () => {
  let core: any;
  const run = (...args: string[]) => {
    core.exec("-y", "-v", "error", ...args);
    const code = core.ret;
    core.reset();
    expect(code).toBe(0);
  };
  beforeAll(async () => {
    vi.stubGlobal("self", { location: { href: "file:///ffmpeg-core.js" } });
    const require = createRequire(import.meta.url),
      path = require.resolve("@ffmpeg/core");
    core = await require(path)({
      wasmBinary: readFileSync(join(dirname(path), "ffmpeg-core.wasm")),
    });
    core.setLogger(() => {});
  });
  afterAll(() => vi.unstubAllGlobals());

  for (const frameRate of [24, 25, 30, 60] as const) {
    it(`keeps every covered frame, switches at the exact cut and preserves real gaps at ${frameRate} fps`, () => {
      // 13.3 at 30 fps reproduced a black frame in a real exported project.
      // Fractional boundaries and an intentional gap exercise both directions.
      const intervals = [
        [0, 0.731],
        [0.731, 5],
        [5, 10],
        [10, 13.3],
        [13.3, 17],
        [17, 21.5],
        [21.57, 22],
      ];
      const assets = ["red", "lime"].map((color, i) => {
        run(
          "-f",
          "lavfi",
          "-i",
          `color=${color}:s=16x16:r=${frameRate}:d=23`,
          "-c:v",
          "ffv1",
          "-f",
          "matroska",
          `input-${i}`
        );
        return {
          id: `asset-${i}`,
          name: color,
          kind: "video",
          status: "ready",
        } as Asset;
      });
      const project = {
        id: "cuts",
        duration: 22,
        aspectRatio: "1:1",
        frameRate,
        transcript: [],
        title: "Cut continuity",
        template: "blank",
        status: "editing",
        platform: "instagram",
        playhead: 0,
        createdAt: "2026-11-12T00:00:00Z",
        updatedAt: "2026-11-12T00:00:00Z",
        proposedChanges: [],
        qualitySignals: [],
        revisions: [],
        clips: intervals.map(([start, end], i) => ({
          id: `clip-${i}`,
          assetId: assets[i % 2].id,
          label: "Cut",
          track: "video",
          start,
          duration: end - start,
          inPoint: 0,
          outPoint: end - start,
          locked: false,
          color: "blue",
          speed: 1,
        })),
      } as EditProject;
      const plan = buildRenderPlan(project, assets, new Set(), { frameRate });
      const at = plan.args.indexOf("-filter_complex");
      const graph = plan.args[at + 1]
        .split(";")
        .filter(f => !f.includes("anullsrc") && !f.includes("amix="))
        .join(";")
        .replaceAll("720", "16");
      run(
        ...plan.args.slice(0, at),
        "-filter_complex",
        `${graph};[layer6]format=rgb24[frames]`,
        "-map",
        "[frames]",
        "-t",
        "22",
        "-f",
        "rawvideo",
        "result.rgb"
      );
      const bytes = core.FS.readFile("result.rgb") as Uint8Array;
      expect(bytes.length).toBe(22 * frameRate * 16 * 16 * 3);
      for (let frame = 0; frame < 22 * frameRate; frame++) {
        const t = frame / frameRate;
        const active = intervals.findIndex(
          ([start, end]) => t + 1e-10 >= start && t + 1e-10 < end
        );
        const pixel = bytes.slice(
          (frame * 16 * 16 + 8 * 16 + 8) * 3,
          (frame * 16 * 16 + 8 * 16 + 8) * 3 + 3
        );
        if (active < 0)
          expect(Math.max(...pixel), `gap at ${t}`).toBeLessThan(5);
        else {
          expect(
            pixel[active % 2],
            `incoming clip at frame ${frame} / ${t}s`
          ).toBeGreaterThan(240);
          expect(
            pixel[1 - (active % 2)],
            `outgoing clip at frame ${frame}`
          ).toBeLessThan(5);
        }
      }
      for (const file of ["input-0", "input-1", "result.rgb"])
        core.FS.unlink(file);
    }, 30000);
  }
});
