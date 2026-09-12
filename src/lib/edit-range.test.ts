import { it, expect } from "vitest";
import { applyEditOperation } from "./edit-timeline";
import type { EditOperation, EditProject } from "@contracts/workspace";
const project = {
  duration: 12,
  clips: [
    {
      id: "clip",
      start: 0,
      duration: 10,
      inPoint: 20,
      outPoint: 40,
      speed: 2,
      volume: 1,
      locked: false,
    },
  ],
  transcript: [],
  proposedChanges: [],
} as unknown as EditProject;
const operation = {
  id: "adjust",
  type: "audio",
  start: 3,
  end: 5,
  targetClipIds: ["clip"],
  parameters: { volume: 0.2 },
} as EditOperation;
it("isolates a local audio change and retains exact source offsets", () => {
  const next = applyEditOperation(project, operation);
  expect(
    next.clips.map(c => [c.start, c.duration, c.inPoint, c.outPoint, c.volume])
  ).toEqual([
    [0, 3, 20, 26, 1],
    [3, 2, 26, 30, 0.2],
    [5, 5, 30, 40, 1],
  ]);
  expect(next.duration).toBe(12);
  expect(project.clips).toHaveLength(1);
});
it("does not adjust an unrelated interval", () => {
  expect(
    applyEditOperation(project, { ...operation, start: 11, end: 12 }).clips
  ).toEqual(project.clips);
});
it("preserves locked clips", () => {
  expect(() =>
    applyEditOperation(
      { ...project, clips: project.clips.map(c => ({ ...c, locked: true })) },
      operation
    )
  ).toThrow("unlocked");
});
