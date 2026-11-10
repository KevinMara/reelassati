import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  analysisProxyArguments,
  analysisProxyDimensions,
  analysisProxyVideoBitrate,
  probeAnalysisVideo,
  readAnalysisSourceMetadata,
  verifyAnalysisProxy,
} from "./analysis-proxy";
import {
  readMp4VideoTiming,
  readMp4VideoTimingByRange,
  sameAnalysisVideoTiming,
} from "@contracts/analysis-proxy";
import { verifyFullFrameAnalysisProxy } from "../../sites/analysis-media";

it("requires readable video, bounded duration and decoded frame timing", () => {
  expect(() =>
    readAnalysisSourceMetadata({
      format: { duration: 30 },
      streams: [{ codec_type: "audio" }],
    })
  ).toThrow("picture");
  expect(() => readAnalysisSourceMetadata({ error: { code: 1 } })).toThrow(
    "inspected"
  );
  expect(() =>
    readAnalysisSourceMetadata({
      format: { duration: 1801 },
      streams: [{ codec_type: "video", width: 1920, height: 1080 }],
    })
  ).toThrow("30 minutes");
  expect(() =>
    readAnalysisSourceMetadata({
      format: { duration: 30 },
      streams: [{ codec_type: "video", width: 1920, height: 1080 }],
    })
  ).toThrow("frame timing");
});
it("budgets complete audio and rejects unusable bitrate without discarding the tail", () => {
  expect(
    analysisProxyVideoBitrate({ duration: 30, hasAudio: true })
  ).toBeGreaterThan(4_000_000);
  expect(
    analysisProxyVideoBitrate({ duration: 600, hasAudio: true })
  ).toBeLessThan(200_000);
  expect(() =>
    analysisProxyVideoBitrate({ duration: 1800, hasAudio: true })
  ).toThrow(/no section/i);
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
describe("installed browser engine full-frame analysis copy", () => {
  let core: Core;
  const run = (...args: string[]) => {
    core.exec(...args);
    const code = core.ret;
    core.reset();
    return code;
  };
  const bytes = (path: string): Uint8Array => {
    const value = core.FS.readFile(path);
    if (typeof value === "string") throw new Error("Fixture missing");
    return value;
  };
  const buffer = (path: string): ArrayBuffer =>
    bytes(path).slice().buffer as ArrayBuffer;
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
  const fixture = (rate: number, filter = "null") => {
    expect(
      run(
        "-y",
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        `color=red:s=96x160:r=${rate}:d=1.5`,
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=1.5",
        "-vf",
        filter,
        "-fps_mode",
        "passthrough",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "source.mp4"
      )
    ).toBe(0);
    core.FS.writeFile("/source/media", bytes("source.mp4"));
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
  }, 15000);
  afterAll(() => vi.unstubAllGlobals());

  it.each([
    { rate: 24, filter: "setsar=2", frames: 36, aspect: 1.2 },
    { rate: 30, filter: "null", frames: 45, aspect: 0.6 },
    { rate: 60, filter: "null", frames: 90, aspect: 0.6 },
  ])(
    "preserves $frames frames at $rate fps, aspect and full audio without padding",
    async ({ rate, filter, frames, aspect }) => {
      fixture(rate, filter);
      const source = await probeAnalysisVideo(engine, "/source/media");
      expect(source.frameTimes.length).toBe(frames);
      expect(source.hasAudio).toBe(true);
      expect(source.audioDuration).toBeCloseTo(1.5, 2);
      const args = analysisProxyArguments(source);
      expect(args.slice(args.indexOf("-c:a"), args.indexOf("-c:a") + 2)).toEqual(["-c:a", "copy"]);
      expect(args).not.toContain("-t");
      expect(args).not.toContain("-ss");
      expect(args).not.toContain("-shortest");
      expect(args.join(" ")).not.toMatch(/pad=|fps=/);
      expect(run(...args)).toBe(0);
      const proxy = await probeAnalysisVideo(engine, "output.mp4");
      expect(proxy.frameTimes.length).toBe(frames);
      expect(proxy.hasAudio).toBe(true);
      expect(proxy.audioDuration).toBeCloseTo(source.audioDuration!, 1);
      expect(proxy.displayAspect).toBeCloseTo(aspect, 3);
      expect(() => verifyAnalysisProxy(source, proxy)).not.toThrow();
      const originalBytes = buffer("source.mp4"),
        proxyBytes = buffer("output.mp4");
      const originalTiming = readMp4VideoTiming(originalBytes),
        proxyTiming = readMp4VideoTiming(proxyBytes);
      expect(originalTiming).not.toBeNull();
      expect(proxyTiming).not.toBeNull();
      expect(sameAnalysisVideoTiming(originalTiming!, proxyTiming!)).toBe(true);
      const reads: Array<{ offset: number; length: number }> = [];
      const read = async (offset: number, length: number) => {
        reads.push({ offset, length });
        return originalBytes.slice(offset, offset + length);
      };
      expect(
        await verifyFullFrameAnalysisProxy(
          { version: "full-frame-v1" },
          proxyBytes,
          { size: originalBytes.byteLength, contentType: "video/mp4", read }
        )
      ).not.toBeNull();
      expect(reads.reduce((sum, item) => sum + item.length, 0)).toBeLessThan(
        originalBytes.byteLength
      );
      expect(
        await verifyFullFrameAnalysisProxy(undefined, proxyBytes, {
          size: originalBytes.byteLength,
          contentType: "video/mp4",
          read,
        })
      ).toBeNull();
      expect(
        await verifyFullFrameAnalysisProxy(
          { version: "full-frame-v1" },
          proxyBytes,
          { size: originalBytes.byteLength, contentType: "video/webm", read }
        )
      ).toBeNull();
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
      const frame = bytes("frame.rgb");
      for (const [x, y] of [
        [0, 0],
        [proxy.width - 1, 0],
        [0, proxy.height - 1],
        [proxy.width - 1, proxy.height - 1],
      ])
        expect(frame[(y * proxy.width + x) * 3]).toBeGreaterThan(100);
      const hd = {
        ...source,
        width: 2160,
        height: 3840,
        displayAspect: 0.5625,
      };
      expect(
        Math.max(...Object.values(analysisProxyDimensions(hd, 2_000_000)))
      ).toBe(1080);
      expect(
        Math.max(...Object.values(analysisProxyDimensions(hd, 500_000)))
      ).toBe(720);
    },
    20000
  );

  it("preserves variable cadence and rejects equal-count cadence/aspect mismatches", async () => {
    fixture(30, "select='not(mod(n,2))+not(mod(n,5))'");
    const source = await probeAnalysisVideo(engine, "/source/media");
    expect(source.frameTimes.length).toBeLessThan(45);
    expect(run(...analysisProxyArguments(source))).toBe(0);
    const proxy = await probeAnalysisVideo(engine, "output.mp4");
    expect(() => verifyAnalysisProxy(source, proxy)).not.toThrow();
    const originalTiming = readMp4VideoTiming(buffer("source.mp4"))!,
      proxyTiming = readMp4VideoTiming(buffer("output.mp4"))!;
    expect(sameAnalysisVideoTiming(originalTiming, proxyTiming)).toBe(true);
    const altered = proxy.frameTimes.slice();
    altered[2] += 0.01;
    expect(() =>
      verifyAnalysisProxy(source, { ...proxy, frameTimes: altered })
    ).toThrow("cadence");
    expect(
      sameAnalysisVideoTiming(originalTiming, {
        ...proxyTiming,
        displayAspect: 1,
      })
    ).toBe(false);
    expect(
      sameAnalysisVideoTiming(originalTiming, {
        ...proxyTiming,
        frameTimes: proxyTiming.frameTimes.slice(1),
      })
    ).toBe(false);
  }, 20000);

  it("preserves a silent source without creating an audio track and rejects forged full-frame descriptors", async () => {
    expect(
      run(
        "-y",
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=blue:s=160x96:r=30:d=1.5",
        "-c:v",
        "libx264",
        "silent.mp4"
      )
    ).toBe(0);
    core.FS.writeFile("/source/media", bytes("silent.mp4"));
    const source = await probeAnalysisVideo(engine, "/source/media");
    expect(source.audioDuration).toBeNull();
    expect(run(...analysisProxyArguments(source))).toBe(0);
    const proxy = await probeAnalysisVideo(engine, "output.mp4");
    expect(proxy.audioDuration).toBeNull();
    expect(() => verifyAnalysisProxy(source, proxy)).not.toThrow();
    const original = buffer("silent.mp4");
    const read = async (offset: number, length: number) =>
      original.slice(offset, offset + length);
    expect(
      await verifyFullFrameAnalysisProxy(
        { version: "full-frame-v1" },
        buffer("output.mp4"),
        { size: original.byteLength, contentType: "video/mp4", read }
      )
    ).not.toBeNull();
    // Different cadence is rejected from actual sample tables despite the descriptor.
    fixture(24);
    expect(
      await verifyFullFrameAnalysisProxy(
        { version: "full-frame-v1" },
        buffer("source.mp4"),
        { size: original.byteLength, contentType: "video/mp4", read }
      )
    ).toBeNull();
    // AAC priming/edit lists in the audible fixtures are parsed; a missing audio track is not equivalent.
    const audible = readMp4VideoTiming(buffer("source.mp4"))!;
    expect(audible.audioDuration).toBeCloseTo(1.5, 2);
    expect(
      sameAnalysisVideoTiming(audible, { ...audible, audioDuration: null })
    ).toBe(false);
    for (const name of ["stts", "ctts", "stsz"]) {
      const corrupt = new Uint8Array(buffer("source.mp4")),
        tag = new TextEncoder().encode(name);
      const index = corrupt.findIndex((_, offset) =>
        tag.every((byte, i) => corrupt[offset + i] === byte)
      );
      expect(index).toBeGreaterThan(0);
      new DataView(corrupt.buffer).setUint32(
        index + (name === "stsz" ? 12 : 8),
        0xffffffff
      );
      expect(readMp4VideoTiming(corrupt.buffer)).toBeNull();
    }
  }, 20000);

  it("handles rotation and rejects truncated, oversize or inconsistent MP4 tables", async () => {
    fixture(30);
    expect(
      run(
        "-y",
        "-v",
        "error",
        "-i",
        "source.mp4",
        "-c",
        "copy",
        "-metadata:s:v:0",
        "rotate=90",
        "rotated.mp4"
      )
    ).toBe(0);
    core.FS.writeFile("/source/media", bytes("rotated.mp4"));
    const source = await probeAnalysisVideo(engine, "/source/media");
    expect(source.displayAspect).toBeCloseTo(1 / 0.6, 3);
    expect(run(...analysisProxyArguments(source))).toBe(0);
    const proxy = await probeAnalysisVideo(engine, "output.mp4");
    expect(() => verifyAnalysisProxy(source, proxy)).not.toThrow();
    const originalTiming = readMp4VideoTiming(buffer("rotated.mp4"))!,
      proxyTiming = readMp4VideoTiming(buffer("output.mp4"))!;
    expect(originalTiming.rotation).not.toBe(0);
    expect(sameAnalysisVideoTiming(originalTiming, proxyTiming)).toBe(true);
    const data = buffer("output.mp4");
    expect(readMp4VideoTiming(data.slice(0, data.byteLength - 3))).toBeNull();
    const corrupt = new Uint8Array(data.slice(0)),
      tag = new TextEncoder().encode("stts");
    const index = corrupt.findIndex((_, offset) =>
      tag.every((byte, i) => corrupt[offset + i] === byte)
    );
    new DataView(corrupt.buffer).setUint32(index + 8, 0xffffffff);
    expect(readMp4VideoTiming(corrupt.buffer)).toBeNull();
    const huge = new Uint8Array(16);
    new DataView(huge.buffer).setUint32(0, 9 * 1024 * 1024);
    huge.set(new TextEncoder().encode("moov"), 4);
    const read = vi.fn(async () => huge.buffer);
    expect(await readMp4VideoTimingByRange(10 * 1024 * 1024, read)).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
    // Range scanning must inspect boxes after moov too; a second movie header
    // or a later fragment cannot be hidden behind an initially valid table.
    const original = buffer("output.mp4");
    const duplicate = new Uint8Array(original.byteLength * 2);
    duplicate.set(new Uint8Array(original));
    duplicate.set(new Uint8Array(original), original.byteLength);
    expect(
      await readMp4VideoTimingByRange(
        duplicate.length,
        async (offset, length) =>
          duplicate.slice(offset, offset + length).buffer
      )
    ).toBeNull();
    const fragment = new Uint8Array(original.byteLength + 8);
    fragment.set(new Uint8Array(original));
    new DataView(fragment.buffer).setUint32(original.byteLength, 8);
    fragment.set(new TextEncoder().encode("moof"), original.byteLength + 4);
    expect(
      await readMp4VideoTimingByRange(
        fragment.length,
        async (offset, length) => fragment.slice(offset, offset + length).buffer
      )
    ).toBeNull();
  }, 20000);

  it("prepares a non-MP4 source while keeping server metadata coverage unverified", async () => {
    expect(
      run(
        "-y",
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=blue:s=160x96:r=30:d=1.5",
        "-c:v",
        "libvpx",
        "source.webm"
      )
    ).toBe(0);
    core.FS.writeFile("/source/media", bytes("source.webm"));
    const source = await probeAnalysisVideo(engine, "/source/media");
    expect(source.frameTimes.length).toBe(45);
    expect(run(...analysisProxyArguments(source))).toBe(0);
    expect(() => verifyAnalysisProxy(source, source)).not.toThrow();
    const proxy = await probeAnalysisVideo(engine, "output.mp4");
    expect(() => verifyAnalysisProxy(source, proxy)).not.toThrow();
    const read = vi.fn(async () => null);
    expect(
      await verifyFullFrameAnalysisProxy(
        { version: "full-frame-v1" },
        buffer("output.mp4"),
        { size: bytes("source.webm").length, contentType: "video/webm", read }
      )
    ).toBeNull();
    expect(read).not.toHaveBeenCalled();
  }, 20000);
});
