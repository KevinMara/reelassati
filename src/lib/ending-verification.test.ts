import { describe, expect, it } from "vitest";
import type { Asset, EditProject } from "@contracts/workspace";
import { normalizeReview } from "@contracts/source-review";
import { trimObservedEnding } from "./editor-production";
import { verifyExportMetadata } from "./export-verification";

const assets = [{ id: "source", kind: "video", duration: 40 }] as Asset[];
function project(): EditProject {
  return {
    duration: 20,
    playhead: 18,
    transcript: [],
    clips: [
      {
        id: "clip",
        assetId: "source",
        start: 5,
        duration: 15,
        inPoint: 10,
        outPoint: 40,
        speed: 2,
      },
    ],
    sourceReviews: [
      {
        assetId: "source",
        ...normalizeReview(
          {
            ending: {
              time: 30,
              confidence: 0.95,
              completed: true,
              trailingContent: "empty",
              note: "The complete closing phrase ends at 30s; the remaining footage is blank.",
            },
          },
          40
        ),
      },
    ],
  } as unknown as EditProject;
}
describe("observed endings", () => {
  it("maps an observed source ending through trim offsets and speed, with a closing margin", () => {
    const before = project();
    const after = trimObservedEnding(before, assets);
    expect(after.duration).toBeCloseTo(15.2);
    expect(after.clips[0].outPoint).toBeCloseTo(30.4);
    expect(after.playhead).toBeCloseTo(15.2);
    expect(before.duration).toBe(20);
  });
  it("preserves the whole spoken phrase when visual evidence ends sooner", () => {
    const p = project();
    p.transcript = [
      {
        id: "spoken",
        start: 14,
        end: 17.1,
        text: "Complete the final sentence.",
      },
    ];
    const after = trimObservedEnding(p, assets);
    expect(after.duration).toBeCloseTo(17.3);
    expect(after.transcript).toEqual(p.transcript);
  });
  it("preserves locked media and intentional later layers", () => {
    const p = project();
    p.clips[0].locked = true;
    expect(trimObservedEnding(p, assets)).toBe(p);
    p.clips[0].locked = false;
    p.clips.push({
      ...p.clips[0],
      id: "outro",
      assetId: undefined,
      track: "overlay",
      start: 17,
      duration: 3,
    });
    expect(trimObservedEnding(p, assets)).toBe(p);
  });
  it("does not trim unassessed, incomplete, low-confidence, or malformed endings", () => {
    for (const ending of [
      null,
      {
        time: 30,
        confidence: 0.8,
        completed: true,
        trailingContent: "empty",
        note: "Uncertain",
      },
      {
        time: 30,
        confidence: 1,
        completed: false,
        trailingContent: "empty",
        note: "Cut-off word",
      },
      {
        time: 30,
        confidence: 1,
        completed: true,
        trailingContent: "unknown",
        note: "Tail not seen",
      },
      {
        time: 41,
        confidence: 1,
        completed: true,
        trailingContent: "empty",
        note: "Outside source",
      },
      {
        time: "30",
        confidence: 1,
        completed: true,
        trailingContent: "empty",
        note: "Wrong type",
      },
    ]) {
      const p = project();
      p.sourceReviews![0] = {
        ...p.sourceReviews![0],
        ...normalizeReview({ ending }, 40),
      };
      expect(trimObservedEnding(p, assets)).toBe(p);
    }
  });
});
describe("encoded output verification", () => {
  const expected = { width: 720, height: 1280, duration: 10 };
  const probe = {
    format: { duration: "10.027" },
    streams: [
      {
        codec_type: "video",
        codec_name: "h264",
        width: 720,
        height: 1280,
        duration: "10.0",
      },
    ],
  };
  it("returns actual encoded duration, allowing normal frame/audio packet rounding", () => {
    expect(verifyExportMetadata(probe, expected).duration).toBe(10.027);
  });
  it("rejects missing video, truncated video hidden by longer audio, wrong dimensions and corrupt metadata", () => {
    for (const value of [
      null,
      {},
      { ...probe, streams: [] },
      { ...probe, streams: [{ ...probe.streams[0], duration: "8" }] },
      { ...probe, streams: [{ ...probe.streams[0], width: 1080 }] },
      { ...probe, format: { duration: "NaN" } },
    ]) {
      expect(() => verifyExportMetadata(value, expected)).toThrow();
    }
  });
});
