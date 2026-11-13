import { describe, expect, it } from "vitest";
import { editorialCoverageRepairScope, mergeEditorialCoverageRepair } from "./editorial-coverage-repair";
import type { EditorialCoverageReview } from "./editorial-coverage";

const scene = (id: string, issues: EditorialCoverageReview["scenes"][number]["issues"]) => ({
  sceneId: id, start: 0, end: 4, purpose: "Show the object", decision: "improve" as const,
  reason: "The object is visible", speechIds: [], observationIndexes: [0], operationIds: ["a"], issues,
});
const review: EditorialCoverageReview = {version: 1, status: "partial", scenes: [scene("one", ["cosmetic-only"]), scene("two", [])]};
const draft = [{type: "style", id: "unchanged", parameters: {exposure: 0.1}}];
const coverage = [{sceneId: "one", decision: "improve"}, {sceneId: "two", decision: "preserve", reason: "Keep this exact reason"}];

describe("editorial coverage correction", () => {
  it("corrects a finishing-only classification without manufacturing content edits", () => {
    const decision = {sceneId: "one", decision: "preserve", reason: "The existing picture demonstrates the object", operationIndexes: [0]};
    const result = mergeEditorialCoverageRepair(draft, coverage, review, {decisions: [decision], additions: []});
    expect(result.changes).toEqual(draft);
    expect(result.editorialCoverage).toEqual([coverage[1], decision]);
  });
  it("retains the working draft and appends an explicitly accounted content operation", () => {
    const addition = {type: "graphic", parameters: {graphic: {kind: "arrow"}}};
    const decision = {sceneId: "one", decision: "improve", operationIndexes: [1]};
    expect(mergeEditorialCoverageRepair(draft, coverage, review, {decisions: [decision], additions: [addition]}).changes).toEqual([...draft, addition]);
  });
  it.each([
    {decisions: [{sceneId: "two"}], additions: []},
    {decisions: [{sceneId: "one", decision: "improve", operationIndexes: [1]}], additions: [{type: "broll", parameters: {prompt: "new paid video"}}]},
    {decisions: [{sceneId: "one", decision: "preserve", operationIndexes: [1]}], additions: [{type: "graphic"}]},
    {decisions: [{sceneId: "one", decision: "improve", operationIndexes: [1]}], additions: [{type: "sound"}]},
  ])("rejects unrelated changes, unaccounted additions and expanded media spending", response => {
    expect(() => mergeEditorialCoverageRepair(draft, coverage, review, response)).toThrow();
  });
  it("does not spend another review on an honest source limitation alone", () => {
    expect(editorialCoverageRepairScope({...review, scenes: [scene("blocked", ["unresolved-source"])]})).toEqual([]);
  });
});
