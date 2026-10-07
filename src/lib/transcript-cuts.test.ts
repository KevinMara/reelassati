import { describe, expect, it } from "vitest";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import { audioMixAt } from "@contracts/audio-mix";
import {
  buildStoryBeatEvidence,
  normalizeStoryBeats,
} from "@contracts/story-beats";
import { restoreEditorRevision } from "./editor-history";
import {
  buildTranscriptCutPlan,
  cutTranscriptWords,
  getTranscriptCutWords,
} from "./transcript-cuts";

const clip = (id: string, extra: Partial<TimelineClip> = {}): TimelineClip => ({
  id,
  assetId: "video",
  track: "video",
  lane: 1,
  label: id,
  color: "#ffffff",
  start: 0,
  duration: 8,
  inPoint: 10,
  outPoint: 26,
  speed: 2,
  locked: false,
  volume: 0.8,
  audioMix: {
    pan: -0.25,
    gainKeys: [
      { at: 10, gain: 0.25 },
      { at: 26, gain: 1 },
    ],
  },
  ...extra,
});
const assets: Asset[] = [
  {
    id: "video",
    name: "Speech.mp4",
    kind: "video",
    contentType: "video/mp4",
    url: "https://media.example/speech.mp4",
    size: 1000,
    duration: 30,
    status: "ready",
    createdAt: "now",
  },
];
const project = (): EditProject => ({
  id: "p",
  title: "Speech edit",
  template: "blank",
  status: "editing",
  platform: "instagram",
  aspectRatio: "1:1",
  duration: 8,
  playhead: 6,
  createdAt: "now",
  updatedAt: "now",
  revisions: [],
  qualitySignals: [],
  proposedChanges: [],
  clips: [
    clip("speech"),
    clip("music", {
      track: "audio",
      lane: 2,
      start: 0,
      inPoint: 0,
      outPoint: 8,
      speed: 1,
      groupId: undefined,
      linkId: undefined,
    }),
  ],
  transcript: [
    {
      id: "cue",
      sourceClipId: "speech",
      start: 0,
      end: 8,
      text: "First second third fourth",
      words: [
        { text: "First", start: 0.5, end: 1 },
        { text: "second", start: 2, end: 2.5 },
        { text: "third", start: 4, end: 5 },
        { text: "fourth", start: 6, end: 7 },
      ],
    },
  ],
});

