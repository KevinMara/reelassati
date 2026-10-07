import { describe, it, expect } from "vitest";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import {
  rollTimelineCut,
  slipTimelineSource,
  rateStretchTimelineClip,
} from "./editor-trimming";
const clip = (
  id: string,
  start: number,
  duration: number,
  inPoint: number,
  track: TimelineClip["track"] = "video"
): TimelineClip => ({
  id,
  assetId: "source",
  track,
  lane: 1,
  label: id,
  start,
  duration,
  inPoint,
  outPoint: inPoint + duration,
  locked: false,
  color: "#fff",
});
const assets = [{ id: "source", kind: "video", duration: 20 }] as Asset[];
const project = (): EditProject => ({
  id: "p",
  title: "Edit",
  template: "blank",
  status: "draft",
  platform: "instagram",
  aspectRatio: "9:16",
  duration: 10,
  playhead: 0,
  createdAt: "",
  updatedAt: "",
  clips: [clip("a", 0, 4, 2), clip("b", 4, 4, 6)],
  transcript: [
    {
      id: "cue",
      sourceClipId: "a",
      start: 1,
      end: 2,
      text: "real words",
      words: [
        { text: "real", start: 1, end: 1.4 },
        { text: "words", start: 1.5, end: 2 },
      ],
    },
  ],
  proposedChanges: [],
  qualitySignals: [],
  revisions: [],
});
describe("source timing tools", () => {
  it("slips a linked AV pair without moving the clip and remaps measured words", () => {
    const p = project();
    p.clips[0].linkId = "av";
    p.clips.push({ ...clip("audio", 0, 4, 2, "audio"), linkId: "av" });
    const n = slipTimelineSource(p, "a", 1, assets);
    expect(
      n.clips
        .filter(c => c.linkId === "av")
        .map(c => [c.start, c.duration, c.inPoint, c.outPoint])
    ).toEqual([
      [0, 4, 3, 7],
      [0, 4, 3, 7],
    ]);
    expect(n.transcript[0]).toMatchObject({
      start: 0,
      end: 1,
      words: [
        { text: "real", start: 0 },
        { text: "words", start: 0.5, end: 1 },
      ],
    });
    expect(n.transcript[0].words?.[0].end).toBeCloseTo(0.4, 8);
  });
  it("rolls one cut without changing the pair's outer span or source continuity", () => {
    const n = rollTimelineCut(project(), "a", 1, assets);
    expect(
      n.clips.map(c => [c.start, c.duration, c.inPoint, c.outPoint])
    ).toEqual([
      [0, 5, 2, 7],
      [5, 3, 7, 10],
    ]);
    expect(n.transcript[0].words).toEqual(project().transcript[0].words);
  });
  it("rate stretches linked clips preserving source span and exact word mapping", () => {
    const p = project();
    p.clips = p.clips.filter(c => c.id === "a");
    p.clips[0].linkId = "av";
    p.clips.push({ ...clip("audio", 0, 4, 2, "audio"), linkId: "av" });
    const n = rateStretchTimelineClip(p, "a", 2, assets);
    expect(
      n.clips.map(c => [c.duration, c.inPoint, c.outPoint, c.speed])
    ).toEqual([
      [2, 2, 6, 2],
      [2, 2, 6, 2],
    ]);
    expect(n.transcript[0]).toMatchObject({
      start: 0.5,
      end: 1,
      words: [
        { text: "real", start: 0.5, end: 0.7 },
        { text: "words", start: 0.75, end: 1 },
      ],
    });
  });
  it("rejects source overruns, locked linked peers, unsupported rates and overlaps", () => {
    const p = project();
    expect(() => slipTimelineSource(p, "a", -3, assets)).toThrow(/boundary/);
    expect(() => rateStretchTimelineClip(p, "a", 5, assets)).toThrow(/overlap/);
    expect(() => rateStretchTimelineClip(p, "a", 0.2, assets)).toThrow(/speed/);
    expect(() => rollTimelineCut(p, "a", 4, assets)).toThrow(/boundary|speed/);
    p.clips[0].linkId = "av";
    p.clips.push({
      ...clip("audio", 0, 4, 2, "audio"),
      linkId: "av",
      locked: true,
    });
    expect(() => slipTimelineSource(p, "a", 1, assets)).toThrow(/Unlock/);
  });
});
