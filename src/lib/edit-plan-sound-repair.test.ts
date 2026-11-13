import { describe, expect, it } from "vitest";
import {
  buildEditPlanningContext,
  resolveEditPlanningReferences,
} from "@contracts/edit-planning-context";
import {
  editPlanSoundRepairFeedback,
  mergeEditPlanSoundRepair,
} from "@contracts/edit-plan-sound-repair";
import type { EditProject } from "@contracts/workspace";

const project = {
  id: "edit",
  duration: 10,
  clips: [],
  transcript: [],
  sourceReviews: [],
} as unknown as EditProject;
const context = buildEditPlanningContext(project, []);
const sfx = context.freeSounds.find(sound => sound.type === "sfx")!;
const music = context.freeSounds.find(sound => sound.type !== "sfx")!;
const bad = {
  type: "sound",
  label: "Accent the reveal",
  reason: "Support its arrival",
  targetClipIds: [],
  cue: { sceneId: "scene:0", edge: "end", align: "start" },
  parameters: { assetId: "catalog:invented", volume: 0.12 },
};
const good = {
  ...bad,
  label: "Opening",
  cue: { sceneId: "scene:0", edge: "start", align: "start" },
  parameters: { assetId: sfx.assetId, volume: 0.1 },
};

describe("foreground sound cue correction", () => {
  const sampled = {
    ...context,
    sharedCatalog: [
      {
        assetId: "shared:heard-sound",
        name: "Reviewed sound",
        kind: "audio" as const,
        group: "effects",
        variant: "original",
        tags: [],
        duration: 10,
        width: undefined,
        height: undefined,
        blendMode: undefined,
      },
    ],
    freeSounds: [
      ...context.freeSounds,
      {
        assetId: "shared:heard-sound",
        name: "Reviewed sound",
        category: "effects",
        tags: [],
        type: "sfx",
        duration: 10,
        peakSeconds: 2.5,
        sourceRanges: [
          { start: 2, end: 3 },
          { start: 7, end: 9 },
        ],
      },
    ],
  } as typeof context;
  const numeric = {
    type: "sound",
    label: "A measured accent",
    reason: "Support this event",
    start: 4,
    end: 5,
    targetClipIds: [],
    parameters: {
      assetId: "shared:heard-sound",
      sourceIn: 0,
      volume: 0.12,
      fadeOut: 0.1,
    },
  };

  it("repairs an explicit sound interval with a heard source offset without creating a cue or changing its timeline", () => {
    const original = [good, numeric];
    const before = structuredClone(original);
    const feedback = editPlanSoundRepairFeedback(original, sampled, 10);
    expect(feedback).toEqual([
      { operationIndex: 1, operation: numeric, timingMode: "range" },
    ]);
    const repaired = mergeEditPlanSoundRepair(
      original,
      feedback,
      {
        sounds: [
          { operationIndex: 1, assetId: "shared:heard-sound", sourceIn: 2 },
        ],
      },
      sampled,
      10
    );
    expect(repaired).toHaveLength(original.length);
    expect(repaired[0]).toBe(good);
    expect(repaired[1]).toEqual({
      ...numeric,
      parameters: { ...numeric.parameters, sourceIn: 2 },
    });
    expect(repaired[1]).not.toHaveProperty("cue");
    expect(
      resolveEditPlanningReferences(repaired, sampled, 10)[1]
    ).toMatchObject({
      start: 4,
      end: 5,
      targetClipIds: [],
      parameters: { sourceIn: 2, volume: 0.12, fadeOut: 0.1 },
    });
    expect(original).toEqual(before);
  });

  it("repairs mixed cue and numeric-range failures exactly once with their distinct controls", () => {
    const brokenCue = { ...bad, cue: { sceneId: "scene:0", align: "crest" } };
    const original = [brokenCue, good, numeric];
    const feedback = editPlanSoundRepairFeedback(original, sampled, 10);
    expect(feedback.map(row => row.timingMode)).toEqual(["cue", "range"]);
    const repaired = mergeEditPlanSoundRepair(
      original,
      feedback,
      {
        sounds: [
          { operationIndex: 2, assetId: "shared:heard-sound", sourceIn: 8 },
          { operationIndex: 0, assetId: sfx.assetId, align: "start" },
        ],
      },
      sampled,
      10
    );
    expect(repaired).toHaveLength(3);
    expect(repaired[1]).toBe(good);
    expect(repaired[0]).toMatchObject({
      cue: { sceneId: "scene:0", align: "start" },
    });
    expect(repaired[2]).toMatchObject({
      start: 4,
      end: 5,
      parameters: { sourceIn: 8 },
    });
    expect(() =>
      resolveEditPlanningReferences(repaired, sampled, 10)
    ).not.toThrow();
  });

  it("rejects ranged repairs that cross unheard gaps, crop the promised duration, or alter scope", () => {
    const raw = [numeric];
    const feedback = editPlanSoundRepairFeedback(raw, sampled, 10);
    const fix = {
      operationIndex: 0,
      assetId: "shared:heard-sound",
      sourceIn: 2,
    };
    for (const sounds of [
      [],
      [fix, fix],
      [{ ...fix, operationIndex: 1 }],
      [{ ...fix, sourceIn: undefined }],
      [{ ...fix, sourceIn: "2" }],
      [{ ...fix, sourceIn: -1 }],
      [{ ...fix, sourceIn: Number.NaN }],
      [{ ...fix, sourceIn: 2.5 }],
      [{ ...fix, sourceIn: 9.5 }],
      [{ ...fix, assetId: "shared:missing" }],
      [{ ...fix, start: 3 }],
      [{ ...fix, end: 6 }],
      [{ ...fix, targetClipIds: ["new-target"] }],
      [{ ...fix, align: "start" }],
    ])
      expect(() =>
        mergeEditPlanSoundRepair(raw, feedback, { sounds }, sampled, 10)
      ).toThrow();
    const long = [{ ...numeric, start: 0, end: 10 }];
    expect(() =>
      mergeEditPlanSoundRepair(
        long,
        editPlanSoundRepairFeedback(long, sampled, 10),
        { sounds: [fix] },
        sampled,
        10
      )
    ).toThrow();
  });

  it("repairs invalid asset/alignment while preserving every other edit and evidence anchor", () => {
    const broken = {
      ...bad,
      cue: { sceneId: "scene:0", edge: "start", align: "crest" },
    };
    const original = [good, broken];
    const snapshot = structuredClone(original);
    const feedback = editPlanSoundRepairFeedback(original, context, 10);
    expect(feedback.map(item => item.operationIndex)).toEqual([1]);
    const repaired = mergeEditPlanSoundRepair(
      original,
      feedback,
      { sounds: [{ operationIndex: 1, assetId: sfx.assetId, align: "peak" }] },
      context,
      10
    );
    expect(repaired[0]).toBe(good);
    expect(repaired[1]).toEqual({
      ...broken,
      cue: { ...broken.cue, align: "peak" },
      parameters: { ...broken.parameters, assetId: sfx.assetId },
    });
    expect(original).toEqual(snapshot);
    const compiled = resolveEditPlanningReferences(
      repaired,
      context,
      10
    ) as Array<{
      start: number;
      end: number;
      parameters: { sourceIn: number };
    }>;
    expect(compiled[1].start).toBe(0);
    expect(compiled[1].parameters.sourceIn).toBe(sfx.peakSeconds);
    expect(compiled[1].end).toBeGreaterThan(0);
  });

  it("does not conceal unrelated invalid operations or repair their scope", () => {
    expect(() =>
      editPlanSoundRepairFeedback(
        [good, { ...bad, cue: { sceneId: "missing" } }],
        context,
        10
      )
    ).toThrow(
      expect.objectContaining({
        reason: "cue_timing_unavailable",
        operationIndex: 1,
      })
    );
    expect(editPlanSoundRepairFeedback([good], context, 10)).toEqual([]);
  });

  it("rejects incomplete, duplicate, unrelated or timing-changing patches and unavailable sources", () => {
    const raw = [good, { ...bad, cue: { sceneId: "scene:0", align: "start" } }];
    const feedback = editPlanSoundRepairFeedback(raw, context, 10);
    const fix = { operationIndex: 1, assetId: sfx.assetId, align: "start" };
    for (const sounds of [
      [],
      [fix, fix],
      [{ ...fix, operationIndex: 0 }],
      [{ ...fix, start: 5 }],
      [{ ...fix, assetId: "catalog:unknown" }],
      [{ ...fix, assetId: music.assetId, align: "peak" }],
    ]) {
      expect(() =>
        mergeEditPlanSoundRepair(raw, feedback, { sounds }, context, 10)
      ).toThrow();
    }
  });
});
