import { describe, expect, it } from "vitest";
import { buildEditPlanningContext, resolveEditPlanningReferences } from "@contracts/edit-planning-context";
import { editPlanSoundRepairFeedback, mergeEditPlanSoundRepair } from "@contracts/edit-plan-sound-repair";
import type { EditProject } from "@contracts/workspace";

const project = { id: "edit", duration: 10, clips: [], transcript: [], sourceReviews: [] } as unknown as EditProject;
const context = buildEditPlanningContext(project, []);
const sfx = context.freeSounds.find(sound => sound.type === "sfx")!;
const music = context.freeSounds.find(sound => sound.type !== "sfx")!;
const bad = { type: "sound", label: "Accent the reveal", reason: "Support its arrival", targetClipIds: [],
  cue: { sceneId: "scene:0", edge: "end", align: "start" }, parameters: { assetId: "catalog:invented", volume: 0.12 } };
const good = { ...bad, label: "Opening", cue: { sceneId: "scene:0", edge: "start", align: "start" }, parameters: { assetId: sfx.assetId, volume: 0.1 } };

describe("foreground sound cue correction", () => {
  it("repairs invalid asset/alignment while preserving every other edit and evidence anchor", () => {
    const broken = { ...bad, cue: { sceneId: "scene:0", edge: "start", align: "crest" } };
    const original = [good, broken];
    const snapshot = structuredClone(original);
    const feedback = editPlanSoundRepairFeedback(original, context, 10);
    expect(feedback.map(item => item.operationIndex)).toEqual([1]);
    const repaired = mergeEditPlanSoundRepair(original, feedback,
      { sounds: [{ operationIndex: 1, assetId: sfx.assetId, align: "peak" }] }, context, 10);
    expect(repaired[0]).toBe(good);
    expect(repaired[1]).toEqual({ ...broken, cue: { ...broken.cue, align: "peak" }, parameters: { ...broken.parameters, assetId: sfx.assetId } });
    expect(original).toEqual(snapshot);
    const compiled = resolveEditPlanningReferences(repaired, context, 10) as Array<{ start: number; end: number; parameters: { sourceIn: number } }>;
    expect(compiled[1].start).toBe(0);
    expect(compiled[1].parameters.sourceIn).toBe(sfx.peakSeconds);
    expect(compiled[1].end).toBeGreaterThan(0);
  });

  it("does not conceal unrelated invalid operations or repair their scope", () => {
    expect(() => editPlanSoundRepairFeedback([good, { ...bad, cue: { sceneId: "missing" } }], context, 10))
      .toThrow(expect.objectContaining({ reason: "cue_timing_unavailable", operationIndex: 1 }));
    expect(editPlanSoundRepairFeedback([good], context, 10)).toEqual([]);
  });

  it("rejects incomplete, duplicate, unrelated or timing-changing patches and unavailable sources", () => {
    const raw = [good, { ...bad, cue: { sceneId: "scene:0", align: "start" } }];
    const feedback = editPlanSoundRepairFeedback(raw, context, 10);
    const fix = { operationIndex: 1, assetId: sfx.assetId, align: "start" };
    for (const sounds of [[], [fix, fix], [{ ...fix, operationIndex: 0 }], [{ ...fix, start: 5 }],
      [{ ...fix, assetId: "catalog:unknown" }], [{ ...fix, assetId: music.assetId, align: "peak" }]]) {
      expect(() => mergeEditPlanSoundRepair(raw, feedback, { sounds }, context, 10)).toThrow();
    }
  });
});
