import { describe, expect, it } from "vitest";
import type { EditProject, TimelineClip } from "./workspace";
import { buildEditorialSpeechEvidence } from "./editorial-evidence";

const source = {
  id: "source",
  assetId: "media",
  track: "video",
  start: 5,
  duration: 3,
  inPoint: 10,
  outPoint: 16,
  speed: 2,
  locked: false,
} as TimelineClip;
const project = {
  duration: 12,
  clips: [source],
  transcript: [],
  sourceSpeech: [
    {
      assetId: "media",
      segments: [
        {
          id: "phrase",
          start: 11,
          end: 15,
          text: "Questo esempio funziona",
          words: [
            { text: "Questo", start: 11, end: 12 },
            { text: "esempio", start: 12, end: 13 },
            { text: "funziona", start: 14, end: 15 },
          ],
        },
      ],
    },
  ],
} as EditProject;

describe("editorial source speech evidence", () => {
  it("maps exact word clocks through source trim, placement and speed even without captions", () => {
    expect(buildEditorialSpeechEvidence(project)).toEqual([
      {
        clipId: "source",
        assetId: "media",
        start: 5.5,
        end: 7.5,
        sourceStart: 11,
        sourceEnd: 15,
        text: "Questo esempio funziona",
        partial: false,
        words: [
          { text: "Questo", start: 5.5, end: 6 },
          { text: "esempio", start: 6, end: 6.5 },
          { text: "funziona", start: 7, end: 7.5 },
        ],
      },
    ]);
  });
  it("marks truncated phrases and never presents a clipped word as a whole timed word", () => {
    const changed = {
      ...project,
      duration: 6.25,
      clips: [{ ...source, inPoint: 11.5, outPoint: 16 }],
    } as EditProject;
    const evidence = buildEditorialSpeechEvidence(changed)[0];
    expect(evidence).toMatchObject({
      start: 5,
      end: 6.25,
      sourceStart: 11.5,
      sourceEnd: 14,
      partial: true,
    });
    expect(evidence.words).toEqual([
      { text: "esempio", start: 5.25, end: 5.75 },
    ]);
  });
  it("keeps repeated occurrences distinct and does not manufacture silence from missing recognition", () => {
    const repeated = {
      ...project,
      clips: [
        source,
        { ...source, id: "reprise", start: 8, inPoint: 11, outPoint: 14 },
      ],
    } as EditProject;
    const evidence = buildEditorialSpeechEvidence(repeated);
    expect(evidence.map(row => row.clipId)).toEqual(["source", "reprise"]);
    expect(evidence[1]).toMatchObject({ start: 8, end: 9.5, partial: true });
    expect(
      buildEditorialSpeechEvidence({ ...project, sourceSpeech: [] })
    ).toEqual([]);
  });
  it("excludes muted, zero gain and transition-handle copies while retaining hidden audible video", () => {
    for (const patch of [
      { muted: true },
      { volume: 0 },
      { transitionHandle: {} },
    ]) {
      expect(
        buildEditorialSpeechEvidence({
          ...project,
          clips: [{ ...source, ...patch }],
        } as EditProject)
      ).toEqual([]);
    }
    expect(
      buildEditorialSpeechEvidence({
        ...project,
        trackSettings: [{ kind: "video", number: 1, gain: 0 }],
      })
    ).toEqual([]);
    expect(
      buildEditorialSpeechEvidence({
        ...project,
        clips: [{ ...source, hidden: true }],
      })
    ).toHaveLength(1);
  });
});
