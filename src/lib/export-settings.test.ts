import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  exportDimensions,
  resolveExportSettings,
  type ExportSettings,
} from "@contracts/export-settings";
import type { Asset, EditProject } from "@contracts/workspace";
import { buildRenderPlan } from "./render-plan";
import {
  verifyExportContainer,
  verifyExportMetadata,
} from "./export-verification";

const assets = [{ id: "source", kind: "video", status: "ready" }] as Asset[];
const project = (duration = 0.2): EditProject => ({
  id: "export-project",
  title: "Export settings fixture",
  template: "blank",
  status: "editing",
  platform: "youtube",
  playhead: 0,
  createdAt: "2026-10-07T00:00:00.000Z",
  updatedAt: "2026-10-07T00:00:00.000Z",
  proposedChanges: [],
  qualitySignals: [],
  revisions: [],
  duration,
  aspectRatio: "16:9",
  transcript: [],
  clips: [
    {
      id: "shot",
      label: "Source shot",
      color: "#4f46e5",
      assetId: "source",
      track: "video",
      start: 0,
      duration,
      inPoint: 0,
      outPoint: duration,
      fit: "cover",
      locked: false,
    },
  ],
});
export const exportFixtures: ExportSettings[] = [
  ...([24, 25, 30, 60] as const).flatMap(frameRate =>
    (["mp4", "webm"] as const).map(format => ({
      resolution: 720 as const,
      frameRate,
      format,
    }))
  ),
  { resolution: 2160, frameRate: 24, format: "mp4" },
  { resolution: 2160, frameRate: 24, format: "webm" },
];

describe("export settings", () => {
  it("retains numeric caller defaults and honors the project's frame rate", () => {
    expect(resolveExportSettings()).toEqual({
      resolution: 720,
      frameRate: 30,
      format: "mp4",
    });
    const plan = buildRenderPlan(
      { ...project(), frameRate: 25 },
      assets,
      new Set(),
      1080
    );
    expect(plan).toMatchObject({
      width: 1920,
      height: 1080,
      frameRate: 25,
      format: "mp4",
      filename: "output.mp4",
      mimeType: "video/mp4",
    });
    expect(plan.args.join(" ")).toContain("fps=25");
    expect(
      buildRenderPlan({ ...project(), frameRate: 60 }, assets, new Set(), {
        frameRate: 24,
      }).frameRate
    ).toBe(24);
  });
  it("uses real 4K dimensions on all canvas orientations and rejects unsupported requests", () => {
    expect(exportDimensions("16:9", 2160)).toEqual({
      width: 3840,
      height: 2160,
    });
    expect(exportDimensions("9:16", 2160)).toEqual({
      width: 2160,
      height: 3840,
    });
    expect(exportDimensions("1:1", 2160)).toEqual({
      width: 2160,
      height: 2160,
    });
    expect(() => resolveExportSettings({ frameRate: 23 as 24 })).toThrow(
      /supported/
    );
    expect(() => resolveExportSettings(1440 as 720)).toThrow(/supported/);
    expect(() => resolveExportSettings({ format: "mov" as "mp4" })).toThrow(
      /supported/
    );
  });
  it("uses verified WebM encoders, MIME and extension without MP4-only muxer flags", () => {
    const plan = buildRenderPlan(project(), assets, new Set(), {
      format: "webm",
      frameRate: 60,
    });
    expect(plan).toMatchObject({
      format: "webm",
      mimeType: "video/webm",
      filename: "output.webm",
      extension: "webm",
    });
    expect(plan.args).toContain("libvpx");
    expect(plan.args).toContain("libvorbis");
    expect(plan.args).not.toContain("libopus");
    expect(plan.args).not.toContain("libvpx-vp9");
    expect(plan.args).not.toContain("-movflags");
  });
  it("rejects a misleading container name, fractional FPS or incorrect video duration", () => {
    const expected = {
      width: 1280,
      height: 720,
      duration: 0.2,
      format: "webm" as const,
      frameRate: 24 as const,
    };
    const video = {
      codec_type: "video",
      codec_name: "vp8",
      width: 1280,
      height: 720,
      avg_frame_rate: "24/1",
      r_frame_rate: "24/1",
      tags: { DURATION: "00:00:00.207" },
    };
    const probe = {
      format: { format_name: "matroska,webm", duration: 0.208 },
      streams: [video, { codec_type: "audio", codec_name: "vorbis" }],
    };
    expect(verifyExportMetadata(probe, expected).duration).toBe(0.208);
    for (const invalid of [
      { ...probe, format: { ...probe.format, format_name: "avi" } },
      { ...probe, streams: [{ ...video, avg_frame_rate: "24000/1001" }] },
      { ...probe, streams: [{ ...video, r_frame_rate: "0/0" }] },
      { ...probe, streams: [{ ...video, tags: { DURATION: "00:00:01" } }] },
      {
        ...probe,
        streams: [video, { codec_type: "audio", codec_name: "aac" }],
      },
    ])
      expect(() => verifyExportMetadata(invalid, expected)).toThrow(
        /did not pass/
      );
    const fakeHeader = new Uint8Array([
      0x1a,
      0x45,
      0xdf,
      0xa3,
      0x87,
      0x42,
      0x82,
      0x84,
      ...new TextEncoder().encode("mkv!"),
    ]);
    expect(() => verifyExportContainer(fakeHeader, "webm")).toThrow(
      /did not pass/
    );
  });
});

let nativeAvailable = false;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  nativeAvailable = true;
} catch {
  /* optional native integration */
}
it.skipIf(!nativeAvailable)(
  "exports actual MP4/WebM at every supported FPS and 4K, with matching headers and full decode",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "reel-export-settings-"));
    try {
      execFileSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          "color=red:s=64x64:d=0.5:r=30",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-f",
          "mp4",
          "input-0",
        ],
        { cwd: dir, timeout: 10000 }
      );
      for (const settings of exportFixtures) {
        const plan = buildRenderPlan(
          project(settings.resolution === 2160 ? 2 / 24 : 0.2),
          assets,
          new Set(),
          settings
        );
        execFileSync("ffmpeg", ["-v", "error", ...plan.args], {
          cwd: dir,
          timeout: 20000,
        });
        const probe = JSON.parse(
          execFileSync(
            "ffprobe",
            [
              "-v",
              "error",
              "-show_format",
              "-show_streams",
              "-of",
              "json",
              plan.filename,
            ],
            { cwd: dir, encoding: "utf8" }
          )
        );
        expect(verifyExportMetadata(probe, plan)).toMatchObject({
          width: plan.width,
          height: plan.height,
        });
        verifyExportContainer(
          readFileSync(join(dir, plan.filename)),
          plan.format
        );
        execFileSync(
          "ffmpeg",
          ["-v", "error", "-xerror", "-i", plan.filename, "-f", "null", "-"],
          { cwd: dir, timeout: 15000 }
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  45000
);
