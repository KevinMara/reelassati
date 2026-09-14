import { it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { graphicFrame, normalizeGraphic } from "@contracts/motion-graphics";
import { normalizeReview } from "@contracts/source-review";
import type { EditProject, EditOperation } from "@contracts/workspace";
import { applyEditOperation } from "./edit-timeline";
import { buildRenderPlan } from "./render-plan";
import { verifyExportMetadata } from "./export-verification";
import { graphicAssEvents } from "./graphic-ass";

const project = {
  duration: 3,
  aspectRatio: "1:1",
  clips: [],
  transcript: [],
  proposedChanges: [],
} as unknown as EditProject;
const graphic = normalizeGraphic({
  kind: "counter",
  from: 0,
  to: 1000,
  prefix: "$",
  animation: "pop",
})!;
const operation = {
  id: "counter",
  type: "graphic",
  start: 1,
  end: 2,
  targetClipIds: [],
  parameters: { graphic },
} as unknown as EditOperation;

it("normalizes motion paths and uses the same position, rotation and scale for preview and export", () => {
  const g = normalizeGraphic({
    kind: "arrow",
    animation: "none",
    motion: [
      { at: 1, x: 80, y: 60, scale: 2, rotation: 90 },
      { at: 0, x: 20, y: 40, scale: 1, rotation: 0 },
      { at: NaN, x: 50 },
    ],
  })!;
  expect(g.motion?.map(p => p.at)).toEqual([0, 1]);
  expect(normalizeGraphic(g)).toEqual(g);
  const f = graphicFrame(g, 1, 2 + 1 / 30);
  expect(f.x).toBeCloseTo(50);
  expect(f.y).toBeCloseTo(50);
  expect(f.scale).toBeCloseTo(1.5);
  expect(f.rotation).toBeCloseTo(45);
  expect(graphicFrame(g, 3, 2 + 1 / 30)).toMatchObject({
    x: 80,
    y: 60,
    rotation: 90,
  });
  const clip = applyEditOperation(project, {
    ...operation,
    start: 0,
    end: 2 + 1 / 30,
    parameters: { graphic: g },
  }).clips[0];
  const ass = graphicAssEvents([clip], 720, 720, 3);
  expect(ass).toContain("\\pos(360,360)\\frz-45");
  expect(ass).toContain("\\fscx150\\fscy150");
  const bounded = normalizeGraphic({
    kind: "text",
    motion: [
      { at: 1, x: Infinity, scale: 100 },
      { at: 1, x: 900, rotation: -900 },
    ],
  })!;
  expect(bounded.motion).toHaveLength(1);
  expect(bounded.motion![0]).toMatchObject({ x: 100, rotation: -720 });
});

it("adds a bounded editable graphic without changing footage or the project end", () => {
  const next = applyEditOperation(project, operation);
  expect(next.duration).toBe(3);
  expect(next.clips[0]).toMatchObject({
    track: "overlay",
    start: 1,
    duration: 1,
    graphic,
  });
  expect(project.clips).toEqual([]);
  expect(graphicFrame(graphic, 0, 1)).toMatchObject({ text: "$0", opacity: 0 });
  expect(graphicFrame(graphic, 0.8, 1)).toMatchObject({
    text: "$1000",
    opacity: 1,
  });
});

it("does not turn incomplete analysis into claims that captions or audio are absent", () => {
  expect(normalizeReview({ captions: "probably", audio: false })).toMatchObject(
    { captions: "unknown", audio: "unknown" }
  );
  expect(
    normalizeReview({
      captions: "present",
      captionNote: "Subtitles visible at 1.0–2.0s",
    })
  ).toMatchObject({ captions: "present" });
});

it("rejects malformed graphics and neutralizes subtitle commands", () => {
  expect(normalizeGraphic({ kind: "execute-code" })).toBeUndefined();
  const next = applyEditOperation(project, {
    ...operation,
    parameters: {
      graphic: normalizeGraphic({ kind: "text", text: "{\\pos(1,1)}Unsafe" }),
    },
  });
  expect(buildRenderPlan(next, [], new Set()).ass).not.toContain(
    "{\\pos(1,1)}"
  );
  next.clips[0].duration = Infinity;
  expect(() => buildRenderPlan(next, [], new Set())).toThrow("invalid");
});

let nativeAvailable = false;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  nativeAvailable = true;
} catch {
  /* optional native integration */
}
it.skipIf(!nativeAvailable)(
  "renders a motion path at the expected positions in the encoded MP4",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "reelassati-motion-path-"));
    try {
      const next = applyEditOperation(project, {
        ...operation,
        start: 0.5,
        end: 2.5,
        parameters: {
          graphic: normalizeGraphic({
            kind: "callout",
            text: "MOVE",
            size: 5,
            animation: "none",
            motion: [
              { at: 0, x: 20, y: 50, scale: 1, rotation: 0 },
              { at: 1, x: 80, y: 50, scale: 1.3, rotation: 30 },
            ],
          }),
        },
      });
      const plan = buildRenderPlan(next, [], new Set());
      writeFileSync(join(dir, "captions.ass"), plan.ass);
      copyFileSync("public/fonts/DejaVuSans.ttf", join(dir, "DejaVuSans.ttf"));
      execFileSync("ffmpeg", ["-v", "error", ...plan.args], {
        cwd: dir,
        timeout: 60000,
      });
      const center = (time: number) => {
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
            "scale=96:96,format=gray",
            "-f",
            "rawvideo",
            "-",
          ],
          { cwd: dir }
        );
        let weighted = 0,
          mass = 0;
        for (let i = 0; i < bytes.length; i++)
          if (bytes[i] > 30) {
            weighted += (i % 96) * bytes[i];
            mass += bytes[i];
          }
        expect(mass).toBeGreaterThan(0);
        return weighted / mass;
      };
      const beginning = center(0.6),
        ending = center(2.3);
      expect(beginning).toBeLessThan(30);
      expect(ending).toBeGreaterThan(65);
      expect(ending - beginning).toBeGreaterThan(35);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  65000
);
it.skipIf(!nativeAvailable)(
  "renders all six graphics to a decodable MP4 and confines them to their timeline interval",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "reelassati-graphics-"));
    try {
      let next = project;
      for (const [index, kind] of [
        "text",
        "callout",
        "counter",
        "countdown",
        "arrow",
        "highlight",
      ].entries()) {
        next = applyEditOperation(next, {
          ...operation,
          id: `${kind}`,
          parameters: {
            graphic: normalizeGraphic({
              kind,
              text: "Visible proof",
              x: index % 2 ? 70 : 30,
              y: 20 + Math.floor(index / 2) * 30,
              size: 5,
            }),
          },
        });
      }
      const plan = buildRenderPlan(next, [], new Set());
      writeFileSync(join(dir, "captions.ass"), plan.ass);
      copyFileSync("public/fonts/DejaVuSans.ttf", join(dir, "DejaVuSans.ttf"));
      execFileSync("ffmpeg", ["-v", "error", ...plan.args], {
        cwd: dir,
        timeout: 60000,
      });
      const sample = (time: number) =>
        execFileSync(
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
            "scale=64:64,format=gray",
            "-f",
            "rawvideo",
            "-",
          ],
          { cwd: dir }
        );
      const mean = (bytes: Buffer) =>
        bytes.reduce((a, b) => a + b, 0) / bytes.length;
      // FFmpeg grayscale conversion rounds black to at most 3 on this build.
      expect(Math.max(...sample(0.5))).toBeLessThanOrEqual(3);
      expect(mean(sample(1.5)) - mean(sample(0.5))).toBeGreaterThan(5);
      expect(Math.max(...sample(2.5))).toBeLessThanOrEqual(3);
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
            "output.mp4",
          ],
          { cwd: dir, encoding: "utf8" }
        )
      );
      expect(Number(probe.format.duration)).toBeCloseTo(3, 1);
      expect(verifyExportMetadata(probe, plan)).toMatchObject({
        width: 720,
        height: 720,
        duration: 3,
      });
      execFileSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-xerror",
          "-i",
          "output.mp4",
          "-map",
          "0:v:0",
          "-map",
          "0:a?",
          "-f",
          "null",
          "-",
        ],
        { cwd: dir, timeout: 60000 }
      );
      expect(probe.streams[0]).toMatchObject({
        codec_name: "h264",
        width: 720,
        height: 720,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  65000
);
