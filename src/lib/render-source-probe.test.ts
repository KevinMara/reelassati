import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import type { Asset, EditProject } from "@contracts/workspace";
import { buildRenderPlan } from "./render-plan";
import { probeRenderSource, terminalVideoPadding } from "./render-source-probe";

const header = (video = 1, audio = 1.12) => ({
  streams: [
    { codec_type: "video", start_time: "0", duration: String(video) },
    { codec_type: "audio", start_time: "0", duration: String(audio) },
  ],
  format: { duration: String(audio) },
});
const lastFrame = (start = 29 / 30) => ({
  frames: [
    {
      best_effort_timestamp_time: String(start),
      pkt_duration_time: String(1 / 30),
    },
  ],
});
function fakeEngine(reports: unknown[]) {
  let current: unknown;
  return {
    ffprobe: vi.fn(async () => {
      current = reports.shift();
      return -1;
    }),
    readFile: vi.fn(async () => JSON.stringify(current)),
    deleteFile: vi.fn(async () => true),
  };
}

describe("verified short source-video tails", () => {
  it("requires freshly decoded terminal frames and removes each fresh report", async () => {
    const engine = fakeEngine([header(), lastFrame()]);
    const metadata = await probeRenderSource(engine, "source");
    expect(metadata).toEqual({
      hasAudio: true,
      terminalVideo: {
        lastFrameStart: 29 / 30,
        videoEnd: 1,
        sourceEnd: 1.12,
      },
    });
    expect(engine.ffprobe).toHaveBeenCalledTimes(2);
    expect(engine.deleteFile).toHaveBeenCalledTimes(2);
    expect(engine.ffprobe.mock.calls[0]).not.toEqual(
      engine.ffprobe.mock.calls[1]
    );
    for (const speed of [0.25, 0.5, 1, 2, 4]) {
      const filter = terminalVideoPadding(
        { inPoint: 0.5, duration: 0.62 / speed, speed },
        metadata,
        30
      );
      expect(filter).toContain(`stop_duration=${(0.62 / speed).toFixed(6)}`);
      expect(filter).toContain(`trim=duration=${(0.62 / speed).toFixed(6)}`);
    }
    for (const clip of [
      { inPoint: 0, duration: 1 },
      { inPoint: 0, duration: 1.3 },
      { inPoint: 0.99, duration: 0.13 },
      { inPoint: 1, duration: 0.12 },
      { inPoint: 29 / 30, duration: 1.12 - 29 / 30 },
    ])
      expect(terminalVideoPadding(clip, metadata, 30)).toBe("");
  });

  it.each([
    ["large mismatch", header(1, 1.5), lastFrame()],
    ["zero-frame source", header(), { frames: [] }],
    ["truncated decoded tail", header(), lastFrame(0.5)],
    [
      "missing measured frame duration",
      header(),
      { frames: [{ best_effort_timestamp_time: "0.966667" }] },
    ],
    [
      "unknown stream duration",
      { ...header(), streams: [{ codec_type: "video" }, header().streams[1]] },
      lastFrame(),
    ],
    [
      "shifted clock",
      {
        ...header(),
        streams: [
          { ...header().streams[0], start_time: "0.2" },
          header().streams[1],
        ],
      },
      lastFrame(),
    ],
    [
      "container-only extension",
      { ...header(), format: { duration: "1.2" } },
      lastFrame(),
    ],
  ])("does not hold a %s", async (_name, first, tail) => {
    const result = await probeRenderSource(fakeEngine([first, tail]), "source");
    expect(result.terminalVideo).toBeUndefined();
  });

  it("rejects failed or stale probes rather than trusting asset duration", async () => {
    await expect(
      probeRenderSource(fakeEngine([{ error: { code: -1 } }]), "source")
    ).rejects.toThrow();
    await expect(
      probeRenderSource(fakeEngine([undefined]), "source")
    ).rejects.toThrow();
    const engine = fakeEngine([header(), lastFrame()]);
    engine.ffprobe.mockResolvedValue(1);
    await expect(probeRenderSource(engine, "source")).rejects.toThrow();
  });
});

