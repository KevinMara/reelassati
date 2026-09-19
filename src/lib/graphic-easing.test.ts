import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  GRAPHIC_EASINGS,
  graphicEasingProgress,
  graphicFrame,
  normalizeGraphic,
  type GraphicEasing,
} from "@contracts/motion-graphics";
import { graphicAssEvents } from "@/lib/graphic-ass";
import { buildRenderPlan } from "@/lib/render-plan";
import { spatialGraphicFrame } from "@contracts/spatial-graphics";
import type { EditProject, TimelineClip } from "@contracts/workspace";

const span = 4 + 1 / 30;
const makeGraphic = (easing?: GraphicEasing) =>
  normalizeGraphic({
    kind: "callout",
    animation: "none",
    text: "MOVE",
    size: 3,
    motion: [
      { at: 0, x: 20, y: 40, scale: 1, rotation: 0, easing },
      { at: 1, x: 80, y: 60, scale: 2, rotation: 90 },
    ],
  })!;
const makeClip = (easing?: GraphicEasing): TimelineClip => ({
  id: "motion",
  track: "overlay",
  label: "Motion",
  start: 0,
  duration: span,
  inPoint: 0,
  outPoint: span,
  locked: false,
  color: "#FFFFFF",
  graphic: makeGraphic(easing),
});

describe("graphic motion easing", () => {
  it("keeps existing paths linear and preserves an exact end pose for every mode", () => {
    expect(graphicFrame(makeGraphic(), 1, span).x).toBe(35);
    for (const easing of GRAPHIC_EASINGS) {
      const graphic = makeGraphic(easing);
      expect(normalizeGraphic(graphic)).toEqual(graphic);
      expect(graphicFrame(graphic, 0, span)).toMatchObject({
        x: 20,
        y: 40,
        scale: 1,
        rotation: 0,
      });
      expect(graphicFrame(graphic, 4, span)).toMatchObject({
        x: 80,
        y: 60,
        scale: 2,
        rotation: 90,
      });
    }
  });

  it("gives different deliberate trajectories for acceleration, deceleration and smooth motion", () => {
    expect(graphicFrame(makeGraphic("ease-in"), 1, span).x).toBeCloseTo(
      20.9375
    );
    expect(graphicFrame(makeGraphic("ease-out"), 1, span).x).toBeCloseTo(
      54.6875
    );
    expect(graphicFrame(makeGraphic("ease-in-out"), 1, span).x).toBeCloseTo(
      23.75
    );
    expect(graphicFrame(makeGraphic("ease-in-out"), 3, span).x).toBeCloseTo(
      76.25
    );
    expect(graphicFrame(makeGraphic("hold"), 3, span)).toMatchObject({
      x: 20,
      y: 40,
      scale: 1,
      rotation: 0,
    });
  });

  it("uses the departing key's curve and lands exactly on an intermediate hold boundary", () => {
    const graphic = normalizeGraphic({
      ...makeGraphic(),
      motion: [
        { at: 0, x: 20, y: 40, easing: "hold" },
        { at: 0.5, x: 60, y: 50, easing: "ease-in" },
        { at: 1, x: 80, y: 60 },
      ],
    })!;
    expect(graphicFrame(graphic, 1, span).x).toBe(20);
    expect(graphicFrame(graphic, 2, span).x).toBe(60);
    expect(graphicFrame(graphic, 3, span).x).toBe(62.5);
  });

  it("rejects unknown easing values and keeps every curve bounded and monotonic", () => {
    const graphic = normalizeGraphic({
      ...makeGraphic(),
      motion: [{ at: 0, easing: "run-script" }],
    })!;
    expect(graphic.motion![0].easing).toBeUndefined();
    for (const easing of GRAPHIC_EASINGS) {
      const samples = Array.from({ length: 101 }, (_, i) =>
        graphicEasingProgress(i / 100, easing)
      );
      expect(samples[0]).toBe(0);
      expect(samples[100]).toBe(1);
      for (let i = 1; i < samples.length; i++) {
        expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
        expect(samples[i]).toBeLessThanOrEqual(1);
      }
    }
    expect(graphicEasingProgress(NaN, "ease-out")).toBe(0);
  });

  it("exports the preview's eased frame and preserves the animation clock after trimming", () => {
    const clip = makeClip("ease-in");
    const frame = graphicFrame(clip.graphic!, 1, span);
    const ass = graphicAssEvents([clip], 720, 720, span);
    expect(ass).toContain(
      `\\pos(${Math.round(frame.x * 7.2)},${Math.round(frame.y * 7.2)})\\frz${-Math.round(frame.rotation * 1000) / 1000}`
    );
    const trimmed = {
      ...clip,
      start: 1,
      inPoint: 1,
      duration: 2,
      outPoint: 3,
      graphicDuration: span,
    };
    const trimmedAss = graphicAssEvents([trimmed], 720, 720, span);
    expect(trimmedAss.split("\n")[0]).toContain(
      `\\pos(${Math.round(frame.x * 7.2)},${Math.round(frame.y * 7.2)})`
    );
  });

  it("preserves spatial settings while applying the same eased position to 3D objects", () => {
    const graphic = normalizeGraphic({
      ...makeGraphic("ease-out"),
      kind: "spatial-cube",
      spatial: { pitch: -18, yaw: 25, depth: 0.35, turns: 0.5, perspective: 7 },
    })!;
    expect(normalizeGraphic(graphic)?.spatial).toEqual(graphic.spatial);
    const spatial = spatialGraphicFrame(graphic, 1, span);
    const frame = graphicFrame(graphic, 1, span);
    expect(spatial.x).toBe(frame.x);
    expect(spatial.y).toBe(frame.y);
    expect(spatial.faces.length).toBeGreaterThan(0);
  });
});

