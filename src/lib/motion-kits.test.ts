import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  MOTION_KITS,
  motionKitClips,
  type MotionKitDraft,
} from "@contracts/motion-kits";
import { graphicFrame } from "@contracts/motion-graphics";
import { expandLinkedSelection } from "@contracts/clip-groups";
import type { Asset, EditProject } from "@contracts/workspace";
import { insertMotionKit } from "./motion-kits";
import { buildRenderPlan } from "./render-plan";

const project = {
  id: "project",
  title: "Motion kit",
  duration: 5,
  aspectRatio: "16:9",
  transcript: [],
  clips: [],
} as unknown as EditProject;
const draft = (id: MotionKitDraft["kit"]): MotionKitDraft => ({
  kit: id,
  title: "YOUR STORY",
  subtitle: "A supporting line",
  seconds: 4,
  accent: "#7AF5CF",
  value: 42,
});
const logo = {
  id: "logo",
  name: "Logo",
  kind: "image",
  status: "ready",
  contentType: "image/png",
  size: 100,
  url: "/logo.png",
} as Asset;
describe("native browser motion kits", () => {
  it("all kits compile to real export operations in each canvas and animate from invisible to a held pose", () => {
    for (const kit of MOTION_KITS) {
      const clips = motionKitClips(draft(kit.id), [], 0, kit.id);
      for (const aspectRatio of ["16:9", "9:16", "1:1"] as const) {
        const plan = buildRenderPlan(
          { ...project, aspectRatio, clips },
          [],
          new Set()
        );
        expect(plan.inputs).toHaveLength(0);
        expect(plan.ass).toContain("A supporting line");
        expect(plan.args).toContain("output.mp4");
      }
      for (const clip of clips) {
        expect(graphicFrame(clip.graphic!, 0, 4).opacity).toBe(0);
        expect(graphicFrame(clip.graphic!, 2, 4).opacity).toBe(1);
      }
    }
  });
  it("preserves existing footage and selects the complete kit as a group with independent clocks and lanes", () => {
    const original = {
      ...project,
      clips: [
        {
          id: "existing",
          assetId: "logo",
          track: "video",
          start: 2,
          duration: 4,
          inPoint: 0,
          outPoint: 4,
          lane: 2,
        },
      ],
    } as EditProject;
    const inserted = insertMotionKit(
      original,
      [logo],
      { ...draft("brand-reveal"), logoAssetId: logo.id },
      2,
      "new"
    );
    expect(original.clips).toHaveLength(1);
    expect(inserted.clips[0]).toEqual(original.clips[0]);
    expect(inserted.duration).toBe(6);
    const added = inserted.clips.slice(1);
    expect(added.find(clip => clip.assetId)?.lane).toBe(3);
    expect(added.find(clip => clip.assetId)?.primaryFootage).toBe(false);
    expect(
      added.every(
        clip => clip.start === 2 && clip.inPoint === 0 && clip.duration === 4
      )
    ).toBe(true);
    expect(
      expandLinkedSelection(inserted, [added[0].id], {
        groups: true,
        links: true,
      }).sort()
    ).toEqual(added.map(clip => clip.id).sort());
    const plan = buildRenderPlan(inserted, [logo], new Set());
    expect(plan.inputs).toEqual([logo]);
    expect(plan.args.join(" ")).toContain("scale=230:130:flags=bilinear");
  });
  it("rejects unavailable logos and invalid durations or invented percentages before insertion", () => {
    expect(() =>
      motionKitClips(
        { ...draft("brand-reveal"), logoAssetId: "missing" },
        [],
        0,
        "bad"
      )
    ).toThrow("ready");
    expect(() =>
      motionKitClips(
        { ...draft("brand-reveal"), logoAssetId: logo.id },
        [{ ...logo, status: "processing" }],
        0,
        "bad"
      )
    ).toThrow("ready");
    expect(() =>
      motionKitClips({ ...draft("statistic"), value: NaN }, [], 0, "bad")
    ).toThrow("percentage");
    expect(() =>
      motionKitClips({ ...draft("chapter"), seconds: 0 }, [], 0, "bad")
    ).toThrow("duration");
  });
});

let nativeAvailable = false;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  nativeAvailable = true;
} catch {
  /* Optional developer dependency. */
}
it.skipIf(!nativeAvailable)(
  "encodes native motion-kit frames with a visible mid-animation accent and invisible opening",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "reelassati-kits-"));
    try {
      for (const kit of MOTION_KITS) {
        const clips = motionKitClips(draft(kit.id), [], 0, kit.id);
        const plan = buildRenderPlan(
          { ...project, aspectRatio: "1:1", clips },
          [],
          new Set()
        );
        writeFileSync(join(dir, "captions.ass"), plan.ass);
        for (const time of [0, 1]) {
          const pixels = execFileSync(
            "ffmpeg",
            [
              "-v",
              "error",
              "-f",
              "lavfi",
              "-i",
              "color=black:s=720x720:r=30:d=2",
              "-vf",
              "subtitles=captions.ass",
              "-ss",
              String(time),
              "-frames:v",
              "1",
              "-pix_fmt",
              "rgb24",
              "-f",
              "rawvideo",
              "pipe:1",
            ],
            { cwd: dir, maxBuffer: 2_000_000 }
          );
          const lit = pixels.filter(value => value > 90).length;
          if (time === 0) expect(lit, `${kit.id} opening`).toBe(0);
          else expect(lit, kit.id).toBeGreaterThan(100);
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  30000
);

it.skipIf(!nativeAvailable)(
  "exports a selected logo above the heading using the real image animation pipeline",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "reelassati-kit-logo-"));
    try {
      execFileSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          "color=white:s=80x80:d=1",
          "-frames:v",
          "1",
          "-c:v",
          "png",
          "-threads",
          "1",
          "-f",
          "image2",
          "input-0",
        ],
        { cwd: dir }
      );
      const clips = motionKitClips(
        { ...draft("brand-reveal"), seconds: 1, logoAssetId: logo.id },
        [logo],
        0,
        "rendered"
      );
      const plan = buildRenderPlan(
        { ...project, duration: 1, aspectRatio: "1:1", clips },
        [logo],
        new Set()
      );
      writeFileSync(join(dir, "captions.ass"), plan.ass);
      execFileSync("ffmpeg", ["-v", "error", ...plan.args], {
        cwd: dir,
        timeout: 25000,
      });
      const pixels = execFileSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-i",
          plan.filename,
          "-ss",
          "0.5",
          "-frames:v",
          "1",
          "-pix_fmt",
          "rgb24",
          "-f",
          "rawvideo",
          "pipe:1",
        ],
        { cwd: dir, maxBuffer: 2_000_000 }
      );
      const center = (Math.round(720 * 0.28) * 720 + 360) * 3;
      expect(pixels[center]).toBeGreaterThan(230);
      expect(pixels[center + 1]).toBeGreaterThan(230);
      expect(pixels[center + 2]).toBeGreaterThan(230);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  30000
);
