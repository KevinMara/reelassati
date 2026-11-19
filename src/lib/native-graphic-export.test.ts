import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { buildRenderPlan } from "./render-plan";
import { normalizeGraphic } from "@contracts/motion-graphics";
import { NATIVE_GRAPHIC_TEMPLATES } from "@contracts/native-graphics";
import type { EditProject, Asset, TimelineClip } from "@contracts/workspace";
const clip = (id: string, graphic: unknown, lane = 1): TimelineClip => ({
  id,
  label: id,
  track: "overlay",
  start: 0,
  duration: 1,
  inPoint: 0,
  outPoint: 1,
  locked: false,
  color: "#ffffff",
  lane,
  graphic: normalizeGraphic(graphic),
});
const native = clip(
  "native",
  {
    kind: "text",
    text: "REEL",
    native: { id: NATIVE_GRAPHIC_TEMPLATES[0].id },
  },
  2
);
const project: EditProject = {
  id: "layers",
  template: "blank",
  status: "editing",
  platform: "instagram",
  playhead: 0,
  createdAt: "",
  updatedAt: "",
  proposedChanges: [],
  qualitySignals: [],
  revisions: [],
  title: "Layer verification",
  duration: 1,
  aspectRatio: "16:9",
  transcript: [],
  clips: [
    clip("under", {
      kind: "rectangle",
      x: 50,
      y: 50,
      width: 90,
      height: 56.25,
      color: "#0000FF",
      animation: "none",
    }),
    native,
    clip(
      "over",
      {
        kind: "callout",
        text: "",
        x: 50,
        y: 50,
        padding: 6,
        background: "#00FF00",
        animation: "none",
      },
      3
    ),
  ],
};
let ffmpeg = false;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore", windowsHide: true });
  ffmpeg = true;
} catch {
  /* Unit guards run on hosts without a native codec binary. */
}
describe("native graphic export integration", () => {
  it("never silently drops an unrendered animation", () => {
    expect(() => buildRenderPlan(project, [], new Set())).toThrow(
      "has not rendered"
    );
    expect(() =>
      buildRenderPlan(
        { ...project, clips: [{ ...native, hidden: true }] },
        [],
        new Set()
      )
    ).not.toThrow();
  });
  it.skipIf(!ffmpeg)(
    "decodes transparency and respects graphics below and above the native layer",
    () => {
      const dir = mkdtempSync(join(tmpdir(), "reel-native-order-"));
      try {
        const rgba = Buffer.alloc(1280 * 720 * 4);
        for (let y = 200; y < 520; y++)
          for (let x = 480; x < 800; x++) {
            const i = (y * 1280 + x) * 4;
            rgba[i] = 255;
            rgba[i + 3] = 255;
          }
        writeFileSync(join(dir, "rgba"), rgba);
        execFileSync(
          "ffmpeg",
          [
            "-v",
            "error",
            "-f",
            "rawvideo",
            "-pixel_format",
            "rgba",
            "-video_size",
            "1280x720",
            "-framerate",
            "30",
            "-stream_loop",
            "-1",
            "-i",
            join(dir, "rgba"),
            "-t",
            "1",
            "-c:v",
            "qtrle",
            "-pix_fmt",
            "argb",
            join(dir, "native.mov"),
          ],
          { windowsHide: true, timeout: 30000 }
        );
        const asset = {
          id: "rendered",
          name: "Rendered",
          kind: "video",
          status: "ready",
          url: "",
          contentType: "video/quicktime",
          size: 1,
          createdAt: "",
        } as Asset;
        const plan = buildRenderPlan(
          project,
          [],
          new Set(),
          720,
          new Map(),
          new Map(),
          new Map([["native", asset]])
        );
        copyFileSync(join(dir, "native.mov"), join(dir, "input-0"));
        writeFileSync(join(dir, "captions.ass"), plan.ass);
        for (const f of plan.assFiles)
          writeFileSync(join(dir, f.filename), f.data);
        execFileSync("ffmpeg", ["-v", "error", ...plan.args], {
          cwd: dir,
          windowsHide: true,
          timeout: 30000,
        });
        const pixel = (x: number) =>
          execFileSync(
            "ffmpeg",
            [
              "-v",
              "error",
              "-ss",
              "0.5",
              "-i",
              join(dir, "output.mp4"),
              "-vf",
              `crop=2:2:${x}:360,format=rgb24`,
              "-frames:v",
              "1",
              "-f",
              "rawvideo",
              "pipe:1",
            ],
            { windowsHide: true, timeout: 10000 }
          );
        const blue = pixel(200),
          red = pixel(500),
          green = pixel(640);
        expect(blue[2]).toBeGreaterThan(230);
        expect(blue[0]).toBeLessThan(20);
        expect(red[0]).toBeGreaterThan(230);
        expect(red[2]).toBeLessThan(20);
        expect(green[1]).toBeGreaterThan(230);
        expect(green[0]).toBeLessThan(20);
      } finally {
        if (
          !resolve(dir).startsWith(resolve(tmpdir()) + sep) ||
          !dir.includes("reel-native-order-")
        )
          throw Error("Unexpected test directory");
        rmSync(dir, { recursive: true, force: true });
      }
    },
    65000
  );
});