let ffmpegAvailable = false;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  ffmpegAvailable = true;
} catch {
  /* native renderer optional */
}

it.skipIf(!ffmpegAvailable)(
  "encodes an eased trajectory into an MP4 at the expected screen positions",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "reelassati-easing-"));
    try {
      const clip = makeClip("ease-in");
      clip.graphic = normalizeGraphic({
        ...clip.graphic,
        motion: [
          { at: 0, x: 20, y: 50, scale: 1, rotation: 0, easing: "ease-in" },
          { at: 1, x: 80, y: 50, scale: 1, rotation: 0 },
        ],
      })!;
      const project = {
        duration: span,
        aspectRatio: "1:1",
        clips: [clip],
        transcript: [],
        proposedChanges: [],
      } as unknown as EditProject;
      const plan = buildRenderPlan(project, [], new Set());
      writeFileSync(join(dir, "captions.ass"), plan.ass);
      copyFileSync("public/fonts/DejaVuSans.ttf", join(dir, "DejaVuSans.ttf"));
      execFileSync("ffmpeg", ["-v", "error", ...plan.args], {
        cwd: dir,
        timeout: 60000,
      });
      for (const time of [1, 2, 3]) {
        const bytes = execFileSync(
          "ffmpeg",
          [
            "-v",
            "error",
            "-ss",
            String(time),
            "-i",
            "output.mp4",
            "-frames:v",
            "1",
            "-vf",
            "scale=100:100,format=gray",
            "-f",
            "rawvideo",
            "-",
          ],
          { cwd: dir }
        );
        let moment = 0,
          mass = 0;
        for (let i = 0; i < bytes.length; i++)
          if (bytes[i] > 30) {
            moment += (i % 100) * bytes[i];
            mass += bytes[i];
          }
        expect(mass).toBeGreaterThan(0);
        expect(
          Math.abs(moment / mass - graphicFrame(clip.graphic, time, span).x)
        ).toBeLessThan(2);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  65000
);
