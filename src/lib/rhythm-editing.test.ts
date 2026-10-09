import { describe, expect, it } from "vitest";
import type { EditProject, TimelineClip } from "@contracts/workspace";
import { visualFrame, normalizeVisual } from "@contracts/clip-visual";
import { linkClips } from "@contracts/clip-groups";
import {
  measuredAudioBeats,
  timelineBeatCuts,
  cutSelectedOnBeats,
  speechAutoZoom,
} from "./rhythm-editing";
import { pcmWaveform } from "./timeline-media";
import { splitClipGroup } from "./editor-manual";
import { chatSnapshot, recordChatEdit } from "./editor-chat-execution";
import { restoreEditorRevision } from "./editor-history";

const shot = (id: string, extra: Partial<TimelineClip> = {}): TimelineClip => ({
  id,
  label: id,
  track: "video",
  assetId: "source",
  lane: 1,
  start: 2,
  duration: 6,
  inPoint: 10,
  outPoint: 22,
  speed: 2,
  locked: false,
  color: "#ffffff",
  ...extra,
});
const project = (): EditProject => ({
  id: "p",
  title: "QA",
  template: "blank",
  status: "editing",
  platform: "instagram",
  aspectRatio: "9:16",
  duration: 10,
  playhead: 0,
  createdAt: "now",
  updatedAt: "now",
  clips: [
    shot("v"),
    shot("a", { track: "audio" }),
    shot("music", { track: "audio", lane: 2, assetId: "music" }),
  ],
  transcript: [
    {
      id: "cue",
      sourceClipId: "a",
      start: 2,
      end: 8,
      text: "First phrase Second phrase Third phrase",
      words: [
        { text: "First", start: 2, end: 2.4 },
        { text: "phrase", start: 2.5, end: 3 },
        { text: "Second", start: 4, end: 4.4 },
        { text: "phrase", start: 4.5, end: 5 },
        { text: "Third", start: 6, end: 6.4 },
        { text: "phrase", start: 6.5, end: 7 },
      ],
    },
  ],
  revisions: [],
  proposedChanges: [],
  qualitySignals: [],
});
const linked = () => linkClips(project(), ["v", "a"], () => "av-link");
const ids = () => {
  let n = 0;
  return () => `piece-${++n}`;
};

