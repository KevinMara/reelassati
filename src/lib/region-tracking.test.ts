import { describe, expect, it } from "vitest";
import {
  observeRegion,
  trackingTemplate,
  simplifyTracking,
  type GrayFrame,
} from "@contracts/region-tracking";
import { normalizeGraphic, graphicFrame } from "@contracts/motion-graphics";
import { normalizeVisual } from "@contracts/clip-visual";
import { sourcePointToCanvas, trackedGraphicClip } from "./tracked-graphic";
import { readDecodedFrame } from "./region-tracking";
import type { TimelineClip } from "@contracts/workspace";
const patch = (() => {
  let seed = 123;
  return Array.from({ length: 17 * 17 }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed >>> 24;
  });
})();
function frame(centers: Array<[number, number]>): GrayFrame {
  const width = 160,
    height = 120,
    pixels = new Uint8Array(width * height).fill(32);
  for (const [cx, cy] of centers)
    for (let y = 0; y < 17; y++)
      for (let x = 0; x < 17; x++)
        pixels[(cy + y - 8) * width + cx + x - 8] = patch[y * 17 + x];
  return { width, height, pixels };
}
const seed = frame([[70, 60]]),
  region = { x: 62 / 159, y: 52 / 119, width: 16 / 160, height: 16 / 120 };
