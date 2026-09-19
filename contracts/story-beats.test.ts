import { describe, expect, it } from "vitest";
import {
  buildStoryBeatEvidence,
  normalizeStoryBeats,
  storyBeatsAreCurrent,
  updateStoryBeat,
  type StoryBeatEvidence,
} from "./story-beats";

const evidence: StoryBeatEvidence[] = [
  {
    id: "a",
    kind: "transcript",
    start: 0.4,
    end: 2.3,
    text: "Here is the real result.",
  },
  {
    id: "b",
    kind: "transcript",
    start: 2.5,
    end: 5.4,
    text: "First, watch the example.",
  },
  {
    id: "c",
    kind: "transcript",
    start: 5.4,
    end: 7.9,
    text: "That is how it works.",
  },
];

describe("evidence-backed story sections", () => {
  it("anchors model labels to measured evidence, ignoring invented time boundaries", () => {
    const beats = normalizeStoryBeats(
      {
        beats: [
          {
            kind: "hook",
            label: "The result",
            start: 0,
            end: 3,
            evidenceIds: ["a"],
          },
          {
            kind: "body",
            label: "The example",
            start: 3,
            end: 30,
            evidenceIds: ["b", "c"],
          },
        ],
      },
      evidence,
      10
    );
    expect(beats.map(beat => [beat.label, beat.start, beat.end])).toEqual([
      ["The result", 0.4, 2.3],
      ["The example", 2.5, 7.9],
    ]);
  });

  it("never fabricates a hook or duration when evidence is absent or references are unknown", () => {
    const rows = [{ kind: "hook", evidenceIds: ["missing"], start: 0, end: 3 }];
    expect(normalizeStoryBeats(rows, [], 10)).toEqual([]);
    expect(normalizeStoryBeats(rows, evidence, 10)).toEqual([]);
    expect(
      normalizeStoryBeats(
        [{ kind: "body", evidenceIds: ["a", "missing"] }],
        evidence,
        10
      )
    ).toEqual([]);
    expect(
      normalizeStoryBeats([{ kind: "body", evidenceIds: [] }], evidence, 10)
    ).toEqual([]);
  });

  it("allows adjacent sections and discards overlaps instead of silently shifting their timestamps", () => {
    const beats = normalizeStoryBeats(
      [
        { kind: "body", evidenceIds: ["b"] },
        { kind: "proof", evidenceIds: ["b", "c"] },
        { kind: "payoff", evidenceIds: ["c"] },
      ],
      evidence,
      10
    );
    expect(beats.map(beat => [beat.kind, beat.start, beat.end])).toEqual([
      ["body", 2.5, 5.4],
      ["payoff", 5.4, 7.9],
    ]);
  });

  it("maps trimmed and accelerated source observations to the current timeline", () => {
    const result = buildStoryBeatEvidence({
      duration: 20,
      transcript: [],
      clips: [
        {
          id: "clip",
          assetId: "asset",
          track: "video",
          label: "Source",
          start: 8,
          duration: 4,
          inPoint: 10,
          outPoint: 18,
          speed: 2,
          locked: false,
          color: "#000000",
        },
      ],
      sourceReviews: [
        {
          assetId: "asset",
          reviewedAt: "2026-09-19T12:00:00Z",
          summary: "Demo",
          captions: "unknown",
          captionNote: "",
          audio: "unknown",
          audioNote: "",
          moments: [
            {
              start: 7,
              end: 11,
              note: "The opening reaches into the visible trim.",
            },
            { start: 12, end: 16, note: "The actual demonstration." },
            { start: 19, end: 20, note: "Not in this timeline." },
          ],
        },
      ],
    });
    expect(result.map(item => [item.start, item.end])).toEqual([
      [8, 8.5],
      [9, 11],
    ]);
    expect(
      result.every(item => item.assetId === "asset" && item.clipId === "clip")
    ).toBe(true);
  });

  it("marks sections stale when their text, timing or referenced evidence changes", () => {
    const beats = normalizeStoryBeats(
      [{ kind: "hook", evidenceIds: ["a"] }],
      evidence,
      10
    );
    expect(storyBeatsAreCurrent(beats, evidence)).toBe(true);
    expect(storyBeatsAreCurrent(beats, evidence.slice(1))).toBe(false);
    expect(
      storyBeatsAreCurrent(
        beats,
        evidence.map(item => (item.id === "a" ? { ...item, start: 1 } : item))
      )
    ).toBe(false);
    expect(
      storyBeatsAreCurrent(
        beats,
        evidence.map(item =>
          item.id === "a" ? { ...item, text: "A changed sentence." } : item
        )
      )
    ).toBe(false);
  });

  it("allows deliberate manual adjustments but rejects overlapping or invalid ranges", () => {
    const beats = normalizeStoryBeats(
      [
        { kind: "hook", evidenceIds: ["a"] },
        { kind: "body", evidenceIds: ["b"] },
      ],
      evidence,
      10
    );
    const patch = {
      label: "Opening",
      kind: "hook" as const,
      start: 0,
      end: 2.5,
    };
    const next = updateStoryBeat(beats, beats[0].id, patch, 10);
    expect(next?.[0]).toMatchObject({
      label: "Opening",
      start: 0,
      end: 2.5,
      origin: "manual",
    });
    expect(
      updateStoryBeat(beats, beats[0].id, { ...patch, end: 2.6 }, 10)
    ).toBeNull();
    expect(
      updateStoryBeat(beats, beats[0].id, { ...patch, start: -1 }, 10)
    ).toBeNull();
    expect(
      updateStoryBeat(beats, beats[0].id, { ...patch, start: 2.5 }, 10)
    ).toBeNull();
    expect(
      updateStoryBeat(beats, beats[0].id, { ...patch, end: Number.NaN }, 10)
    ).toBeNull();
  });
});
