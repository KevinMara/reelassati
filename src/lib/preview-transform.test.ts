import { expect, it } from "vitest";
import type { TimelineClip } from "@contracts/workspace";
import { normalizeVisual } from "@contracts/clip-visual";
import { normalizeGraphic } from "@contracts/motion-graphics";
import {
  transformPreviewClip,
  mediaSelectionBounds,
} from "./preview-transform";

it("places media handles on the actual portrait picture inside a landscape canvas", () => {
  const clip = { start: 0, duration: 5, fit: "contain" } as TimelineClip;
  expect(
    mediaSelectionBounds(clip, 0, 1600, 900, { width: 900, height: 1600 })
  ).toMatchObject({ x: 546.875, y: 0, width: 506.25, height: 900 });
  const rotated = mediaSelectionBounds(
    { ...clip, visual: normalizeVisual({ rotation: 90 }) },
    0,
    1600,
    900,
    { width: 900, height: 1600 }
  );
  expect(rotated?.width).toBeCloseTo(900);
  expect(rotated?.height).toBeCloseTo(506.25);
});

it("moves and resizes the full media animation path without changing timing or audio", () => {
  const clip = {
    id: "video",
    start: 2,
    duration: 5,
    volume: 0.7,
    visual: normalizeVisual({
      x: 4,
      scale: 1.2,
      keyframes: [
        { at: 0, x: 5, scale: 1 },
        { at: 1, x: 10, scale: 1.5 },
      ],
    }),
  } as TimelineClip;
  const next = transformPreviewClip(clip, { dx: 10, dy: -5, scale: 2 });
  expect(next.visual?.keyframes.map(k => [k.x, k.y, k.scale])).toEqual([
    [15, -5, 2],
    [20, -5, 3],
  ]);
  expect([next.start, next.duration, next.volume]).toEqual([2, 5, 0.7]);
  expect(clip.visual?.x).toBe(4);
});
it("moves graphic motion and scales its actual dimensions", () => {
  const clip = {
    graphic: normalizeGraphic({
      kind: "rectangle",
      x: 40,
      y: 50,
      width: 20,
      height: 10,
      motion: [{ at: 0, x: 40, y: 50, scale: 1, rotation: 0 }],
    }),
  } as TimelineClip;
  const next = transformPreviewClip(clip, { dx: 10, scale: 1.5, rotation: 90 });
  expect(next.graphic).toMatchObject({
    x: 50,
    width: 30,
    height: 15,
    rotation: 90,
  });
  expect(next.graphic?.motion?.[0]).toMatchObject({ x: 50, rotation: 90 });
});
it("preserves locked clips and rejects invalid gestures", () => {
  const clip = { locked: true } as TimelineClip;
  expect(transformPreviewClip(clip, { dx: 20 })).toBe(clip);
  expect(transformPreviewClip(clip, { scale: NaN })).toBe(clip);
  const open = { locked: false } as TimelineClip;
  expect(transformPreviewClip(open, { scale: 0 })).toBe(open);
});
