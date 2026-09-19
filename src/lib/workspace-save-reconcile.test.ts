import { describe, expect, it } from "vitest";
import type { WorkspaceDocument } from "@contracts/workspace";
import { reconcileAcknowledgedWorkspace } from "./workspace-save-reconcile";

function body(revision: number, caption: string): WorkspaceDocument {
  return {
    revision,
    projects: [
      {
        id: "project",
        transcript: [{ id: "caption", start: 0, end: 2, text: caption }],
      },
    ],
  } as unknown as WorkspaceDocument;
}

describe("workspace save acknowledgements", () => {
  it("preserves a manual edit while an earlier chat save acknowledges a newer server revision", () => {
    const manual = body(10, "Manually corrected name");
    const olderSave = body(11, "Old name");
    const latest = reconcileAcknowledgedWorkspace(manual, olderSave, 3, 4);
    expect(latest.revision).toBe(11);
    expect(latest.projects).toBe(manual.projects);
    expect(latest.projects[0].transcript[0].text).toBe(
      "Manually corrected name"
    );
  });

  it("does not use equal server revisions as permission to replace a newer optimistic body", () => {
    const latest = body(11, "Latest caption");
    expect(
      reconcileAcknowledgedWorkspace(latest, body(11, "Older caption"), 3, 4)
        .projects
    ).toBe(latest.projects);
  });

  it("accepts the authoritative server body for the latest mutation", () => {
    const saved = body(12, "Verified caption");
    expect(
      reconcileAcknowledgedWorkspace(body(11, "Verified caption"), saved, 4, 4)
    ).toBe(saved);
  });

  it("does not roll back a fresher revision when an older save finishes", () => {
    const current = body(15, "Reloaded caption");
    const result = reconcileAcknowledgedWorkspace(
      current,
      body(14, "Old caption"),
      4,
      5
    );
    expect(result.revision).toBe(15);
    expect(result.projects).toBe(current.projects);
  });
});
