import { describe, expect, it } from "vitest";
import { missingStyleControls, mergeStyleControlRepair } from "./edit-style-repair";
import type { EditOperation } from "./workspace";

const draft = [
  { type: "style", start: 0, end: 3, targetClipIds: ["speaker"], parameters: { visual: { scale: 1.05 } } },
  { type: "graphic", start: 3, end: 6, parameters: { graphic: { preset: "arrow" } } },
  { type: "style", cue: { sceneId: "ending", duration: 2 }, targetClipIds: ["speaker"], parameters: { effect: "professional finish" } },
];
const compiled = draft.map((op, i) => ({ ...op, id: String(i), label: "Treatment", start: 0, end: 3,
  targetClipIds: op.targetClipIds ?? [], parameters: i === 2 ? {} : op.parameters })) as EditOperation[];

describe("missing style control correction", () => {
  it("finds missing controls without treating another operation as a style", () => {
    expect(missingStyleControls(draft, compiled)).toEqual([2]);
    expect(missingStyleControls(draft, compiled.slice(1))).toEqual([]);
  });
  it("keeps existing edits, the exact cue, targets and operation indexes", () => {
    const result = mergeStyleControlRepair(draft, [2], { styles: [{ operationIndex: 2, parameters: { fadeOut: 0.25 } }] });
    expect(result[0]).toBe(draft[0]); expect(result[1]).toBe(draft[1]);
    expect(result[2]).toEqual({ ...draft[2], parameters: { fadeOut: 0.25 } });
    expect(draft[2].parameters).toEqual({ effect: "professional finish" });
  });
  it.each([
    { styles: [] },
    { styles: [{ operationIndex: 0, parameters: { fadeOut: 1 } }] },
    { styles: [{ operationIndex: 2, parameters: {} }] },
    { styles: [{ operationIndex: 2, start: 12, parameters: { fadeOut: 1 } }] },
    { styles: [{ operationIndex: 2, parameters: { assetId: "new-media" } }] },
    { styles: [{ operationIndex: 2, parameters: { prompt: "make video" } }] },
  ])("rejects dropped operations, changed scope and media requests %j", fix => {
    expect(() => mergeStyleControlRepair(draft, [2], fix)).toThrow();
  });
});
