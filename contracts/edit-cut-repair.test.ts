import { describe, expect, it } from "vitest";
import { cutRepairScope, mergeCutRepair } from "./edit-cut-repair";
import { EditPlanValidationError } from "./edit-plan-validation";

describe("foreground cut correction", () => {
  const draft = [
    { type: "audio", parameters: { volume: 0.2 } },
    { type: "trim" },
    { type: "style" },
    { type: "trim" },
    { type: "sound" },
  ];
  it("corrects retained-range conflicts without changing sound or styling, and remaps scene evidence", () => {
    const indices = cutRepairScope(
      new EditPlanValidationError("trim_duplicate", "private"),
      draft
    )!;
    expect(indices).toEqual([1, 3]);
    const cuts = [{ type: "silence", start: 4, end: 4.2 }];
    const result = mergeCutRepair(draft, indices, { cuts }, [
      { sceneId: "scene:0", operationIndexes: [0, 1, 3] },
      { sceneId: "scene:1", operationIndexes: [2, 4] },
    ]);
    expect(result.changes).toEqual([draft[0], cuts[0], draft[2], draft[4]]);
    expect(result.editorialCoverage).toEqual([
      { sceneId: "scene:0", operationIndexes: [0, 1] },
      { sceneId: "scene:1", operationIndexes: [2, 3] },
    ]);
  });
  it("does not repair transport, permission or unknown failures as creative mistakes", () => {
    expect(cutRepairScope(new TypeError("fetch failed"), draft)).toBeNull();
    expect(
      cutRepairScope(
        new EditPlanValidationError("execution_locked", "locked"),
        draft
      )
    ).toBeNull();
  });
  it("cannot extend corrected cuts to an unrelated source clip", () => {
    expect(() =>
      mergeCutRepair([{ type: "trim", targetClipIds: ["speaker"] }], [0], {
        cuts: [{ type: "silence", targetClipIds: ["other-source"] }],
      })
    ).toThrow(EditPlanValidationError);
  });
  it.each([
    {},
    { cuts: [] },
    { cuts: [{ type: "delete" }] },
    { cuts: [{ type: "broll", parameters: { prompt: "new generation" } }] },
  ])(
    "never accepts dropped treatment or unrelated additions %j",
    correction => {
      expect(() => mergeCutRepair(draft, [1, 3], correction)).toThrow(
        EditPlanValidationError
      );
    }
  );
});
