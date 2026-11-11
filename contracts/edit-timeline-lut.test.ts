import { describe, expect, it } from "vitest";
import { applyEditOperation } from "./edit-timeline";
import { restoreEditorRevision } from "../src/lib/editor-history";
import type { ClipColorLut } from "./color-lut";
import type { EditOperation, EditProject, TimelineClip } from "./workspace";

const sha256 = "a".repeat(64);
const look: ClipColorLut = {
  id: `stock-${sha256.slice(0, 24)}`,
  name: "Catalog look",
  sha256,
  amount: 0.7,
};
const picture: TimelineClip = {
  id: "picture",
  assetId: "source",
  track: "video",
  label: "Source",
  start: 0,
  duration: 10,
  inPoint: 3,
  outPoint: 13,
  locked: false,
  color: "blue",
};
function fixture(clips = [picture]): EditProject {
  return {
    id: "project",
    title: "Look edit",
    template: "custom",
    status: "draft",
    platform: "instagram",
    aspectRatio: "9:16",
    duration: 10,
    playhead: 0,
    createdAt: "",
    updatedAt: "",
    clips: structuredClone(clips),
    transcript: [],
    proposedChanges: [],
    qualitySignals: [],
    revisions: [],
  };
}
function operation(
  parameters: EditOperation["parameters"] = { colorLut: look },
  overrides: Partial<EditOperation> = {}
): EditOperation {
  return {
    id: "look",
    type: "style",
    label: "Apply catalog look",
    reason: "Match the requested visual treatment",
    start: 0,
    end: 10,
    confidence: 1,
    intensity: "balanced",
    targetClipIds: ["picture"],
    status: "proposed",
    parameters,
    ...overrides,
  };
}

describe("catalog look timeline operations", () => {
  it("applies an actual immutable look only inside its requested source interval", () => {
    const source = fixture();
    const edited = applyEditOperation(
      source,
      operation(undefined, { start: 2, end: 7 })
    );
    expect(
      edited.clips.map(c => [
        c.start,
        c.duration,
        c.inPoint,
        c.outPoint,
        c.colorLut,
      ])
    ).toEqual([
      [0, 2, 3, 5, undefined],
      [2, 5, 5, 10, look],
      [7, 3, 10, 13, undefined],
    ]);
    expect(source.clips).toEqual([picture]);
    expect(edited.duration).toBe(10);
  });

  it("preserves a look through ordinary grades, retains zero strength and explicitly resets", () => {
    const applied = applyEditOperation(fixture(), operation());
    const graded = applyEditOperation(applied, operation({ contrast: 1.1 }));
    expect(graded.clips[0]).toMatchObject({ colorLut: look, contrast: 1.1 });
    const zero = applyEditOperation(
      graded,
      operation({ colorLut: { ...look, amount: 0 } })
    );
    expect(zero.clips[0].colorLut?.amount).toBe(0);
    const reset = applyEditOperation(zero, operation({ colorLut: null }));
    expect(reset.clips[0]).toMatchObject({ colorLut: null, contrast: 1.1 });
  });

  it("segments linked audio on the same clocks without giving it picture controls", () => {
    const linked = { ...picture, linkId: "pair" };
    const audio: TimelineClip = {
      ...linked,
      id: "audio",
      track: "audio",
      volume: 0.4,
      muted: true,
      contrast: 0.9,
    };
    const source = fixture([linked, audio]);
    const edited = applyEditOperation(
      source,
      operation(
        { colorLut: look, contrast: 1.1 },
        {
          start: 2,
          end: 7,
          targetClipIds: ["picture", "audio"],
        }
      )
    );
    const visuals = edited.clips.filter(c => c.track === "video");
    const sounds = edited.clips.filter(c => c.track === "audio");
    expect(sounds).toHaveLength(3);
    sounds.forEach((sound, index) => {
      expect(sound).toMatchObject({
        start: visuals[index].start,
        duration: visuals[index].duration,
        inPoint: visuals[index].inPoint,
        outPoint: visuals[index].outPoint,
        linkId: visuals[index].linkId,
        volume: 0.4,
        muted: true,
        contrast: 0.9,
      });
      expect(sound.colorLut).toBeUndefined();
    });
    expect(visuals[1].colorLut).toEqual(look);
    const whole = applyEditOperation(
      source,
      operation(undefined, { targetClipIds: ["picture", "audio"] })
    );
    expect(whole.clips.find(c => c.id === "audio")).toEqual(audio);
  });

  it("rejects non-picture-only targets and invalid identities or strengths before mutation", () => {
    const source = fixture();
    for (const invalid of [
      { ...look, id: "stock-unverified" },
      { ...look, amount: Number.NaN },
      { ...look, amount: -0.1 },
      { ...look, amount: 1.1 },
    ])
      expect(() =>
        applyEditOperation(source, operation({ colorLut: invalid }))
      ).toThrow(/valid catalog/);
    const audio = fixture([{ ...picture, track: "audio" }]);
    expect(() => applyEditOperation(audio, operation())).toThrow(
      /picture clip/
    );
    expect(source.clips).toEqual([picture]);
  });

  it("retains the exact identity and strength through saved revision restoration", () => {
    const edited = applyEditOperation(fixture(), operation());
    const saved = JSON.parse(
      JSON.stringify({
        ...edited,
        revisions: [
          {
            id: "look-revision",
            label: "Look",
            createdAt: "",
            clips: edited.clips,
            transcript: [],
          },
        ],
      })
    ) as EditProject;
    const reset = applyEditOperation(saved, operation({ colorLut: null }));
    expect(restoreEditorRevision(reset, 0).clips[0].colorLut).toEqual(look);
  });
});
