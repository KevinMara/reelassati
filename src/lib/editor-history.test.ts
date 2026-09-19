import { describe, expect, it } from "vitest";
import type { EditProject, EditRevision } from "@contracts/workspace";
import {
  appendEditorRevisions,
  currentRevisionIndex,
  restoreEditorRevision,
} from "./editor-history";
const snapshot = (id: string, assetId = id) =>
  ({
    id,
    label: id,
    createdAt: "2026-09-15",
    duration: 10,
    clips: [
      {
        id,
        assetId,
        label: id,
        track: "video",
        start: 0,
        duration: 10,
        inPoint: 0,
        outPoint: 10,
        locked: false,
        color: "#6553BE",
      },
    ],
    transcript: [],
    captionStyle: id,
  }) as EditRevision;

describe("durable editor history", () => {
  it("branches at the saved undo cursor, including after navigating away and reopening", () => {
    const project = {
      revisions: [snapshot("A"), snapshot("B"), snapshot("C")],
      revisionIndex: 1,
    };
    expect(currentRevisionIndex(JSON.parse(JSON.stringify(project)))).toBe(1);
    const result = appendEditorRevisions(
      project,
      [snapshot("D")],
      snapshot("initial")
    );
    expect(result.revisions.map(r => r.id)).toEqual(["A", "B", "D"]);
    expect(result.revisionIndex).toBe(2);
  });
  it("preserves every batch import's undo step instead of reusing a stale React cursor", () => {
    const first = appendEditorRevisions(
      { revisions: [snapshot("A"), snapshot("B")], revisionIndex: 0 },
      [snapshot("file1")],
      snapshot("initial")
    );
    const second = appendEditorRevisions(
      first,
      [snapshot("file2")],
      snapshot("initial")
    );
    expect(second.revisions.map(r => r.id)).toEqual(["A", "file1", "file2"]);
    expect(second.revisionIndex).toBe(2);
  });
  it("creates a baseline for legacy projects and keeps bounded history's cursor valid", () => {
    const baseline = snapshot("initial");
    expect(
      appendEditorRevisions(
        { revisions: [] },
        [snapshot("first")],
        baseline
      ).revisions.map(r => r.id)
    ).toEqual(["initial", "first"]);
    const full = appendEditorRevisions(
      { revisions: Array.from({ length: 24 }, (_, i) => snapshot(String(i))) },
      [snapshot("new")],
      baseline
    );
    expect(full.revisions).toHaveLength(24);
    expect(full.revisionIndex).toBe(23);
    expect(full.revisions.at(-1)?.id).toBe("new");
  });
  it("restores captions, active media and bounds without sharing mutable revision arrays", () => {
    const project = {
      revisions: [snapshot("old", "old-asset"), snapshot("new", "new-asset")],
      activeAssetId: "new-asset",
      playhead: 30,
      duration: 30,
      revisionIndex: 1,
    } as EditProject;
    const restored = restoreEditorRevision(project, 0);
    expect(restored).toMatchObject({
      activeAssetId: "old-asset",
      playhead: 10,
      duration: 10,
      revisionIndex: 0,
      captionStyle: "old",
    });
    restored.clips[0].start = 4;
    expect(project.revisions[0].clips[0].start).toBe(0);
  });
});
