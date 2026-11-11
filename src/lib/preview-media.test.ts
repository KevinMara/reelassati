import { describe, expect, it, vi } from "vitest";
import type { TimelineClip } from "@contracts/workspace";
import {
  continuousPreviewMedia,
  createPreviewMediaTransport,
  previewMediaAt,
  previewMediaRuns,
  previewSourceTime,
} from "./preview-media";

const clip = (id: string, patch: Partial<TimelineClip> = {}): TimelineClip => ({
  id,
  assetId: "source",
  label: id,
  track: "video",
  start: 0,
  duration: 5,
  inPoint: 0,
  outPoint: 5,
  locked: false,
  color: "#fff",
  ...patch,
});

describe("preview decoder continuity", () => {
  it("keeps one decoder through every reported source-contiguous cut", () => {
    const boundaries = [0, 5, 9.5, 13, 16.8, 21, 28.366667];
    const clips = boundaries.slice(0, -1).map((start, index) =>
      clip(`cut-${index}`, {
        start,
        inPoint: start,
        outPoint: boundaries[index + 1],
        duration: boundaries[index + 1] - start,
        volume: index % 2 ? 0.7 : 1,
      })
    );
    const runs = previewMediaRuns(clips);
    expect(runs).toHaveLength(1);
    for (const time of [0, 4.99, 5, 9.49, 9.5, 13, 16.8, 21, 28.36]) {
      const layers = previewMediaAt(runs, time);
      expect(layers).toHaveLength(1);
      expect(layers[0]).toMatchObject({ key: "cut-0", active: true });
      expect(previewSourceTime(layers[0].clip, time)).toBeCloseTo(time, 6);
      expect(layers[0].clip).toBe(
        clips.find(c => c.start <= time && c.start + c.duration > time)
      );
    }
  });

  it("cues noncontiguous source cuts before activation without replacing their node", () => {
    const runs = previewMediaRuns([
      clip("first"),
      clip("jump", { start: 5, inPoint: 18, outPoint: 23 }),
      clip("different-source", { assetId: "other", start: 10 }),
    ]);
    const before = previewMediaAt(runs, 4);
    expect(before.map(({ key, active }) => [key, active])).toEqual([
      ["first", true],
      ["jump", false],
    ]);
    expect(previewSourceTime(before[1].clip, 4)).toBe(18);
    expect(previewMediaAt(runs, 5)).toMatchObject([
      { key: "jump", active: true, clip: { inPoint: 18 } },
    ]);
    expect(previewMediaAt(runs, 9)).toMatchObject([
      { key: "jump", active: true },
      { key: "different-source", active: false },
    ]);
  });

  it("keeps overlapping sources, visual lanes and source audio on independent decoders", () => {
    const clips = [
      clip("base"),
      clip("overlay", { lane: 2 }),
      clip("overlap", { start: 1 }),
      clip("audio", { track: "audio" }),
    ];
    const layers = previewMediaAt(previewMediaRuns(clips), 2);
    expect(layers).toHaveLength(4);
    expect(new Set(layers.map(layer => layer.key)).size).toBe(4);
    expect(layers.every(layer => layer.active)).toBe(true);
  });

  it("honors gaps and backward/forward seeks without leaving stale layers active", () => {
    const runs = previewMediaRuns([
      clip("first"),
      clip("later", { start: 7, inPoint: 5, outPoint: 10 }),
    ]);
    expect(previewMediaAt(runs, 6)).toMatchObject([
      { key: "later", active: false },
    ]);
    expect(previewMediaAt(runs, 8)).toMatchObject([
      { key: "later", active: true },
    ]);
    expect(previewMediaAt(runs, 2)).toMatchObject([
      { key: "first", active: true },
    ]);
    expect(previewMediaAt(runs, 12)).toEqual([]);
  });

  it("uses source speed at boundaries and updates the next clip's editorial properties", () => {
    const first = clip("fast", { speed: 2, outPoint: 10 });
    const second = clip("slow", {
      start: 5,
      inPoint: 10,
      outPoint: 12.5,
      speed: 0.5,
      muted: true,
      hidden: true,
      fadeIn: 1,
    });
    expect(continuousPreviewMedia(first, second)).toBe(true);
    const layer = previewMediaAt(previewMediaRuns([first, second]), 6)[0];
    expect(layer.key).toBe("fast");
    expect(layer.clip).toBe(second);
    expect(previewSourceTime(layer.clip, 6)).toBe(10.5);
    expect(continuousPreviewMedia(first, { ...second, inPoint: 10.05 })).toBe(
      false
    );
  });

  it("bounds preroll per lane and does not mount distant or graphic/caption clips", () => {
    const clips = Array.from({ length: 30 }, (_, index) =>
      clip(`rapid-${index}`, {
        start: index / 10,
        duration: 0.1,
        inPoint: index,
      })
    );
    const layers = previewMediaAt(
      previewMediaRuns([
        ...clips,
        clip("far", { start: 100 }),
        clip("captions", { track: "captions" }),
        clip("music", { track: "audio", start: 1 }),
      ]),
      0
    );
    expect(layers.map(layer => layer.key)).toEqual([
      "rapid-0",
      "rapid-1",
      "rapid-2",
      "music",
    ]);
  });
});

