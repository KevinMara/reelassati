import { describe, it, expect } from "vitest";
import {
  snapPreviewMove,
  snapPreviewScale,
  unionPreviewBounds,
  previewContains,
} from "./preview-transform";
describe("canvas snapping", () => {
  it("snaps centers within tolerance, preserves far positions, and shows the guide", () => {
    const box = { x: 100, y: 100, width: 200, height: 100 };
    const near = snapPreviewMove(box, 296, 0, [], 1000, 1000, 7, 7);
    expect(near.dx).toBe(300);
    expect(near.guides).toContainEqual({ axis: "x", at: 500 });
    expect(snapPreviewMove(box, 270, 70, [], 1000, 1000, 7, 7).dx).toBe(270);
  });
  it("keeps equal edge-to-edge gaps between neighbouring objects", () => {
    const box = { x: 0, y: 100, width: 60, height: 50 };
    const neighbours = [
      { x: 100, y: 100, width: 80, height: 50 },
      { x: 350, y: 100, width: 100, height: 50 },
    ];
    expect(snapPreviewMove(box, 232, 0, neighbours, 1000, 1000, 7, 7).dx).toBe(
      235
    );
    expect(snapPreviewMove(box, 621, 0, neighbours, 1000, 1000, 7, 7).dx).toBe(
      620
    );
  });
  it("matches object sizes and computes a group envelope", () => {
    const box = { x: 100, y: 100, width: 200, height: 100 };
    expect(
      snapPreviewScale(
        box,
        1.48,
        [{ ...box, width: 300, height: 150 }],
        1000,
        1000,
        7,
        7
      )
    ).toBe(1.5);
    expect(unionPreviewBounds([box, { ...box, x: 500 }])).toEqual({
      ...box,
      width: 600,
    });
    expect(previewContains(box, 150, 150)).toBe(true);
    expect(previewContains(box, 50, 150)).toBe(false);
  });
});
