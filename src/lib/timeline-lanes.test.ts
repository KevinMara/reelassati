import { describe, expect, it } from "vitest";
import type { TimelineClip, Asset } from "@contracts/workspace";
import {
  allocateTimelineLane,
  clipLaneNumber,
  compareTimelineLayers,
  timelineClipColor,
  timeAtTimelinePointer,
  trimTimelineClip,
  clipTimingLimits,
  normalizeClipTiming,
} from "./timeline-lanes";

const video = {
  id: "base",
  track: "video",
  assetId: "video",
  lane: 1,
  start: 0,
  duration: 10,
  inPoint: 2,
  outPoint: 22,
  speed: 2,
  locked: false,
} as TimelineClip;
describe("numbered timeline editing", () => {
  it("places overlapping visual media above occupied lanes and reuses a lane at a non-overlapping time", () => {
    const second = { ...video, id: "second", lane: 2 };
    expect(allocateTimelineLane([video, second], "video", 3, 2)).toBe(3);
    expect(allocateTimelineLane([video, second], "video", 10, 2)).toBe(1);
    expect(
      allocateTimelineLane([video, second], "video", 3, 2, 2, "second")
    ).toBe(2);
    expect(allocateTimelineLane([video], "audio", 3, 2)).toBe(1);
  });
  it("preserves legacy image layers and sorts explicit upper lanes above all lower video lanes", () => {
    const legacy = {
      ...video,
      id: "legacy",
      track: "overlay",
      lane: undefined,
    } as TimelineClip;
    const third = { ...video, id: "third", lane: 3 };
    expect(clipLaneNumber(legacy)).toBe(2);
    expect(
      [third, legacy, video].sort(compareTimelineLayers).map(c => c.id)
    ).toEqual(["base", "legacy", "third"]);
  });
  it("maps actual row coordinates to exact time regardless of viewport origin or zoom width", () => {
    expect(timeAtTimelinePointer(420, 120, 600, 30)).toBe(15);
    expect(timeAtTimelinePointer(720, 120, 1200, 30)).toBe(15);
    expect(timeAtTimelinePointer(0, 120, 600, 30)).toBe(0);
    expect(timeAtTimelinePointer(999, 120, 600, 30)).toBe(30);
  });
  it("trims by source speed, refuses negative source offsets and preserves locked clips", () => {
    expect(trimTimelineClip(video, "start", 3)).toMatchObject({
      start: 3,
      inPoint: 8,
      duration: 7,
      outPoint: 22,
    });
    expect(trimTimelineClip(video, "end", 4)).toMatchObject({
      duration: 4,
      inPoint: 2,
      outPoint: 10,
    });
    expect(trimTimelineClip({ ...video, start: 5 }, "start", 0)).toMatchObject({
      start: 4,
      inPoint: 0,
    });
    const locked = { ...video, locked: true };
    expect(trimTimelineClip(locked, "end", 4)).toBe(locked);
  });
  it("keeps caption, text, image, audio and video colors distinct even with legacy clip colors", () => {
    const assets = [
      { id: "video", kind: "video" },
      { id: "image", kind: "image" },
    ] as Asset[];
    const clips = [
      video,
      { ...video, assetId: "image" },
      { ...video, track: "audio" },
      { ...video, track: "captions" },
      { ...video, graphic: { kind: "text" } },
    ] as TimelineClip[];
    expect(new Set(clips.map(c => timelineClipColor(c, assets))).size).toBe(5);
  });
  it("keeps a graphic's original animation span when its end is trimmed", () => {
    const graphic = {
      ...video,
      graphic: { kind: "text" },
      inPoint: 0,
      outPoint: 10,
      speed: 1,
    } as TimelineClip;
    const shortened = trimTimelineClip(graphic, "end", 4);
    expect(shortened).toMatchObject({
      graphicDuration: 10,
      duration: 4,
      outPoint: 4,
    });
    expect(trimTimelineClip(shortened, "start", 1)).toMatchObject({
      graphicDuration: 10,
      inPoint: 1,
    });
  });
  it("keeps sub-0.2-second sound effects inside their real source bounds", () => {
    const short = {
      ...video,
      track: "audio",
      inPoint: 0,
      outPoint: 0.126,
      duration: 0.126,
      speed: 1,
    } as TimelineClip;
    const asset = { id: "video", kind: "audio", duration: 0.126 } as Asset;
    const bounds = clipTimingLimits(short, asset);
    expect(bounds.minimumDuration).toBeLessThan(0.126);
    expect(bounds.maximumDuration).toBe(0.126);
    expect(bounds.sourceLimit).toBe(0.126);
    expect(normalizeClipTiming(short, asset)).toMatchObject({
      duration: 0.126,
      outPoint: 0.126,
    });
    const accelerated = normalizeClipTiming(
      { ...short, speed: 2, duration: 0.2, outPoint: 0.5 },
      asset
    );
    expect(accelerated.duration).toBeCloseTo(0.063, 9);
    expect(accelerated.outPoint).toBeLessThanOrEqual(0.126);
    const tiny = { ...short, duration: 0.0005, outPoint: 0.0005 };
    expect(trimTimelineClip(tiny, "end", 2).duration).toBe(0.0005);
    expect(
      normalizeClipTiming(tiny, { ...asset, duration: 0.0005 }).duration
    ).toBe(0.0005);
  });
});
