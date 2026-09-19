import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  analysisProxyArguments,
  analysisProxyVideoBitrate,
  readAnalysisSourceMetadata,
} from "./analysis-proxy";
import { probeExportMetadata } from "./export-probe";

it("requires actual readable video and rejects unbounded duration without cutting the source", () => {
  expect(() =>
    readAnalysisSourceMetadata({
      format: { duration: 30 },
      streams: [{ codec_type: "audio" }],
    })
  ).toThrow("picture");
  expect(() =>
    readAnalysisSourceMetadata({ error: { code: 1 }, format: { duration: 30 } })
  ).toThrow("inspected");
  expect(() =>
    readAnalysisSourceMetadata({
      format: { duration: 1801 },
      streams: [{ codec_type: "video", width: 1920, height: 1080 }],
    })
  ).toThrow("30 minutes");
  expect(
    readAnalysisSourceMetadata({
      format: { duration: "28.35" },
      streams: [
        { codec_type: "video", width: 1920, height: 1080 },
        { codec_type: "audio" },
      ],
    })
  ).toEqual({ duration: 28.35, hasAudio: true });
});

it("budgets full-length audio and rejects quality below its floor instead of truncating", () => {
  expect(analysisProxyVideoBitrate({ duration: 30, hasAudio: true })).toBe(
    650000
  );
  expect(
    analysisProxyVideoBitrate({ duration: 600, hasAudio: true })
  ).toBeLessThan(200000);
  expect(() =>
    analysisProxyVideoBitrate({ duration: 1800, hasAudio: true })
  ).toThrow(/no section/i);
  const args = analysisProxyArguments({ duration: 28.35, hasAudio: true });
  expect(args).not.toContain("-t");
  expect(args).not.toContain("-ss");
  expect(args).not.toContain("-shortest");
  expect(args).toContain("0:a:0?");
});

type Core = {
  ret: number;
  exec: (...args: string[]) => void;
  ffprobe: (...args: string[]) => void;
  reset: () => void;
  setLogger: (logger: (event: unknown) => void) => void;
  FS: {
    mkdir: (path: string) => void;
    readFile: (
      path: string,
      options?: { encoding: "utf8" }
    ) => Uint8Array | string;
    writeFile: (path: string, bytes: Uint8Array) => void;
    unlink: (path: string) => void;
  };
};

describe("installed browser engine analysis copy", () => {
  let core: Core;
  const run = (...args: string[]) => {
    core.exec(...args);
    const code = core.ret;
    core.reset();
    return code;
  };
  const probe = (path: string) => {
    core.ffprobe(
      "-v",
      "error",
      "-show_error",
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      path,
      "-o",
      "metadata.json"
    );
    core.reset();
    const text = core.FS.readFile("metadata.json", { encoding: "utf8" });
    core.FS.unlink("metadata.json");
    if (typeof text !== "string") throw new Error("Metadata missing");
    return JSON.parse(text);
  };
  beforeAll(async () => {
    vi.stubGlobal("self", { location: { href: "file:///ffmpeg-core.js" } });
    const require = createRequire(import.meta.url);
    const path = require.resolve("@ffmpeg/core");
    core = await require(path)({
      wasmBinary: readFileSync(join(dirname(path), "ffmpeg-core.wasm")),
    });
    core.setLogger(() => {});
    core.FS.mkdir("/source");
    expect(
      run(
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=red:s=64x96:r=24:d=1.5",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=1.5",
        "-vf",
        "setsar=2",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "source.mp4"
      )
    ).toBe(0);
    const bytes = core.FS.readFile("source.mp4");
    if (typeof bytes === "string") throw new Error("Video fixture missing");
    core.FS.writeFile("/source/media", bytes);
  }, 15000);
  afterAll(() => vi.unstubAllGlobals());

  it("keeps complete video/audio duration, preserves display aspect and produces an 8 fps decodable MP4", async () => {
    const source = readAnalysisSourceMetadata(probe("/source/media"));
    expect(run(...analysisProxyArguments(source))).toBe(0);
    const report = probe("output.mp4");
    const video = report.streams.find(
      (stream: { codec_type: string }) => stream.codec_type === "video"
    );
    const audio = report.streams.find(
      (stream: { codec_type: string }) => stream.codec_type === "audio"
    );
    expect(video).toMatchObject({
      codec_name: "h264",
      width: 360,
      height: 360,
      r_frame_rate: "8/1",
      sample_aspect_ratio: "1:1",
    });
    expect(audio).toMatchObject({
      codec_name: "aac",
      channels: 1,
      sample_rate: "24000",
    });
    expect(Number(audio.duration)).toBeCloseTo(source.duration, 1);
    const engine = {
      async ffprobe(args: string[]) {
        core.ffprobe(...args);
        const code = core.ret;
        core.reset();
        return code;
      },
      async readFile(path: string, encoding: "utf8") {
        return core.FS.readFile(path, { encoding });
      },
      async deleteFile(path: string) {
        core.FS.unlink(path);
        return true;
      },
    };
    const verified = await probeExportMetadata(engine, {
      width: 360,
      height: 360,
      duration: source.duration,
    });
    expect(verified.duration).toBeCloseTo(source.duration, 1);
    expect(
      run(
        "-v",
        "error",
        "-xerror",
        "-i",
        "output.mp4",
        "-map",
        "0:v:0",
        "-map",
        "0:a:0",
        "-f",
        "null",
        "-"
      )
    ).toBe(0);
    // Anamorphic input 64x96 with SAR=2 has DAR=4:3: expected image height is 270, not 360.
    expect(
      run(
        "-y",
        "-v",
        "error",
        "-i",
        "output.mp4",
        "-frames:v",
        "1",
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        "frame.rgb"
      )
    ).toBe(0);
    const frame = core.FS.readFile("frame.rgb");
    if (typeof frame === "string") throw new Error("Frame missing");
    const redRows = Array.from({ length: 360 }, (_, y) =>
      frame[(y * 360 + 180) * 3] > 100 ? y : -1
    ).filter(y => y >= 0);
    expect(Math.min(...redRows)).toBeGreaterThanOrEqual(44);
    expect(Math.max(...redRows)).toBeLessThanOrEqual(315);
    expect(redRows.length).toBeGreaterThanOrEqual(268);
  }, 20000);
});
