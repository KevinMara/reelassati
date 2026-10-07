import { describe, it, expect } from "vitest";
import {
  effectiveTimelineClips,
  reorderTimelineTrack,
  timelineTrackGain,
  updateTimelineTrack,
} from "@contracts/timeline-mixer";
import { isPrimaryFootage } from "@contracts/timeline-layers";
import { restoreEditorRevision } from "./editor-history";
import type { EditProject, TimelineClip } from "@contracts/workspace";

const clip = (
  id: string,
  track: TimelineClip["track"],
  lane: number
): TimelineClip => ({
  id,
  track,
  lane,
  label: id,
  start: 0,
  duration: 4,
  inPoint: 0,
  outPoint: 4,
  locked: false,
  color: "#fff",
});
const project = (): EditProject => ({
  id: "p",
  title: "Edit",
  template: "blank",
  status: "draft",
  platform: "instagram",
  aspectRatio: "9:16",
  duration: 4,
  playhead: 1,
  createdAt: "",
  updatedAt: "",
  clips: [
    clip("speech", "video", 1),
    clip("overlay", "video", 2),
    clip("music", "audio", 1),
  ],
  transcript: [{ id: "cue", start: 0, end: 1, text: "Measured speech" }],
  proposedChanges: [],
  qualitySignals: [],
  revisions: [],
});
describe("saved track mixing", () => {
  it("solos picture and sound independently without overwriting per-clip settings", () => {
    const p = updateTimelineTrack(
      updateTimelineTrack(
        project(),
        { kind: "audio", number: 1 },
        { soloSound: true, gain: 1.5 }
      ),
      { kind: "video", number: 2 },
      { soloPicture: true }
    );
    const runtime = effectiveTimelineClips(p);
    expect(runtime.find(c => c.id === "speech")).toMatchObject({
      muted: true,
      hidden: true,
    });
    expect(runtime.find(c => c.id === "overlay")).toMatchObject({
      muted: true,
      hidden: false,
    });
    expect(runtime.find(c => c.id === "music")?.muted).toBe(false);
    expect(timelineTrackGain(p, p.clips[2])).toBe(1.5);
    expect(p.clips[0].muted).toBeUndefined();
    expect(
      effectiveTimelineClips({
        ...p,
        clips: p.clips.filter(c => c.id !== "music"),
      }).some(c => c.muted)
    ).toBe(false);
  });
  it("reorders visual layers while preserving primary speech and binding legacy captions", () => {
    const p = updateTimelineTrack(
      project(),
      { kind: "video", number: 1 },
      { name: "Presenter" }
    );
    const reordered = reorderTimelineTrack(
      p,
      { kind: "video", number: 1 },
      "up"
    );
    expect(reordered.clips.find(c => c.id === "speech")?.lane).toBe(2);
    expect(reordered.clips.filter(isPrimaryFootage).map(c => c.id)).toEqual([
      "speech",
    ]);
    expect(reordered.transcript[0].sourceClipId).toBe("speech");
    expect(reordered.trackSettings?.[0]).toMatchObject({
      name: "Presenter",
      number: 2,
    });
  });
  it("rejects locked track edits and restores mix/FPS through a revision", () => {
    const p = project();
    p.clips[0].locked = true;
    expect(() =>
      reorderTimelineTrack(p, { kind: "video", number: 1 }, "up")
    ).toThrow(/Unlock/);
    expect(() =>
      updateTimelineTrack(p, { kind: "video", number: 1 }, { gain: 0.5 })
    ).toThrow(/Unlock/);
    p.revisions = [
      {
        id: "old",
        label: "Before mix",
        createdAt: "",
        frameRate: 24,
        trackSettings: [{ kind: "audio", number: 1, gain: 0.5 }],
        clips: p.clips,
        transcript: p.transcript,
      },
    ];
    expect(
      restoreEditorRevision({ ...p, frameRate: 60, trackSettings: [] }, 0)
    ).toMatchObject({ frameRate: 24, trackSettings: [{ gain: 0.5 }] });
  });
});
