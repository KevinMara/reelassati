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
  duration: 4,
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
      buildRenderPlan({ ...project, duration: -1 }, assets, new Set())
    ).toThrow("positive");
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
  it.skipIf(!nativeAvailable)(
    "composites numbered image/video lanes in order and keeps uncovered lower pixels visible",
    () => {
      const dir = mkdtempSync(join(tmpdir(), "reelassati-layers-"));
      try {
        execFileSync("ffmpeg", [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          "color=red:s=160x90:d=1:r=30",
          "-c:v",
          "libx264",
          join(dir, "red.mp4"),
        ]);
        execFileSync("ffmpeg", [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          "color=blue:s=40x40",
          "-frames:v",
          "1",
          "-threads",
          "1",
          join(dir, "blue.png"),
        ]);
        const layerAssets = [
          { ...assets[0], id: "red" },
          { ...assets[0], id: "blue", kind: "image", contentType: "image/png" },
        ] as Asset[];
        const layered = {
          ...project,
          aspectRatio: "16:9",
          duration: 1,
          transcript: [],
          clips: [
            {
              id: "top",
              assetId: "blue",
              track: "video",
              lane: 3,
              start: 0.25,
              inPoint: 0,
              outPoint: 0.5,
              duration: 0.5,
              fit: "contain",
              fadeIn: 0.2,
            },
            {
              id: "base",
              assetId: "red",
              track: "video",
              lane: 1,
              start: 0,
              inPoint: 0,
              outPoint: 1,
              duration: 1,
              fit: "cover",
            },
          ],
        } as unknown as EditProject;
        const plan = buildRenderPlan(layered, layerAssets, new Set());
        for (const [index, asset] of plan.inputs.entries())
          copyFileSync(
            join(dir, asset.id === "red" ? "red.mp4" : "blue.png"),
            join(dir, `input-${index}`)
          );
        writeFileSync(join(dir, "captions.ass"), plan.ass);
        execFileSync("ffmpeg", ["-v", "error", ...plan.args], {
          cwd: dir,
          timeout: 30000,
        });
        const pixel = (t: string, x: number) =>
          execFileSync("ffmpeg", [
            "-v",
            "error",
            "-ss",
            t,
            "-i",
            join(dir, "output.mp4"),
            "-vf",
            `crop=2:2:${x}:360,format=rgb24`,
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "pipe:1",
          ]);
        const before = pixel("0.1", 640),
          during = pixel("0.6", 640),
          fading = pixel("0.35", 640),
          edge = pixel("0.4", 100),
          after = pixel("0.9", 640);
        expect(before[0]).toBeGreaterThan(200);
        expect(during[2]).toBeGreaterThan(200);
        expect(during[0]).toBeLessThan(30);
        expect(fading[0]).toBeGreaterThan(40);
        expect(fading[2]).toBeGreaterThan(40);
        expect(edge[0]).toBeGreaterThan(200);
        expect(after[0]).toBeGreaterThan(200);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    40000
  );
});