const source = {
  id: "source",
  track: "video",
  start: 5,
  duration: 2,
  inPoint: 10,
  outPoint: 14,
  speed: 2,
  fit: "contain",
} as TimelineClip;
describe("observed 2D region tracking", () => {
  it("captures a newly presented frame after seek completion using its decoded timestamp", async () => {
    const events = new EventTarget();
    let callback: VideoFrameRequestCallback | undefined,
      captured = false,
      played = false;
    const video = {
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      requestVideoFrameCallback: (next: VideoFrameRequestCallback) => {
        callback = next;
        return 1;
      },
      cancelVideoFrameCallback: () => {},
      play: async () => {
        played = true;
      },
      pause: () => {},
    } as unknown as HTMLVideoElement;
    const abort = new AbortController();
    const pending = readDecodedFrame(
      video,
      abort.signal,
      () => {},
      true,
      () => {
        captured = true;
      }
    );
    expect(callback).toBeUndefined();
    expect(played).toBe(false);
    events.dispatchEvent(new Event("seeked"));
    expect(played).toBe(true);
    callback!(0, { mediaTime: 1.967 } as VideoFrameCallbackMetadata);
    expect(await pending).toBe(1.967);
    expect(captured).toBe(true);
  });
  it("cleans up a cancelled pending frame without accepting a later callback", async () => {
    const events = new EventTarget();
    let callback: VideoFrameRequestCallback | undefined,
      captured = false;
    const video = {
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      requestVideoFrameCallback: (next: VideoFrameRequestCallback) => {
        callback = next;
        return 1;
      },
      cancelVideoFrameCallback: () => {},
      play: async () => {},
      pause: () => {},
    } as unknown as HTMLVideoElement;
    const abort = new AbortController();
    const pending = readDecodedFrame(
      video,
      abort.signal,
      () => {},
      false,
      () => {
        captured = true;
      }
    );
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    callback!(0, { mediaTime: 1 } as VideoFrameCallbackMetadata);
    expect(captured).toBe(false);
  });
  it("retains opacity and scale animation when the tracked region is stationary", () => {
    const graphic = {
      id: "g",
      track: "overlay",
      start: 5,
      duration: 2,
      inPoint: 0,
      outPoint: 2,
      graphicDuration: 2,
      graphic: normalizeGraphic({
        kind: "callout",
        text: "Object",
        x: 50,
        y: 50,
        animation: "none",
        motion: [
          { at: 0, x: 50, y: 50, scale: 0.8, opacity: 0 },
          { at: 0.5, x: 50, y: 50, scale: 1.2, opacity: 1 },
          { at: 1, x: 50, y: 50, scale: 0.8, opacity: 0 },
        ],
      }),
    } as TimelineClip;
    const observations = Array.from({ length: 17 }, (_, i) => ({
      time: 10 + i * 0.25,
      x: 0.5,
      y: 0.5,
      confidence: 1,
    }));
    const result = trackedGraphicClip(
      graphic,
      source,
      observations,
      { width: 100, height: 100 },
      "1:1"
    );
    for (const t of [0.25, 0.5, 0.983333, 1.25, 1.5]) {
      const before = graphicFrame(graphic.graphic!, t, 2),
        after = graphicFrame(result.graphic!, t, 2);
      expect(after.opacity).toBeCloseTo(before.opacity, 1);
      expect(after.scale).toBeCloseTo(before.scale, 1);
    }
    expect(graphicFrame(result.graphic!, 1, 2).opacity).toBeGreaterThan(0.98);
  });
  it("tracks exact one-pixel motion on both candidate grid parities", () => {
    const template = trackingTemplate(seed, region);
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [3, 1],
      [8, 0],
    ]) {
      const match = observeRegion(frame([[70 + dx, 60 + dy]]), template, {
        x: 70 / 159,
        y: 60 / 119,
      });
      expect(match?.x).toBeCloseTo((70 + dx + 0.5) / 160);
      expect(match?.y).toBeCloseTo((60 + dy + 0.5) / 120);
      expect(match?.confidence).toBeCloseTo(1);
    }
  });
  it("rejects equal matches even when one is an odd-pixel candidate", () => {
    const template = trackingTemplate(seed, region);
    expect(
      observeRegion(
        frame([
          [70, 60],
          [95, 60],
        ]),
        template,
        { x: 70 / 159, y: 60 / 119 }
      )
    ).toBeUndefined();
    expect(
      observeRegion(frame([]), template, { x: 70 / 159, y: 60 / 119 })
    ).toBeUndefined();
  });
  it("rejects flat and impossible edge seeds instead of clamping pixels", () => {
    expect(() => trackingTemplate(frame([]), region)).toThrow(/little detail/);
    expect(() =>
      trackingTemplate(seed, { x: 0.98, y: 0.3, width: 0.02, height: 0.2 })
    ).toThrow(/edge/);
  });
  it("retains observed endpoints and a deliberate corner when simplifying", () => {
    const points = [
      { time: 0, x: 0, y: 0, confidence: 1 },
      { time: 1, x: 0.1, y: 0, confidence: 1 },
      { time: 2, x: 0.2, y: 0, confidence: 1 },
      { time: 3, x: 0.2, y: 0.1, confidence: 1 },
    ];
    expect(simplifyTracking(points).map(p => p.time)).toEqual([0, 2, 3]);
  });
  it("maps letterbox, cover, flip and rotation in physical canvas coordinates", () => {
    const size = { width: 200, height: 100 },
      canvas = { width: 100, height: 100 };
    expect(
      sourcePointToCanvas(source, 5, { x: 1, y: 1 }, size, canvas)
    ).toEqual({ x: 100, y: 75 });
    expect(
      sourcePointToCanvas(
        { ...source, fit: "cover" },
        5,
        { x: 1, y: 1 },
        size,
        canvas
      )
    ).toEqual({ x: 150, y: 100 });
    const mapped = sourcePointToCanvas(
      {
        ...source,
        visual: normalizeVisual({
          flipX: true,
          rotation: 90,
          scale: 0.5,
          x: 10,
          y: -5,
        }),
      },
      5,
      { x: 1, y: 1 },
      size,
      canvas
    );
    expect(mapped.x).toBeCloseTo(47.5);
    expect(mapped.y).toBeCloseTo(20);
  });
  it("maps decoded source times through speed and preserves a graphic’s source clock", () => {
    const graphic = {
      id: "g",
      track: "overlay",
      start: 5,
      duration: 2,
      inPoint: 1,
      outPoint: 3,
      speed: 1,
      graphicDuration: 4,
      graphic: normalizeGraphic({
        kind: "callout",
        text: "Object",
        x: 50,
        y: 50,
        animation: "none",
      }),
    } as TimelineClip;
    const result = trackedGraphicClip(
      graphic,
      source,
      [
        { time: 10, x: 0.5, y: 0.5, confidence: 1 },
        { time: 12, x: 0.6, y: 0.5, confidence: 0.9 },
        { time: 13.8, x: 0.7, y: 0.5, confidence: 0.9 },
      ],
      { width: 100, height: 100 },
      "1:1"
    );
    expect(result).toMatchObject({ start: 5, inPoint: 1, graphicDuration: 4 });
    expect(result.duration).toBeCloseTo(1.9);
    expect(result.outPoint).toBeCloseTo(2.9);
    expect(result.graphic?.motion?.[0].x).toBe(50);
    expect(result.graphic?.motion?.at(-1)?.x).toBe(70);
    expect(result.graphic?.motion?.at(-1)?.at).toBeCloseTo(2.9 / (4 - 1 / 30));
  });
});
