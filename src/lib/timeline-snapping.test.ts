import { describe, expect, it } from "vitest";
import {
  buildTimelineSnapPoints,
  snapTimelineTime,
  type TimelineSnapPoint,
} from "./timeline-snapping";

const points: TimelineSnapPoint[] = [
  { time: 5, kind: "clip-end", label: "Clip end", clipId: "other" },
];

describe("timeline magnetic alignment", () => {
  it("uses a constant screen distance at different zoom levels", () => {
    expect(
      snapTimelineTime({ time: 5.07, points, pixelsPerSecond: 100 }).time
    ).toBe(5);
    expect(
      snapTimelineTime({ time: 5.07, points, pixelsPerSecond: 300 }).point
    ).toBeNull();
    expect(
      snapTimelineTime({ time: 5 + 7 / 300, points, pixelsPerSecond: 300 }).time
    ).toBe(5);
  });

  it("aligns the trailing edge of a 126 ms sound without rounding or stretching it", () => {
    const duration = 0.126032;
    const result = snapTimelineTime({
      time: 4.86,
      movingDuration: duration,
      points,
      pixelsPerSecond: 100,
    });
    expect(result.alignedEdge).toBe("end");
    expect(result.time + duration).toBe(5);
    expect(result.time).toBe(4.873968);
  });

  it("excludes both edges of the moved clip and includes other lanes and the playhead", () => {
    const result = buildTimelineSnapPoints(
      [
        { id: "moving", start: 1, duration: 2 },
        { id: "other-lane", start: 4.5, duration: 0.5 },
      ],
      10,
      6.333333,
      new Set(["moving"])
    );
    expect(result.some(p => p.clipId === "moving")).toBe(false);
    expect(
      result.filter(p => p.clipId === "other-lane").map(p => p.time)
    ).toEqual([4.5, 5]);
    expect(
      snapTimelineTime({ time: 6.31, points: result, pixelsPerSecond: 100 })
        .time
    ).toBe(6.333333);
  });

  it("does not show a snap that would place a clip before zero or trim beyond source bounds", () => {
    expect(
      snapTimelineTime({
        time: 0.01,
        movingDuration: 2,
        points: [{ time: 1.99, kind: "clip-start", label: "Clip start" }],
        pixelsPerSecond: 100,
      }).point
    ).toBeNull();
    expect(
      snapTimelineTime({
        time: 4.95,
        maximum: 4.98,
        points,
        pixelsPerSecond: 100,
      }).point
    ).toBeNull();
    expect(
      snapTimelineTime({
        time: 5.02,
        minimum: 5.01,
        points,
        pixelsPerSecond: 100,
      }).point
    ).toBeNull();
  });

  it("supports exact Alt placement and ignores malformed values", () => {
    expect(
      snapTimelineTime({
        time: 4.956789,
        enabled: false,
        points,
        pixelsPerSecond: 100,
      }).time
    ).toBe(4.956789);
    expect(
      snapTimelineTime({ time: 4.95, points, pixelsPerSecond: 0 }).point
    ).toBeNull();
    expect(
      snapTimelineTime({ time: NaN, points, pixelsPerSecond: 100 }).time
    ).toBe(0);
    expect(
      buildTimelineSnapPoints(
        [{ id: "bad", start: NaN, duration: 1 }],
        Infinity,
        -1
      ).map(p => p.time)
    ).toEqual([0]);
  });

  it("prefers the playhead at coincident targets independently of source order", () => {
    const coincident: TimelineSnapPoint[] = [
      ...points,
      { time: 5, kind: "playhead", label: "Playhead" },
    ];
    for (const targets of [coincident, [...coincident].reverse()])
      expect(
        snapTimelineTime({ time: 5.02, points: targets, pixelsPerSecond: 100 })
          .point?.kind
      ).toBe("playhead");
  });
});
