import { describe, expect, it, vi } from "vitest";
import type {
  EditOperation,
  EditProject,
  WorkspaceDocument,
} from "@contracts/workspace";
import { publishAutonomousSteps } from "./autonomous-live-publish";
import { currentRevisionIndex, restoreEditorRevision } from "./editor-history";

const original = () =>
  ({
    id: "project",
    duration: 10,
    clips: [
      {
        id: "clip",
        start: 0,
        duration: 10,
        inPoint: 0,
        outPoint: 10,
        track: "video",
      },
    ],
    transcript: [],
    proposedChanges: [],
    revisions: [],
    playhead: 0,
    captionStyle: "classic",
    aspectRatio: "9:16",
    frameRate: 30,
  }) as unknown as EditProject;
describe("live publishing of a reviewed auto-edit", () => {
  it("accepts server retention and provenance reconciliation between steps", async () => {
    const before = original();
    const step = {
      ...before,
      proposedChanges: Array.from(
        { length: 125 },
        (_, index) =>
          ({ id: `op-${index}`, status: "accepted" }) as EditOperation
      ),
    };
    let workspace = { projects: [before] } as WorkspaceDocument;
    const onStep = vi.fn();
    await publishAutonomousSteps({
      original: before,
      steps: [
        { label: "First", project: step },
        { label: "Second", project: step },
      ],
      checkpoint: vi.fn(),
      onStep,
      update: async fn => {
        workspace = fn(workspace);
        workspace.projects[0].proposedChanges =
          workspace.projects[0].proposedChanges
            .slice(-120)
            .map(operation => ({
              ...operation,
              provenance: { recordId: "server" } as EditOperation["provenance"],
            }));
      },
    });
    expect(onStep).toHaveBeenCalledTimes(2);
  });
  it("saves real intermediate clips and keeps one complete Undo", async () => {
    const before = original(),
      first = {
        ...before,
        clips: before.clips.map(c => ({ ...c, exposure: 0.15 })),
      },
      last = {
        ...first,
        clips: first.clips.map(c => ({ ...c, contrast: 1.08 })),
      };
    let workspace = { projects: [before] } as WorkspaceDocument;
    const saved: EditProject[] = [];
    await publishAutonomousSteps({
      original: before,
      steps: [
        { label: "Exposure", project: first },
        { label: "Contrast", project: last },
      ],
      checkpoint: vi.fn(),
      onStep: vi.fn(),
      update: async fn => {
        workspace = fn(workspace);
        saved.push(workspace.projects[0]);
      },
    });
    expect(saved[0].clips[0]).toMatchObject({ exposure: 0.15 });
    expect(saved[1].clips[0]).toMatchObject({ contrast: 1.08 });
    const restored = restoreEditorRevision(workspace.projects[0], 0);
    expect(restored.clips).toEqual(before.clips);
    expect(workspace.projects[0].revisions).toHaveLength(2);
  });
  it("stops before overwriting a concurrent manual edit", async () => {
    const before = original();
    let workspace = { projects: [before] } as WorkspaceDocument;
    const completed = vi.fn(() => {
      workspace.projects[0] = {
        ...workspace.projects[0],
        clips: workspace.projects[0].clips.map(c => ({
          ...c,
          label: "Manual change",
        })),
      };
    });
    await expect(
      publishAutonomousSteps({
        original: before,
        steps: [
          {
            label: "First",
            project: {
              ...before,
              clips: before.clips.map(c => ({ ...c, exposure: 0.1 })),
            },
          },
          { label: "Second", project: before },
        ],
        checkpoint: vi.fn(),
        onStep: completed,
        update: async fn => {
          workspace = fn(workspace);
        },
      })
    ).rejects.toThrow("timeline changed");
    expect(completed).toHaveBeenCalledTimes(1);
    expect(workspace.projects[0].clips[0].label).toBe("Manual change");
  });
  it("starts no save after cancellation", async () => {
    const update = vi.fn();
    await expect(
      publishAutonomousSteps({
        original: original(),
        steps: [{ label: "First", project: original() }],
        checkpoint: () => {
          throw new DOMException("Stopped", "AbortError");
        },
        onStep: vi.fn(),
        update,
      })
    ).rejects.toThrow("Stopped");
    expect(update).not.toHaveBeenCalled();
  });
  it.each([
    ["aspect ratio", { aspectRatio: "16:9" }],
    ["frame rate", { frameRate: 60 }],
    ["duration", { duration: 12 }],
  ])("keeps a concurrent %s change", async (_name, patch) => {
    const before = original();
    let workspace = {
      projects: [{ ...before, ...patch }],
    } as WorkspaceDocument;
    const initial = structuredClone(workspace);
    await expect(
      publishAutonomousSteps({
        original: before,
        steps: [{ label: "First", project: before }],
        checkpoint: vi.fn(),
        onStep: vi.fn(),
        update: async fn => {
          workspace = fn(workspace);
        },
      })
    ).rejects.toThrow("timeline changed");
    expect(workspace).toEqual(initial);
  });
  it("honors Undo between steps even when the clips did not change", async () => {
    const before = original();
    let workspace = { projects: [before] } as WorkspaceDocument;
    const onStep = vi.fn(() => {
      const project = workspace.projects[0];
      workspace = {
        ...workspace,
        projects: [
          restoreEditorRevision(project, currentRevisionIndex(project) - 1),
        ],
      };
    });
    await expect(
      publishAutonomousSteps({
        original: before,
        steps: [
          { label: "First", project: before },
          { label: "Second", project: before },
        ],
        checkpoint: vi.fn(),
        onStep,
        update: async fn => {
          workspace = fn(workspace);
        },
      })
    ).rejects.toThrow("timeline changed");
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(currentRevisionIndex(workspace.projects[0])).toBe(0);
  });
  it("preserves current project metadata and navigation", async () => {
    const before = original();
    const metadata = {
      title: "Renamed",
      folderId: "folder",
      platform: "YouTube",
      status: "ready",
      playhead: 4,
    };
    let workspace = {
      projects: [{ ...before, ...metadata }],
    } as unknown as WorkspaceDocument;
    await publishAutonomousSteps({
      original: before,
      steps: [{ label: "First", project: before }],
      checkpoint: vi.fn(),
      onStep: vi.fn(),
      update: async fn => {
        workspace = fn(workspace);
      },
    });
    expect(workspace.projects[0]).toMatchObject(metadata);
  });
  it("keeps earlier history and supports one Undo and Redo for all steps", async () => {
    let before = original();
    let workspace = { projects: [before] } as WorkspaceDocument;
    const update = async (
      fn: (workspace: WorkspaceDocument) => WorkspaceDocument
    ) => {
      workspace = fn(workspace);
    };
    await publishAutonomousSteps({
      original: before,
      steps: [{ label: "Prior edit", project: before }],
      update,
      checkpoint: vi.fn(),
      onStep: vi.fn(),
    });
    before = workspace.projects[0];
    const final = {
      ...before,
      clips: before.clips.map(c => ({ ...c, exposure: 0.2 })),
    };
    await publishAutonomousSteps({
      original: before,
      steps: [
        { label: "First", project: before },
        { label: "Final", project: final },
      ],
      update,
      checkpoint: vi.fn(),
      onStep: vi.fn(),
    });
    const result = workspace.projects[0];
    const previous = restoreEditorRevision(
      result,
      currentRevisionIndex(result) - 1
    );
    expect(previous.clips).toEqual(before.clips);
    expect(
      restoreEditorRevision(previous, currentRevisionIndex(previous) + 1).clips
    ).toEqual(final.clips);
    expect(result.revisions.slice(0, 2)).toEqual(before.revisions);
  });
  it("checks cancellation again inside a delayed workspace mutation", async () => {
    const before = original();
    let cancelled = false;
    let workspace = { projects: [before] } as WorkspaceDocument;
    await expect(
      publishAutonomousSteps({
        original: before,
        steps: [{ label: "First", project: before }],
        checkpoint: () => {
          if (cancelled) throw new DOMException("Stopped", "AbortError");
        },
        onStep: vi.fn(),
        update: async fn => {
          cancelled = true;
          workspace = fn(workspace);
        },
      })
    ).rejects.toThrow("Stopped");
    expect(workspace.projects[0]).toBe(before);
  });
  it("starts no later step after a save fails", async () => {
    const before = original();
    const update = vi.fn(async () => {
      throw new Error("Save failed");
    });
    const onStep = vi.fn();
    await expect(
      publishAutonomousSteps({
        original: before,
        steps: [
          { label: "First", project: before },
          { label: "Second", project: before },
        ],
        checkpoint: vi.fn(),
        onStep,
        update,
      })
    ).rejects.toThrow("Save failed");
    expect(update).toHaveBeenCalledTimes(1);
    expect(onStep).not.toHaveBeenCalled();
  });
});
