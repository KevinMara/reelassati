import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Asset, EditProject } from "@contracts/workspace";
import { buildRenderPlan } from "./render-plan";

const assets = [
  {
    id: "video",
    name: "Clip",
    kind: "video",
    status: "ready",
    size: 100,
    contentType: "video/mp4",
  },
  {
    id: "voice",
    name: "Voice",
    kind: "audio",
    status: "ready",
    size: 100,
    contentType: "audio/wav",
  },
] as Asset[];
const project = {
  title: "Render test",
  aspectRatio: "9:16",
  transcript: [{ start: 0, end: 2, text: "A real caption" }],
  clips: [
    {
      assetId: "video",
      track: "video",
      start: 0,
      inPoint: 0,
      duration: 2,
      speed: 1,
      muted: true,
    },
    {
      assetId: "video",
      track: "video",
      start: 3,
      inPoint: 0,
      duration: 1,
      speed: 2,
    },
    {
      assetId: "voice",
      track: "audio",
      start: 1,
      inPoint: 0,
      duration: 2,
      volume: 0.5,
    },
  ],
} as EditProject;

describe("timeline rendering", () => {
  it("rejects missing media and unsafe timelines instead of silently omitting clips", () => {
    expect(() => buildRenderPlan(project, [], new Set())).toThrow("missing");
    expect(() =>
      buildRenderPlan(
        { ...project, clips: [{ ...project.clips[0], start: 181 }] },
        assets,
        new Set()
      )
    ).toThrow("180");
    expect(() =>
      buildRenderPlan(
        { ...project, clips: [{ ...project.clips[0], speed: 0 }] },
        assets,
        new Set()
      )
    ).toThrow("invalid");
  });
  it("escapes subtitle override commands and handles silent video", () => {
    const plan = buildRenderPlan(
      {
        ...project,
        transcript: [
          { id: "x", start: 0, end: 2, text: "{\\pos(1,1)}Caption\nNext" },
        ],
      },
      assets,
      new Set(["voice"])
    );
    expect(plan.ass).not.toContain("{\\pos");
    expect(plan.ass).toContain("Caption\\NNext");
    expect(plan.args.join(" ")).not.toContain("[0:a]");
    expect(plan.args.join(" ")).toContain("[2:a]");
  });
  let nativeAvailable = false;
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    nativeAvailable = true;
  } catch {
    /* optional native integration check */
  }
  it.skipIf(!nativeAvailable)(
    "produces a decodable MP4 with cuts, a gap, mixed audio, speed changes and burned captions",
    () => {
      const dir = mkdtempSync(join(tmpdir(), "reelassati-render-"));
      try {
        execFileSync("ffmpeg", [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          "color=red:s=160x90:d=2:r=30",
          "-c:v",
          "libx264",
          join(dir, "input-0") + ".mp4",
        ]);
        copyFileSync(join(dir, "input-0.mp4"), join(dir, "input-0"));
        execFileSync("ffmpeg", [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=440:duration=2",
          join(dir, "input-1.wav"),
        ]);
        copyFileSync(join(dir, "input-1.wav"), join(dir, "input-1"));
        copyFileSync(
          "public/fonts/DejaVuSans.ttf",
          join(dir, "DejaVuSans.ttf")
        );
        const plan = buildRenderPlan(project, assets, new Set(["voice"]));
        writeFileSync(join(dir, "captions.ass"), plan.ass);
        execFileSync("ffmpeg", ["-v", "error", ...plan.args], {
          cwd: dir,
          timeout: 60000,
        });
        const result = JSON.parse(
          execFileSync(
            "ffprobe",
            [
              "-v",
              "error",
              "-show_streams",
              "-show_format",
              "-of",
              "json",
              join(dir, "output.mp4"),
            ],
            { encoding: "utf8" }
          )
        );
        expect(
          result.streams.find(
            (s: { codec_type: string }) => s.codec_type === "video"
          )
        ).toMatchObject({ codec_name: "h264", width: 720, height: 1280 });
        expect(
          result.streams.some(
            (s: { codec_type: string }) => s.codec_type === "audio"
          )
        ).toBe(true);
        expect(Number(result.format.duration)).toBeCloseTo(4, 1);
        execFileSync(
          "ffmpeg",
          ["-v", "error", "-i", join(dir, "output.mp4"), "-f", "null", "-"],
          { timeout: 30000 }
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    65000
  );
});
