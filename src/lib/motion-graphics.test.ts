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
