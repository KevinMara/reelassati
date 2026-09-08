import { describe, expect, it } from "vitest";
import type {
  EditProject,
  EditOperation,
  TimelineClip,
} from "@contracts/workspace";
import {
  applyEditOperation,
  contentDuration,
  resizeTimeline,
  rippleRemove,
} from "./edit-timeline";
const clip = {
  id: "a",
  start: 0,
  duration: 10,
  inPoint: 2,
  outPoint: 12,
  track: "video",
  locked: false,
} as TimelineClip;
const project = {
  clips: [clip],
  transcript: [{ id: "s", start: 7, end: 8, text: "Product proof" }],
  proposedChanges: [],
  duration: 40,
  playhead: 0,
} as unknown as EditProject;
const op = (patch: Partial<EditOperation>) =>
  ({
    id: "op",
    type: "trim",
    start: 0,
    end: 5,
    targetClipIds: ["a"],
    parameters: {},
    ...patch,
  }) as EditOperation;
describe("executable editing", () => {
  it("fits to content after deleting the final clip instead of retaining the old duration", () => {
    expect(contentDuration(project.clips)).toBe(10);
    expect(applyEditOperation(project, op({ type: "delete" })).duration).toBe(
      1
    );
  });
  it("shortens clips and captions at the explicit project end", () => {
    const shortened = resizeTimeline(project, 7.5);
    expect(shortened.clips[0]).toMatchObject({ duration: 7.5, outPoint: 9.5 });
    expect(shortened.transcript[0].end).toBe(7.5);
  });
  it("ripple-cuts source offsets and keeps later captions aligned", () => {
    const cut = rippleRemove(project, 2, 5);
    expect(cut.duration).toBe(7);
    expect(cut.clips[1]).toMatchObject({ start: 2, inPoint: 7, duration: 5 });
    expect(cut.transcript[0]).toMatchObject({ start: 4, end: 5 });
  });
  it("preserves locked clips and refuses ripple operations that would move them", () => {
    const locked = { ...project, clips: [{ ...clip, locked: true }] };
    expect(() => applyEditOperation(locked, op({ type: "delete" }))).toThrow(
      "unlocked"
    );
    expect(() => rippleRemove(locked, 2, 5)).toThrow("Unlock");
  });
  it("applies a move and remaps captions, rather than only recording acceptance", () => {
    const result = applyEditOperation(
      project,
      op({ type: "move", parameters: { destination: 5 } })
    );
    expect(result.clips[0].start).toBe(5);
    expect(result.transcript[0].start).toBe(12);
  });
  it("changes speed with source duration preserved and captions retimed", () => {
    const result = applyEditOperation(
      project,
      op({ type: "pacing", parameters: { speed: 2 } })
    );
    expect(result.clips[0].duration).toBe(5);
    expect(result.transcript[0].start).toBe(3.5);
  });
  it("does not accept missing media or empty captions as completed work", () => {
    expect(() => applyEditOperation(project, op({ type: "broll" }))).toThrow(
      "media"
    );
    expect(() => applyEditOperation(project, op({ type: "caption" }))).toThrow(
      "text"
    );
  });
});