describe("real transcript word cuts", () => {
  it("uses measured word boundaries and the trimmed/speed-adjusted source clock", () => {
    const words = getTranscriptCutWords(project(), assets);
    expect(words).toHaveLength(4);
    expect(words[1]).toMatchObject({
      segmentId: "cue",
      wordIndex: 1,
      text: "second",
      start: 2,
      end: 2.5,
      sourceClipId: "speech",
      sourceStart: 14,
      sourceEnd: 15,
    });
    const input = project();
    input.transcript[0].sourceClipId = undefined;
    expect(getTranscriptCutWords(input, assets)).toHaveLength(4);
  });

  it("accepts measured ready video exports as speech footage, preserving their source ownership", () => {
    const exportAssets: Asset[] = [
      { ...assets[0], kind: "export", contentType: "video/webm" },
    ];
    expect(getTranscriptCutWords(project(), exportAssets)[1]).toMatchObject({
      sourceClipId: "speech",
      sourceStart: 14,
      sourceEnd: 15,
    });
    const cut = cutTranscriptWords(project(), exportAssets, [
      { segmentId: "cue", wordIndex: 1 },
    ]);
    expect(cut.duration).toBe(7.5);
    expect(
      cut.transcript.every(cue =>
        cut.clips.some(clip => clip.id === cue.sourceClipId)
      )
    ).toBe(true);
    expect(
      getTranscriptCutWords(project(), [
        { ...exportAssets[0], contentType: "application/json" },
      ])
    ).toEqual([]);
  });

  it("removes disjoint selected spans, not the silent gaps, across every track", () => {
    const input = project();
    const before = structuredClone(input);
    const selections = [
      { segmentId: "cue", wordIndex: 1 },
      { segmentId: "cue", wordIndex: 3 },
    ];
    expect(buildTranscriptCutPlan(input, assets, selections)).toMatchObject({
      intervals: [
        { start: 2, end: 2.5 },
        { start: 6, end: 7 },
      ],
      wordCount: 2,
      removedDuration: 1.5,
    });
    const cut = cutTranscriptWords(input, assets, selections);
    expect(input).toEqual(before);
    expect(cut.duration).toBe(6.5);
    expect(cut.playhead).toBe(5.5);
    expect(
      cut.clips
        .filter(clip => clip.track === "video")
        .map(clip => [clip.start, clip.duration, clip.inPoint, clip.outPoint])
    ).toEqual([
      [0, 2, 10, 14],
      [2, 3.5, 15, 22],
      [5.5, 1, 24, 26],
    ]);
    expect(
      cut.clips
        .filter(clip => clip.track === "audio")
        .map(clip => [clip.start, clip.duration, clip.inPoint, clip.outPoint])
    ).toEqual([
      [0, 2, 0, 2],
      [2, 3.5, 2.5, 6],
      [5.5, 1, 7, 8],
    ]);
    expect(cut.transcript.map(cue => cue.text)).toEqual(["First", "third"]);
    expect(
      cut.transcript
        .flatMap(cue => cue.words ?? [])
        .map(word => [word.text, word.start, word.end])
    ).toEqual([
      ["First", 0.5, 1],
      ["third", 3.5, 4.5],
    ]);
    for (const cue of cut.transcript) {
      const source = cut.clips.find(clip => clip.id === cue.sourceClipId)!;
      expect(source).toBeDefined();
      expect(cue.start).toBeGreaterThanOrEqual(source.start);
      expect(cue.end).toBeLessThanOrEqual(source.start + source.duration);
    }
  });

  it("cuts an overlapping union once and deduplicates repeated selections", () => {
    const input = project();
    input.transcript[0].words![1].start = 0.9;
    input.transcript[0].words![1].end = 1.4;
    const selections = [
      { segmentId: "cue", wordIndex: 0 },
      { segmentId: "cue", wordIndex: 1 },
      { segmentId: "cue", wordIndex: 0 },
    ];
    const plan = buildTranscriptCutPlan(input, assets, selections);
    expect(plan.wordCount).toBe(2);
    expect(plan.intervals).toEqual([{ start: 0.5, end: 1.4 }]);
    expect(plan.removedDuration).toBeCloseTo(0.9);
    expect(cutTranscriptWords(input, assets, selections).duration).toBeCloseTo(
      7.1
    );
  });

  it("preserves group/link membership and source-clock gain automation on pieces", () => {
    const input = project();
    input.clips[0] = {
      ...input.clips[0],
      groupId: "group",
      linkId: "source-link",
      muted: true,
    };
    input.clips[1] = {
      ...input.clips[0],
      id: "voice",
      label: "Detached speech",
      track: "audio",
      lane: 2,
      muted: false,
    };
    input.transcript[0].sourceClipId = "voice";
    const cut = cutTranscriptWords(input, assets, [
      { segmentId: "cue", wordIndex: 1 },
    ]);
    const after = cut.clips.find(clip => clip.id === "voice-after-2.5")!;
    expect(after).toMatchObject({
      groupId: "group",
      audioMix: input.clips[1].audioMix,
      volume: 0.8,
      speed: 2,
    });
    expect(after.linkId).toBeTruthy();
    expect(after.linkId).not.toBe("source-link");
    expect(cut.clips.find(clip => clip.id === "speech-after-2.5")?.linkId).toBe(
      after.linkId
    );
    expect(audioMixAt(after, 3).sourceTime).toBe(
      audioMixAt(input.clips[1], 3.5).sourceTime
    );
    expect(audioMixAt(after, 3).gain).toBeCloseTo(
      audioMixAt(input.clips[1], 3.5).gain
    );
  });

  it("fails atomically when a later locked track or generated shot transition would move", () => {
    const input = project();
    input.clips.push(
      clip("locked", {
        start: 7,
        duration: 1,
        inPoint: 10,
        outPoint: 11,
        speed: 1,
        locked: true,
      })
    );
    const before = structuredClone(input);
    expect(() =>
      cutTranscriptWords(input, assets, [{ segmentId: "cue", wordIndex: 1 }])
    ).toThrow(/Unlock/);
    expect(input).toEqual(before);
    input.clips[2].locked = false;
    input.clips[2].shotTransition = {
      outgoingId: "speech",
      incomingId: "locked",
      incomingEntrance: { kind: "none", duration: 0 },
      outgoingExit: { kind: "none", duration: 0 },
    };
    expect(() =>
      cutTranscriptWords(input, assets, [{ segmentId: "cue", wordIndex: 1 }])
    ).toThrow(/Remove the transition/);
  });

  it("never invents timing for static, mismatched, stale, orphaned or non-speech cues", () => {
    const input = project();
    input.transcript[0].words = undefined;
    expect(getTranscriptCutWords(input, assets)).toEqual([]);
    expect(() =>
      buildTranscriptCutPlan(input, assets, [
        { segmentId: "cue", wordIndex: 0 },
      ])
    ).toThrow(/source timing/);
    input.transcript = project().transcript;
    input.transcript[0].text = "Manually replaced caption";
    expect(getTranscriptCutWords(input, assets)).toEqual([]);
    input.transcript = project().transcript;
    input.transcript[0].sourceClipId = "deleted-source";
    expect(getTranscriptCutWords(input, assets)).toEqual([]);
    input.transcript = project().transcript;
    expect(
      getTranscriptCutWords(input, [{ ...assets[0], kind: "image" }])
    ).toEqual([]);
    expect(
      getTranscriptCutWords(input, [{ ...assets[0], status: "processing" }])
    ).toEqual([]);
    expect(
      getTranscriptCutWords(input, [{ ...assets[0], duration: undefined }])
    ).toEqual([]);
    expect(() =>
      buildTranscriptCutPlan(input, assets, [
        { segmentId: "gone", wordIndex: 0 },
      ])
    ).toThrow(/source timing/);
    expect(() =>
      buildTranscriptCutPlan(input, assets, [
        { segmentId: "cue", wordIndex: 99 },
      ])
    ).toThrow(/source timing/);
  });

  it("leaves a locked clip before the removed span untouched", () => {
    const input = project();
    const earlier = clip("earlier", {
      track: "overlay",
      lane: 2,
      duration: 1,
      inPoint: 10,
      outPoint: 11,
      speed: 1,
      locked: true,
    });
    input.clips.push(earlier);
    const cut = cutTranscriptWords(input, assets, [
      { segmentId: "cue", wordIndex: 1 },
    ]);
    expect(cut.clips.find(clip => clip.id === earlier.id)).toEqual(earlier);
    expect(cut.duration).toBe(7.5);
  });

  it("retains an unchanged story section before the cut while dropping changed evidence", () => {
    const input = project();
    input.transcript[0].start = 1.5;
    input.transcript[0].words![0] = { text: "First", start: 1.5, end: 1.8 };
    input.transcript.push({
      id: "intro",
      sourceClipId: "speech",
      start: 0.1,
      end: 0.4,
      text: "Intro",
      words: [{ text: "Intro", start: 0.1, end: 0.4 }],
    });
    input.storyBeats = normalizeStoryBeats(
      [
        { kind: "hook", evidenceIds: ["transcript:intro"] },
        { kind: "body", evidenceIds: ["transcript:cue"] },
      ],
      buildStoryBeatEvidence(input),
      input.duration
    );
    expect(input.storyBeats).toHaveLength(2);
    const cut = cutTranscriptWords(input, assets, [
      { segmentId: "cue", wordIndex: 1 },
    ]);
    expect(cut.storyBeats).toEqual([input.storyBeats[0]]);
  });

  it("requires audible output and rejects invalid source or word bounds", () => {
    const input = project();
    input.clips[0].muted = true;
    expect(getTranscriptCutWords(input, assets)).toEqual([]);
    input.clips[0].muted = false;
    input.trackSettings = [{ kind: "video", number: 1, gain: 0 }];
    expect(getTranscriptCutWords(input, assets)).toEqual([]);
    input.trackSettings = [{ kind: "audio", number: 2, soloSound: true }];
    expect(getTranscriptCutWords(input, assets)).toEqual([]);
    input.trackSettings = [];
    input.clips[0].audioMix = { pan: 0, gainKeys: [{ at: 0, gain: 0 }] };
    expect(getTranscriptCutWords(input, assets)).toEqual([]);
    input.clips = project().clips;
    input.clips[0].outPoint = 29;
    expect(getTranscriptCutWords(input, assets)).toEqual([]);
    input.clips = project().clips;
    input.transcript[0].words![0].start = -1;
    expect(
      getTranscriptCutWords(input, assets).map(word => word.wordIndex)
    ).toEqual([1, 2, 3]);
  });

  it("invalidates stale story evidence and restores through an actual saved revision", () => {
    const input = project();
    input.storyBeats = normalizeStoryBeats(
      [{ kind: "body", evidenceIds: ["transcript:cue"] }],
      buildStoryBeatEvidence(input),
      input.duration
    );
    expect(input.storyBeats).toHaveLength(1);
    input.revisions = [
      {
        id: "before",
        label: "Before transcript cut",
        createdAt: "now",
        duration: input.duration,
        clips: structuredClone(input.clips),
        transcript: structuredClone(input.transcript),
        storyBeats: structuredClone(input.storyBeats),
      },
    ];
    const cut = cutTranscriptWords(input, assets, [
      { segmentId: "cue", wordIndex: 1 },
    ]);
    expect(cut.storyBeats).toEqual([]);
    const restored = restoreEditorRevision(cut, 0);
    expect(restored.clips).toEqual(input.clips);
    expect(restored.transcript).toEqual(input.transcript);
    expect(restored.storyBeats).toEqual(input.storyBeats);
    expect(restored.duration).toBe(input.duration);
  });
});
