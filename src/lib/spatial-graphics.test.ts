import { expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeGraphic } from "@contracts/motion-graphics";
import {
  spatialGraphicFrame,
  spatialTitleText,
  spatialSvgPath,
} from "@contracts/spatial-graphics";
import type { EditProject, TimelineClip } from "@contracts/workspace";
import { buildRenderPlan } from "./render-plan";
import { graphicAssEvents } from "./graphic-ass";

it("bounds spatial controls and projects editable extruded outlines with real perspective", () => {
  const g = normalizeGraphic({
    kind: "spatial-title",
    text: "Caffè €100",
    animation: "none",
    spatial: { pitch: 0, yaw: 0, depth: 0.3, turns: 0, perspective: 5 },
  })!;
  expect(normalizeGraphic(g)).toEqual(g);
  expect(spatialTitleText(g.text)).toBe("Caffè €100");
  const faceOn = spatialGraphicFrame(g, 0, 3);
  const rotated = spatialGraphicFrame(
    { ...g, spatial: { ...g.spatial!, yaw: 45 } },
    0,
    3
  );
  expect(faceOn.faces.length).toBeGreaterThan(100);
  const top = faceOn.faces.at(-1)!;
  // The actual font counters survive as additional contours, rather than painted letters.
  expect(top.contours.length).toBeGreaterThan(
    g.text.replaceAll(" ", "").length
  );
  expect(spatialSvgPath(top.contours)).toContain(" Z");
  expect(rotated.faces.at(-1)!.contours).not.toEqual(top.contours);
  for (const face of rotated.faces)
    for (const contour of face.contours)
      for (const point of contour)
        expect(point.every(Number.isFinite)).toBe(true);
  const limited = normalizeGraphic({
    kind: "spatial-cube",
    spatial: { pitch: 500, yaw: -500, depth: 100, turns: 500, perspective: 0 },
  })!;
  expect(limited.spatial).toEqual({
    pitch: 70,
    yaw: -70,
    depth: 0.65,
    turns: 3,
    perspective: 3,
  });
});

it("uses deterministic depth-sorted frames and an actual changing 3D viewpoint", () => {
  for (const kind of ["spatial-cube", "spatial-orbit"] as const) {
    const g = normalizeGraphic({
      kind,
      animation: "none",
      spatial: { turns: 0.5 },
    })!;
    const first = spatialGraphicFrame(g, 0, 3),
      next = spatialGraphicFrame(g, 0.8, 3);
    expect(next).toEqual(spatialGraphicFrame(g, 0.8, 3));
    expect(first.faces).not.toEqual(next.faces);
    expect(new Set(first.faces.map(face => face.color)).size).toBeGreaterThan(
      1
    );
    expect(
      first.faces.every(face =>
        face.contours.every(points => points.length >= 3)
      )
    ).toBe(true);
  }
});

it("preserves the animation clock when a spatial clip is trimmed and exports its lane order", () => {
  const graphic = normalizeGraphic({
    kind: "spatial-cube",
    animation: "none",
    spatial: { turns: 0.5 },
  })!;
  const clip: TimelineClip = {
    id: "trimmed",
    track: "overlay",
    lane: 2,
    label: "Trimmed cube",
    start: 0,
    duration: 1,
    inPoint: 1,
    outPoint: 3,
    graphicDuration: 4,
    speed: 2,
    locked: false,
    color: graphic.background,
    graphic,
  };
  const expected = spatialGraphicFrame(graphic, 1, 4);
  const [x, y] = expected.faces[0].contours[0][0];
  const ass = graphicAssEvents([clip], 720, 720, 1);
  expect(ass).toContain("Dialogue: 1002,0:00:00.00,");
  expect(ass).toContain(
    `m ${Math.round((expected.x * 720) / 100 + x * 120)} ${Math.round((expected.y * 720) / 100 + y * 120)}`
  );
  expect(
    graphicAssEvents(
      [
        {
          ...clip,
          graphic: normalizeGraphic({ kind: "text", text: "Top lane" })!,
        },
      ],
      720,
      720,
      1
    )
  ).toContain("Dialogue: 2002,");
});

let native = false;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  native = true;
} catch {
  /* optional integration */
}
it.skipIf(!native)(
  "exports all three spatial effects into a decodable MP4 at their actual timeline positions",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "reelassati-spatial-"));
    try {
      const clips: TimelineClip[] = [
        "spatial-title",
        "spatial-cube",
        "spatial-orbit",
      ].map((kind, index) => ({
        id: kind,
        track: "overlay",
        label: kind,
        start: index * 2 + 0.4,
        duration: 1.2,
        inPoint: 0,
        outPoint: 1.2,
        locked: false,
        color: "#57B7CD",
        graphic: normalizeGraphic({
          kind,
          text: "SPACE",
          color: "#F1F5F9",
          background: "#57B7CD",
          x: 50,
          y: 50,
          size: 9,
          animation: "none",
          spatial: { turns: kind === "spatial-title" ? 0 : 0.45 },
        })!,
      }));
      const project = {
        id: "spatial-test",
        duration: 6,
        aspectRatio: "1:1",
        clips,
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
      const samples = [0.2, 0.7, 1.2, 2.8, 3.2, 4.8, 5.2].map(time =>
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
            "scale=96:96,format=gray",
            "-f",
            "rawvideo",
            "-",
          ],
          { cwd: dir }
        )
      );
      expect(Math.max(...samples[0])).toBeLessThanOrEqual(3);
      for (const bytes of samples.slice(1)) {
        let weight = 0,
          xSum = 0,
          ySum = 0;
        for (let i = 0; i < bytes.length; i++)
          if (bytes[i] > 30) {
            weight += bytes[i];
            xSum += (i % 96) * bytes[i];
            ySum += Math.floor(i / 96) * bytes[i];
          }
        expect(weight).toBeGreaterThan(15000);
        expect(xSum / weight).toBeGreaterThan(28);
        expect(xSum / weight).toBeLessThan(68);
        expect(ySum / weight).toBeGreaterThan(28);
        expect(ySum / weight).toBeLessThan(68);
      }
      expect(samples[3].equals(samples[4])).toBe(false);
      expect(samples[5].equals(samples[6])).toBe(false);
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
          "-f",
          "null",
          "-",
        ],
        { cwd: dir, timeout: 60000 }
      );
      if (process.env.SPATIAL_RENDER_PROOF)
        copyFileSync(join(dir, "output.mp4"), process.env.SPATIAL_RENDER_PROOF);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  65000
);
