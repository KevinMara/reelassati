import { describe, expect, it } from "vitest";
import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import { placeLibraryAsset } from "./library-insertion";
import { appendEditorRevisions, restoreEditorRevision } from "./editor-history";

const original = {
  id: "original",
  track: "video",
  lane: 1,
  start: 0,
  duration: 8,
  locked: true,
} as TimelineClip;
const project = {
  clips: [original],
  duration: 8,
  playhead: 2,
  transcript: [],
  revisions: [],
} as unknown as EditProject;
const asset = {
  id: "source",
  name: "Footage",
  kind: "video",
  status: "ready",
  duration: 4.12345,
} as Asset;
describe("Library → timeline insertion", () => {
  it("adds at the exact playhead on a free lane without moving or replacing existing clips", () => {
    const before = structuredClone(project);
    const added = placeLibraryAsset(project, asset, "added", project.playhead);
    expect(added).toMatchObject({
      start: 2,
      duration: 4.12345,
      outPoint: 4.12345,
      track: "video",
      lane: 2,
    });
    expect(project).toEqual(before);
  });
  it("appends to content end rather than the padded project duration", () => {
    expect(
      placeLibraryAsset({ ...project, duration: 30 }, asset, "added")
    ).toMatchObject({ start: 8, lane: 1 });
  });
  it("routes audio separately and gives still images a three-second default", () => {
    expect(
      placeLibraryAsset(project, { ...asset, kind: "audio" }, "audio", 2)
    ).toMatchObject({ track: "audio", lane: 1 });
    expect(
      placeLibraryAsset(
        project,
        { ...asset, kind: "image", duration: undefined },
        "image",
        2
      ).duration
    ).toBe(3);
  });
  it("rejects unfinished media, unknown durations and wrong drop tracks", () => {
    expect(() =>
      placeLibraryAsset(
        project,
        { ...asset, status: "processing" } as Asset,
        "bad"
      )
    ).toThrow();
    expect(() =>
      placeLibraryAsset(project, { ...asset, duration: undefined }, "bad")
    ).toThrow();
    expect(() =>
      placeLibraryAsset(project, asset, "bad", 1, { kind: "audio", number: 1 })
    ).toThrow();
    expect(() => placeLibraryAsset(project, asset, "bad", NaN)).toThrow();
  });
  it("keeps direct additions undoable with existing revision semantics", () => {
    const after = {
      ...project,
      clips: [...project.clips, placeLibraryAsset(project, asset, "added", 2)],
    };
    const baseline = {
      ...project,
      id: "before",
      label: "Before",
      createdAt: "2026-10-20",
    };
    const revision = {
      ...after,
      id: "after",
      label: "Added",
      createdAt: "2026-10-20",
    };
    const history = appendEditorRevisions(project, [revision], baseline);
    expect(restoreEditorRevision({ ...after, ...history }, 0).clips).toEqual([
      original,
    ]);
    expect(
      restoreEditorRevision({ ...after, ...history }, 1).clips
    ).toHaveLength(2);
  });
});
