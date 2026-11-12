import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Asset, EditProject } from "@contracts/workspace";
import { buildRenderPlan } from "./render-plan";

describe("export audio source-clock continuity in the shipped WASM decoder", () => {
  let core: any;
  const run = (...args: string[]) => {
    core.exec("-y", "-v", "error", ...args);
    const code = core.ret;
    core.reset();
    expect(code).toBe(0);
  };
  const pcm = (name: string) => {
    const data = (core.FS.readFile(name) as Uint8Array).slice();
    return new Float32Array(data.buffer);
  };
  beforeAll(async () => {
    vi.stubGlobal("self", { location: { href: "file:///ffmpeg-core.js" } });
    const require = createRequire(import.meta.url);
    const path = require.resolve("@ffmpeg/core");
    core = await require(path)({ wasmBinary: readFileSync(join(dirname(path), "ffmpeg-core.wasm")) });
    core.setLogger(() => {});
    // A changing signal catches displaced audio that a single sine wave misses.
    run("-f", "lavfi", "-i", "aevalsrc=0.2*sin(2*PI*(173*t+83*t*t))+0.08*sin(2*PI*911*t):s=48000:d=3.2", "-c:a", "aac", "-b:a", "192k", "source.m4a");
    core.FS.writeFile("input-0", core.FS.readFile("source.m4a"));
    run("-i", "source.m4a", "-af", "atrim=start=0:end=3.2", "-ac", "2", "-f", "f32le", "reference.pcm");
  }, 20000);
  afterAll(() => vi.unstubAllGlobals());

  it("keeps fractional cuts and deliberate gaps sample-aligned without limiter delay", () => {
    const asset = { id: "audio", name: "source", kind: "audio", status: "ready" } as Asset;
    const sections = [
      { start: 0, inPoint: 0, duration: 0.731 },
      { start: 0.731, inPoint: 0.731, duration: 1.169 },
      { start: 2.1, inPoint: 2.03, duration: 0.7 },
    ];
    const project: EditProject = {
      id: "audio-clock", template: "blank", status: "editing", platform: "instagram",
      playhead: 0, createdAt: "2026-11-11T00:00:00Z", updatedAt: "2026-11-11T00:00:00Z",
      proposedChanges: [], qualitySignals: [], revisions: [],
      title: "Audio clock", aspectRatio: "9:16", duration: 3, transcript: [],
      clips: sections.map((c, i) => ({ ...c, id: `c${i}`, label: `Section ${i}`, outPoint: c.inPoint + c.duration, locked: false, color: "blue", assetId: asset.id, track: "audio", speed: 1, volume: 1 })),
    };
    const plan = buildRenderPlan(project, [asset], new Set([asset.id]));
    const filterIndex = plan.args.indexOf("-filter_complex");
    const filters = plan.args[filterIndex + 1].split(";").filter(f => /\[(?:silence|a\d+|audio)\]$/.test(f));
    run(...plan.args.slice(0, filterIndex), "-filter_complex", filters.join(";"), "-map", "[audio]", "-ac", "2", "-f", "f32le", "result.pcm");
    const expected = pcm("reference.pcm"), actual = pcm("result.pcm");
    for (const section of sections) {
      let dot = 0, a = 0, b = 0;
      const start = Math.round(section.start * 48000) * 2;
      const source = Math.round(section.inPoint * 48000) * 2;
      const length = Math.round(section.duration * 48000) * 2;
      for (let i = 0; i < length; i++) {
        const x = expected[source + i], y = actual[start + i];
        dot += x * y; a += x * x; b += y * y;
      }
      expect(dot / Math.sqrt(a * b)).toBeGreaterThan(0.9999);
    }
    const gap = actual.slice(Math.round(1.91 * 48000) * 2, Math.round(2.09 * 48000) * 2);
    expect(Math.max(...gap.map(Math.abs))).toBeLessThan(0.00001);
  }, 20000);
});
