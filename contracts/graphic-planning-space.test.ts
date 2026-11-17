import { describe, expect, it } from "vitest";
import type { Asset, EditProject } from "./workspace";
import {
  graphicPlanningSpace,
  projectedSourceRegions,
} from "./graphic-planning-space";

const assets = [
  {
    id: "source",
    kind: "video",
    width: 1000,
    height: 1000,
    duration: 20,
    status: "ready",
  },
] as Asset[];
function fixture() {
  return {
    duration: 5,
    aspectRatio: "1:1",
    frameRate: 30,
    clips: [
      {
        id: "picture",
        assetId: "source",
        track: "video",
        start: 0,
        duration: 5,
        inPoint: 10,
        outPoint: 20,
        speed: 2,
      },
    ],
    sourceReviews: [
      {
        assetId: "source",
        visualProtection: {
          version: 1,
          sourceDuration: 20,
          coverage: "partial",
          reviewedRanges: [{ start: 10, end: 20 }],
          observedText: [],
          regions: [
            {
              id: "prop",
              kind: "demonstration",
              start: 12,
              end: 16,
              confidence: 0.95,
              rect: { x: 0.3, y: 0.2, width: 0.4, height: 0.6 },
            },
          ],
        },
      },
    ],
  } as unknown as EditProject;
}
const intervals = [{ id: "beat", start: 1, end: 3 }];
describe("first-pass graphic composition evidence", () => {
  it("maps trimmed accelerated source evidence into the current canvas and clock", () => {
    const p = fixture();
    const regions = projectedSourceRegions(p, assets);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({
      start: 1,
      end: 3,
      samples: [
        { time: 1, canvasPercent: { x: 30, y: 20, width: 40, height: 60 } },
        { time: 2, canvasPercent: { x: 30, y: 20, width: 40, height: 60 } },
        { time: 2.999, canvasPercent: { x: 30, y: 20, width: 40, height: 60 } },
      ],
    });
    const [layout] = graphicPlanningSpace(p, assets, intervals);
    expect(layout.coverage).toBe("observed");
    expect(layout.layoutCandidates.length).toBeGreaterThan(0);
    for (const r of layout.layoutCandidates)
      expect(
        r.x + r.width <= 28 || r.x >= 72 || r.y + r.height <= 18 || r.y >= 82
      ).toBe(true);
  });
  it("does not turn absent or incomplete coverage into free space", () => {
    for (const change of [
      (p: EditProject) => {
        p.sourceReviews = [];
      },
      (p: EditProject) => {
        p.sourceReviews![0].visualProtection!.reviewedRanges = [
          { start: 10, end: 13 },
        ];
      },
      (p: EditProject) => {
        p.sourceReviews![0].visualProtection!.sourceDuration = 19;
      },
      (p: EditProject) => {
        p.clips[0].hidden = true;
      },
    ]) {
      const p = fixture();
      change(p);
      expect(graphicPlanningSpace(p, assets, intervals)[0]).toMatchObject({
        coverage: "unknown",
        layoutCandidates: [],
      });
    }
    expect(graphicPlanningSpace(fixture(), [], intervals)[0].coverage).toBe(
      "unknown"
    );
  });
  it("requires coverage from every visible source and across the whole interval", () => {
    const p = fixture();
    p.clips.push({ ...p.clips[0], id: "other", assetId: "unreviewed" });
    expect(
      graphicPlanningSpace(
        p,
        [...assets, { ...assets[0], id: "unreviewed" }],
        intervals
      )[0].layoutCandidates
    ).toEqual([]);
    const gap = fixture();
    gap.clips[0].duration = 2;
    expect(graphicPlanningSpace(gap, assets, intervals)[0].coverage).toBe(
      "unknown"
    );
  });
  it("distinguishes an observed empty frame from an unknown one", () => {
    const p = fixture();
    p.sourceReviews![0].visualProtection!.regions = [];
    expect(graphicPlanningSpace(p, assets, intervals)[0]).toMatchObject({
      coverage: "observed",
      layoutCandidates: [{ x: 4, y: 4, width: 92, height: 92 }],
    });
  });
  it("projects portrait letterboxing instead of assuming source coordinates are canvas coordinates", () => {
    const p = fixture();
    p.aspectRatio = "9:16";
    const rect = projectedSourceRegions(p, assets)[0].samples[0].canvasPercent!;
    expect(rect.x).toBeCloseTo(30);
    expect(rect.y).toBeCloseTo(33.125);
    expect(rect.width).toBeCloseTo(40);
    expect(rect.height).toBeCloseTo(33.75);
  });
});
