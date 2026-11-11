import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import { TimelinePreview } from "./TimelinePreview";

vi.mock("@/lib/i18n/ui", () => ({
  useUiText: () => (text: string) => text,
}));

const asset: Asset = {
  id: "source",
  name: "Source.mp4",
  kind: "video",
  status: "ready",
  contentType: "video/mp4",
  size: 100,
  duration: 30,
  url: "/source.mp4",
  createdAt: "2026-11-11",
};
const clip = (id: string, patch: Partial<TimelineClip> = {}): TimelineClip => ({
  id,
  assetId: asset.id,
  track: "video",
  label: id,
  start: 0,
  duration: 5,
  inPoint: 0,
  outPoint: 5,
  color: "#fff",
  locked: false,
  ...patch,
});
const render = (clips: TimelineClip[], time: number) =>
  renderToStaticMarkup(
    <TimelinePreview
      project={
        {
          id: "preview-test",
          title: "Preview",
          aspectRatio: "9:16",
          duration: 15,
          clips,
          transcript: [],
        } as unknown as EditProject
      }
      assets={[asset]}
      time={time}
      playing={true}
    />
  );

describe("timeline media composition", () => {
  it("holds the final project picture at exact and frame-rounded endpoints", () => {
    const clips = [clip("final", { start: 10, inPoint: 10, outPoint: 15 })];
    for (const time of [15, 15.03]) {
      const html = render(clips, time);
      expect(html).toContain('data-preview-clip="final"');
      expect(html).toContain('data-preview-state="active"');
      expect(html).not.toContain("No media at this time");
    }
    expect(render(clips, 15.05)).toContain("No media at this time");
  });
  it("preserves intentional internal and trailing gaps when holding the endpoint", () => {
    const clips = [
      clip("opening"),
      clip("later", { start: 7, duration: 3, inPoint: 7, outPoint: 10 }),
    ];
    expect(render(clips, 6)).toContain("No media at this time");
    expect(render(clips, 15)).toContain("No media at this time");
  });
  it("renders only one video for contiguous pieces while switching the editorial clip", () => {
    const clips = [
      clip("before"),
      clip("after", { start: 5, inPoint: 5, outPoint: 10 }),
    ];
    const before = render(clips, 4.9);
    const after = render(clips, 5);
    expect(before.match(/<video\b/g)).toHaveLength(1);
    expect(after.match(/<video\b/g)).toHaveLength(1);
    expect(before).toContain('data-preview-clip="before"');
    expect(after).toContain('data-preview-clip="after"');
    expect(after).toContain('data-preview-state="active"');
  });

  it("mounts the incoming jump hidden and muted before the cut", () => {
    const html = render(
      [clip("before"), clip("jump", { start: 5, inPoint: 18, outPoint: 23 })],
      4
    );
    const videos = html.match(/<video\b[^>]*>/g) ?? [];
    expect(videos).toHaveLength(2);
    expect(videos[0]).toContain('data-preview-state="active"');
    expect(videos[0]).not.toContain('muted=""');
    expect(videos[1]).toContain('data-preview-state="preload"');
    expect(videos[1]).toContain('muted=""');
    expect(html).toContain("visibility:hidden");
  });

  it("retains concurrent picture and sound layers, and clears completed media", () => {
    const clips = [
      clip("base"),
      clip("upper", { lane: 2 }),
      clip("sound", { track: "audio" }),
    ];
    const active = render(clips, 2);
    expect(active.match(/<video\b/g)).toHaveLength(2);
    expect(active.match(/<audio\b/g)).toHaveLength(1);
    expect(active.indexOf('data-preview-clip="base"')).toBeLessThan(
      active.indexOf('data-preview-clip="upper"')
    );
    const ended = render(clips, 5);
    expect(ended).not.toContain("<video");
    expect(ended).not.toContain("<audio");
  });
});