describe("measured rhythm editing", () => {
  it("detects actual stereo impulses without cancelling opposite-phase channels or inventing beats in silence", () => {
    const sr = 8000,
      duration = 5;
    const a = new Float32Array(sr * duration);
    for (const t of [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4])
      for (let j = 0; j < 320; j++)
        a[Math.round(t * sr) + j] =
          0.8 * Math.sin(j * 0.08) * Math.exp(-j / 80);
    const b = Float32Array.from(a, x => -x);
    const beats = measuredAudioBeats(pcmWaveform([a, b], sr));
    expect(beats).toHaveLength(8);
    beats.forEach((beat, i) =>
      expect(beat.sourceTime).toBeCloseTo((i + 1) * 0.5, 1)
    );
    expect(
      measuredAudioBeats(pcmWaveform([new Float32Array(a.length)], sr))
    ).toEqual([]);
    expect(
      measuredAudioBeats({
        peaks: new Float32Array(300).fill(0.5),
        duration: 5,
      })
    ).toEqual([]);
  });
  it("maps beats through source trims, speed and repeated timeline occurrences", () => {
    const beats = [8, 10, 12, 14, 16, 18, 20, 22].map(sourceTime => ({
      sourceTime,
      strength: 1,
    }));
    expect(timelineBeatCuts(beats, shot("v"), 10)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(
      timelineBeatCuts(
        beats,
        shot("v", { start: 0, speed: 1, duration: 12 }),
        20,
        2,
        0.4
      )
    ).toEqual([4, 8]);
    expect(() => timelineBeatCuts(beats, shot("v"), 10, 0)).toThrow(/spacing/);
  });
  it("splits only explicit picture and linked AV, preserving exact source clocks, fades and captions", () => {
    const p = linked();
    p.clips[0].fadeIn = 0.4;
    p.clips[0].fadeOut = 0.5;
    const saved = structuredClone(p);
    const next = cutSelectedOnBeats(p, ["v"], [3, 5, 7], ids());
    expect(p).toEqual(saved);
    const videos = next.clips
      .filter(c => c.track === "video")
      .sort((a, b) => a.start - b.start);
    expect(
      videos.map(c => [c.start, c.inPoint, c.outPoint, c.duration])
    ).toEqual([
      [2, 10, 12, 1],
      [3, 12, 16, 2],
      [5, 16, 20, 2],
      [7, 20, 22, 1],
    ]);
    expect(videos.map(c => [c.fadeIn ?? 0, c.fadeOut ?? 0])).toEqual([
      [0.4, 0],
      [0, 0],
      [0, 0],
      [0, 0.5],
    ]);
    expect(next.clips.find(c => c.id === "music")).toEqual(p.clips[2]);
    for (const v of videos)
      expect(
        next.clips.some(
          c =>
            c.track === "audio" &&
            c.linkId === v.linkId &&
            c.start === v.start &&
            c.inPoint === v.inPoint &&
            c.outPoint === v.outPoint
        )
      ).toBe(true);
    const words = next.transcript.flatMap(s => s.words ?? []);
    expect(words.map(w => w.text)).toEqual(
      p.transcript[0].words!.map(w => w.text)
    );
    words.forEach((w, i) => {
      expect(w.start).toBeCloseTo(p.transcript[0].words![i].start, 8);
      expect(w.end).toBeCloseTo(p.transcript[0].words![i].end, 8);
    });
    const recorded = recordChatEdit(
      { ...p, revisions: [chatSnapshot(p, "before", "Before")] },
      next,
      "beats",
      "Beat cuts"
    );
    expect(restoreEditorRevision(recorded, 0).clips).toEqual(p.clips);
  });
  it("rejects locked linked peers, unknown targets, oversized edits and missing measured speech atomically", () => {
    const p = linked();
    p.clips[1].locked = true;
    const saved = structuredClone(p);
    expect(() => cutSelectedOnBeats(p, ["v"], [3], ids())).toThrow(/Unlock/);
    expect(p).toEqual(saved);
    expect(() => cutSelectedOnBeats(linked(), ["absent"], [3], ids())).toThrow(
      /Select/
    );
    expect(() =>
      cutSelectedOnBeats(
        linked(),
        ["v"],
        Array.from({ length: 49 }, (_, i) => 2 + i / 10),
        ids()
      )
    ).toThrow(/48/);
    expect(() =>
      speechAutoZoom({ ...linked(), transcript: [] }, ["v"])
    ).toThrow(/measured words/);
  });
  it("uses linked speech clocks and preserves zoom after a source split and retime", () => {
    const p = linked();
    const next = speechAutoZoom(p, ["v"], 1.2);
    expect(next.clips[1]).toEqual(p.clips[1]);
    expect(next.clips[2]).toEqual(p.clips[2]);
    expect(visualFrame(next.clips[0], 3).scale).toBe(1);
    expect(visualFrame(next.clips[0], 4.5).scale).toBe(1.2);
    expect(visualFrame(next.clips[0], 6.5).scale).toBe(1);
    const right = splitClipGroup(next, ["v"], 5, ids()).project.clips.find(
      c => c.track === "video" && c.start === 5
    )!;
    expect(visualFrame(right, 6.5).scale).toBe(
      visualFrame(next.clips[0], 6.5).scale
    );
    expect(
      visualFrame({ ...right, speed: 1, duration: right.duration * 2 }, 8).scale
    ).toBe(visualFrame(right, 6.5).scale);
    expect(() => speechAutoZoom(next, ["v"])).toThrow(/already has motion/);
    expect(
      speechAutoZoom(next, ["v"], 1.1, true).clips[0].visual?.keyframes.length
    ).toBeLessThanOrEqual(24);
    const scaled = {
      ...p,
      clips: p.clips.map(c =>
        c.id === "v" ? { ...c, visual: normalizeVisual({ scale: 3.8 }) } : c
      ),
    };
    expect(() => speechAutoZoom(scaled, ["v"], 1.2)).toThrow(/scale bounds/);
  });
});
