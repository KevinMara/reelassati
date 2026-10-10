import { describe, expect, it } from "vitest";
import type { EditProject, EditOperation, TimelineClip } from "@contracts/workspace";
import { mapSourceAnalysisToProject } from "./analysis-project-mapping";
import { applyEditOperation } from "./edit-timeline";

const clip = (patch: Partial<TimelineClip> = {}): TimelineClip => ({ id: "source", assetId: "analyzed", track: "video", start: 20, duration: 5, inPoint: 10, outPoint: 20, speed: 2, label: "Source", locked: false, color: "#fff", ...patch });
const operation = (patch: Partial<EditOperation> = {}): EditOperation => ({ id: "suggestion", type: "style", label: "Source look", reason: "Observed source", start: 12, end: 16, confidence: .8, intensity: "light", targetClipIds: ["untrusted-model-id"], status: "proposed", parameters: { brightness: 1.1 }, ...patch });
const project = (clips: TimelineClip[]): EditProject => ({ id: "p", title: "p", clips, transcript: [], proposedChanges: [], qualitySignals: [], revisions: [], duration: 40, playhead: 0 } as unknown as EditProject);
const map = (p: EditProject, changes = [operation()]) => mapSourceAnalysisToProject(p, { id: "analyzed", duration: 30 }, { changes, signals: [{ id: "signal", label: "Observed", detail: "Source", start: 12, end: 16, level: "attention" }] });
describe("analysis source ownership and source clocks", () => {
  it("refuses unrelated projects despite identical timeline overlap", () => { expect(() => map(project([clip({ assetId: "unrelated", start: 12 })]))).toThrow("does not contain"); });
  it("projects through source trim and speed without targeting coincident unrelated clips", () => {
    const result = map(project([clip(), clip({ id: "unrelated", assetId: "other", start: 21 })]));
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({ start: 21, end: 23, targetClipIds: ["source"] });
    expect(result.signals[0]).toMatchObject({ start: 21, end: 23 });
  });
  it("maps repeated occurrences separately with unique target IDs", () => {
    const result = map(project([clip(), clip({ id: "copy", start: 30, speed: 1, duration: 10 })]));
    expect(result.changes.map(c => [c.start, c.end, c.targetClipIds])).toEqual([[21, 23, ["source"]], [32, 36, ["copy"]]]);
    expect(new Set(result.changes.map(c => c.id)).size).toBe(2);
  });
  it("preserves explicit AV peers and rejects a locked peer", () => {
    const picture = clip({ linkId: "av" }); const audio = clip({ id: "audio", track: "audio", linkId: "av" });
    expect(map(project([picture, audio])).changes[0].targetClipIds).toEqual(["source", "audio"]);
    expect(map(project([picture, { ...audio, locked: true }])).changes).toEqual([]);
  });
  it.each(["delete", "trim", "pacing"] as const)("does not widen partial %s to the entire clip", type => { const result = map(project([clip()]), [operation({ type })]); expect(result.changes).toEqual([]); expect(result.rejected[0]).toContain("partial source interval"); });
  it("holds global ripple and ambiguous move for an explicit timeline decision", () => { expect(map(project([clip()]), [operation({ type: "silence" }), operation({ type: "move" })]).changes).toEqual([]); });
  it("binds new caption text to the exact source instead of another primary layer", () => {
    const p = project([clip({ id: "other", assetId: "other", start: 20 }), clip()]);
    const mapped = map(p, [operation({ type: "caption", parameters: { text: "Actual source" } })]).changes[0];
    expect(mapped.parameters?.sourceClipId).toBe("source");
    const next = applyEditOperation(p, mapped);
    expect(next.transcript[0]).toMatchObject({ start: 21, end: 23, sourceClipId: "source", text: "Actual source" });
  });
  it("clips local adjustments to retained source without inventing out-of-source evidence", () => { const result = map(project([clip()]), [operation({ start: 5, end: 12 })]); expect(result.changes[0]).toMatchObject({ start: 20, end: 21 }); expect(map(project([clip()]), [operation({ start: 29, end: 31 })]).changes).toEqual([]); });

  it.each([NaN, Infinity, 31])("refuses an invalid or unmeasured source out-point %s", outPoint => {
    expect(() => map(project([clip({ outPoint })]))).toThrow("invalid timeline clock");
  });

  it("holds supporting media until an owned asset is explicitly chosen", () => {
    const result = map(project([clip()]), [operation({ type: "broll", parameters: { assetId: "invented-provider-id" } })]);
    expect(result.changes).toEqual([]);
    expect(result.rejected[0]).toContain("explicit timeline decision");
  });
});
