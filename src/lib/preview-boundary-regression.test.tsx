import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import { TimelinePreview } from "../components/studio/TimelinePreview";
import {
  createPreviewMediaTransport,
  previewMediaAt,
  previewMediaRuns,
  previewSourceTime,
} from "./preview-media";

vi.mock("@/lib/i18n/ui", () => ({ useUiText: () => (text: string) => text }));
const boundaries = [0, 5, 9.5, 13, 16.8, 21, 28.366667];
const duration = boundaries.at(-1)!;
const asset = {
  id: "source",
  name: "Measured source",
  kind: "video",
  status: "ready",
  url: "/source.mp4",
  contentType: "video/mp4",
  size: 100,
  duration,
  createdAt: "2026-11-11",
} as Asset;
const clips = boundaries.slice(0, -1).map((start, index): TimelineClip => ({
  id: `cut-${index}`,
  assetId: asset.id,
  label: `Cut ${index + 1}`,
  track: "video",
  start,
  duration: boundaries[index + 1] - start,
  inPoint: start,
  outPoint: boundaries[index + 1],
  speed: 1,
  volume: 1,
  locked: false,
  color: "#fff",
}));

describe("reported six-cut preview regression", () => {
  it("has an active picture at every export-frame time and immediately on each side of all five joins", () => {
    const runs = previewMediaRuns(clips);
    const clocks = [
      ...Array.from(
        { length: Math.ceil(duration * 30) },
        (_, frame) => frame / 30
      ).filter(time => time < duration),
      ...boundaries
        .slice(1, -1)
        .flatMap(boundary => [
          boundary - 0.00000001,
          boundary,
          boundary + 0.00000001,
        ]),
    ];
    for (const time of clocks) {
      const active = previewMediaAt(runs, time).filter(layer => layer.active);
      expect(active, `picture at ${time}`).toHaveLength(1);
      expect(active[0].key).toBe("cut-0");
      expect(previewSourceTime(active[0].clip, time)).toBeCloseTo(time, 7);
    }
  });

  it("corrects the observed startup lag without adding new seeks at stable source-contiguous joins", () => {
    let sourceTime = 0;
    const writes: number[] = [];
    const media = {
      get currentTime() {
        return sourceTime;
      },
      set currentTime(value: number) {
        writes.push(value);
        sourceTime = value;
      },
      readyState: 4,
      playbackRate: 1,
      paused: false,
      seeking: false,
      play: vi.fn(async () => undefined),
      pause: vi.fn(),
    };
    const transport = createPreviewMediaTransport(media);
    transport.sync(0.519, 1, true);
    transport.sync(1.635, 1, true);
    expect(writes).toEqual([0.519, 1.635]);
    const runs = previewMediaRuns(clips);
    for (const time of boundaries.slice(1, -1)) {
      sourceTime = time - 0.08; // advancing native decoder, within playback tolerance
      const layer = previewMediaAt(runs, time).find(item => item.active)!;
      transport.sync(previewSourceTime(layer.clip, time), 1, true);
    }
    expect(writes).toEqual([0.519, 1.635]);
    expect(media.play).not.toHaveBeenCalled();
    expect(media.pause).not.toHaveBeenCalled();
  });

  it("keeps a genuine timeline gap empty while its prepared incoming source stays hidden and muted", () => {
    const gapClips = clips.map((clip, index) => ({
      ...clip,
      start: clip.start + (index >= 3 ? 0.75 : 0),
    }));
    const project = {
      id: "gap",
      title: "Gap",
      aspectRatio: "9:16",
      duration: duration + 0.75,
      clips: gapClips,
      transcript: [],
    } as unknown as EditProject;
    for (const time of [13, 13.3, 13.749]) {
      const html = renderToStaticMarkup(
        <TimelinePreview
          project={project}
          assets={[asset]}
          time={time}
          playing
        />
      );
      expect(html).not.toContain('data-preview-state="active"');
      expect(html).toContain('data-preview-state="preload"');
      expect(html).toContain("visibility:hidden");
      expect(html).toContain('muted=""');
    }
    const atJoin = renderToStaticMarkup(
      <TimelinePreview
        project={project}
        assets={[asset]}
        time={13.75}
        playing
      />
    );
    expect(atJoin).toContain('data-preview-clip="cut-3"');
    expect(atJoin).toContain('data-preview-state="active"');
  });
});