function mediaMock() {
  return {
    currentTime: 0,
    readyState: 4,
    playbackRate: 1,
    paused: true,
    seeking: false,
    play: vi.fn(async (): Promise<void> => undefined),
    pause: vi.fn(),
  };
}

describe("preview media transport", () => {
  it("waits for metadata, cues preroll exactly, and starts only on activation", () => {
    const media = mediaMock();
    media.readyState = 0;
    const transport = createPreviewMediaTransport(media);
    transport.sync(18, 1, false);
    expect(media.currentTime).toBe(0);
    expect(media.play).not.toHaveBeenCalled();
    media.readyState = 1;
    transport.sync(18, 1, false);
    expect(media.currentTime).toBe(18);
    expect(media.play).not.toHaveBeenCalled();
    transport.sync(18, 1, true);
    expect(media.play).toHaveBeenCalledTimes(1);
  });

  it("does not restart play or seek across a continuous cut", () => {
    const media = mediaMock();
    media.currentTime = 4.99;
    media.paused = false;
    const transport = createPreviewMediaTransport(media);
    transport.sync(5.01, 1, true);
    expect(media.currentTime).toBe(4.99);
    expect(media.play).not.toHaveBeenCalled();
    expect(media.pause).not.toHaveBeenCalled();
  });

  it("does not stack unresolved play requests and pauses/disposes deterministically", async () => {
    const media = mediaMock();
    let finish!: () => void;
    media.play.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        })
    );
    const transport = createPreviewMediaTransport(media);
    transport.sync(0, 1, true);
    transport.sync(0.02, 1, true);
    expect(media.play).toHaveBeenCalledTimes(1);
    transport.sync(0.02, 1, false);
    expect(media.pause).toHaveBeenCalledTimes(1);
    finish();
    await Promise.resolve();
    transport.dispose();
    expect(media.pause).toHaveBeenCalledTimes(2);
  });

  it("performs accurate paused seeks and avoids restarting in-flight playback seeks", () => {
    const media = mediaMock();
    const transport = createPreviewMediaTransport(media);
    transport.sync(12.25, 0.5, false);
    expect(media.currentTime).toBe(12.25);
    expect(media.playbackRate).toBe(0.5);
    media.seeking = true;
    media.paused = false;
    transport.sync(13, 0.5, true);
    expect(media.currentTime).toBe(12.25);
    transport.sync(2.5, 2, false);
    expect(media.currentTime).toBe(2.5);
    expect(media.pause).toHaveBeenCalledTimes(1);
  });

  it("honors explicit frame-sized seeks during playback instead of treating them as drift", () => {
    const media = mediaMock();
    media.currentTime = 5;
    media.paused = false;
    const transport = createPreviewMediaTransport(media);
    transport.sync(5 + 1 / 30, 1, true, true);
    expect(media.currentTime).toBe(5 + 1 / 30);
    media.seeking = true;
    transport.sync(5 - 1 / 30, 1, true, true);
    expect(media.currentTime).toBe(5 - 1 / 30);
  });
});