let nativeAvailable = false;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
  nativeAvailable = true;
} catch {
  /* optional native integration check */
}

describe.skipIf(!nativeAvailable)(
  "actual source metadata and rendered terminal frames",
  () => {
    let dir: string;
    const nativeEngine = {
      async ffprobe(args: string[]) {
        execFileSync("ffprobe", args, { cwd: dir, timeout: 15000 });
        return 0;
      },
      async readFile(path: string) {
        return readFileSync(join(dir, path), "utf8");
      },
      async deleteFile(path: string) {
        rmSync(join(dir, path));
        return true;
      },
    };
    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), "reelassati-source-tail-"));
      execFileSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          "color=red:s=64x64:r=30:d=1,drawbox=c=blue:t=fill:enable='gte(t,0.9)'",
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=440:sample_rate=48000:duration=1.12",
          "-c:v",
          "libx264",
          "-c:a",
          "aac",
          "-pix_fmt",
          "yuv420p",
          "-f",
          "mp4",
          "input-0",
        ],
        { cwd: dir, timeout: 15000 }
      );
    }, 20000);
    afterAll(() => {
      // Only delete the checked, task-created temporary fixture directory.
      const absolute = resolve(dir);
      if (
        absolute.startsWith(resolve(tmpdir()) + sep) &&
        absolute.includes("reelassati-source-tail-")
      )
        rmSync(absolute, { recursive: true, force: true });
    });

    it("preserves the final blue frame and audio, respects speed/fades, and leaves gaps black", async () => {
      const metadata = await probeRenderSource(nativeEngine, "input-0");
      expect(metadata.terminalVideo?.sourceEnd).toBeCloseTo(1.12, 3);
      const asset = { id: "source", kind: "video", status: "ready" } as Asset;
      const project = {
        title: "Short terminal source mismatch",
        duration: 5,
        aspectRatio: "16:9",
        transcript: [],
        clips: [
          {
            id: "normal",
            assetId: "source",
            track: "video",
            start: 0.2,
            inPoint: 0,
            duration: 1.12,
            speed: 1,
          },
          {
            id: "fast",
            assetId: "source",
            track: "video",
            start: 1.5,
            inPoint: 0,
            duration: 0.56,
            speed: 2,
            fadeOut: 0.3,
          },
          {
            id: "slow",
            assetId: "source",
            track: "video",
            start: 2.4,
            inPoint: 0,
            duration: 2.24,
            speed: 0.5,
          },
        ],
      } as unknown as EditProject;
      const plan = buildRenderPlan(
        project,
        [asset],
        new Set([asset.id]),
        720,
        new Map([[asset.id, metadata]])
      );
      const filter = plan.args[plan.args.indexOf("-filter_complex") + 1];
      expect(filter).toContain("eof_action=pass:repeatlast=0");
      expect(filter).not.toContain("repeatlast=1");
      expect(plan.duration).toBe(5);
      execFileSync("ffmpeg", ["-v", "error", ...plan.args], {
        cwd: dir,
        timeout: 30000,
      });
      const pixel = (at: number) =>
        execFileSync(
          "ffmpeg",
          [
            "-v",
            "error",
            "-ss",
            String(at),
            "-i",
            "output.mp4",
            "-vf",
            "crop=2:2:640:360,format=rgb24",
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "pipe:1",
          ],
          { cwd: dir, timeout: 10000 }
        );
      for (const at of [1.27, 4.55]) {
        const rgb = pixel(at);
        expect(rgb[2]).toBeGreaterThan(200);
        expect(rgb[0]).toBeLessThan(30);
      }
      const faded = pixel(2.0);
      expect(faded[2]).toBeGreaterThan(15);
      expect(faded[2]).toBeLessThan(130);
      for (const at of [0.1, 1.4, 2.2, 4.8])
        expect(Math.max(...pixel(at))).toBeLessThan(10);
      const pcm = execFileSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-ss",
          "1.22",
          "-t",
          "0.07",
          "-i",
          "output.mp4",
          "-map",
          "0:a:0",
          "-ac",
          "1",
          "-f",
          "f32le",
          "pipe:1",
        ],
        { cwd: dir, timeout: 10000 }
      );
      const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      let energy = 0;
      for (let i = 0; i < pcm.length; i += 4)
        energy += view.getFloat32(i, true) ** 2;
      expect(Math.sqrt(energy / (pcm.length / 4))).toBeGreaterThan(0.03);
      const output = JSON.parse(
        execFileSync(
          "ffprobe",
          ["-v", "error", "-show_format", "-of", "json", "output.mp4"],
          { cwd: dir, encoding: "utf8" }
        )
      );
      expect(Number(output.format.duration)).toBeCloseTo(5, 2);
    }, 45000);

    it("probes and pads with the exact shipped browser WASM core", async () => {
      vi.stubGlobal("self", { location: { href: "file:///ffmpeg-core.js" } });
      try {
        const require = createRequire(import.meta.url);
        const corePath = require.resolve("@ffmpeg/core");
        const createCore = require(corePath);
        const core = await createCore({
          wasmBinary: readFileSync(join(dirname(corePath), "ffmpeg-core.wasm")),
        });
        core.setLogger(() => {});
        core.FS.writeFile("input-0", readFileSync(join(dir, "input-0")));
        const engine = {
          async ffprobe(args: string[]) {
            core.ffprobe(...args);
            const code = core.ret;
            core.reset();
            return code;
          },
          async readFile(path: string) {
            return core.FS.readFile(path, { encoding: "utf8" });
          },
          async deleteFile(path: string) {
            core.FS.unlink(path);
            return true;
          },
        };
        const metadata = await probeRenderSource(engine, "input-0");
        expect(metadata.terminalVideo).toMatchObject({
          videoEnd: 1,
          sourceEnd: 1.12,
        });
        const pad = terminalVideoPadding(
          { inPoint: 0, duration: 1.12 },
          metadata,
          30
        );
        core.exec(
          "-v",
          "error",
          "-i",
          "input-0",
          "-vf",
          `fps=30,${pad}format=rgb24`,
          "-an",
          "-f",
          "rawvideo",
          "frames.rgb"
        );
        expect(core.ret).toBe(0);
        core.reset();
        const bytes = core.FS.readFile("frames.rgb") as Uint8Array;
        expect(bytes.length / (64 * 64 * 3)).toBe(34);
        expect(bytes.at(-1)).toBeGreaterThan(200);
        expect(bytes.at(-3)).toBeLessThan(30);
        // STARTPTS normalization removes the fractional input-frame offset.
        // Even at 0.25x, terminal coverage must reach the exact declared clip end.
        const slow = {
          inPoint: 0.01,
          duration: (1.12 - 0.01) / 0.25,
          speed: 0.25,
        };
        const slowPad = terminalVideoPadding(slow, metadata, 30);
        core.exec(
          "-v",
          "error",
          "-i",
          "input-0",
          "-vf",
          `trim=start=0.01:end=1.12,setpts=(PTS-STARTPTS)/0.25,fps=30,${slowPad}format=rgb24`,
          "-an",
          "-f",
          "rawvideo",
          "slow.rgb"
        );
        expect(core.ret).toBe(0);
        core.reset();
        const slowBytes = core.FS.readFile("slow.rgb") as Uint8Array;
        expect(slowBytes.length / (64 * 64 * 3)).toBe(
          Math.ceil(slow.duration * 30)
        );
        expect(slowBytes.at(-1)).toBeGreaterThan(200);
      } finally {
        vi.unstubAllGlobals();
      }
    }, 15000);
  }
);
