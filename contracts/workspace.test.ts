import { describe, expect, it } from "vitest";
import { createEmptyWorkspace } from "./workspace";

describe("createEmptyWorkspace", () => {
  it("creates a truthful empty studio for the authenticated owner", () => {
    const workspace = createEmptyWorkspace("creator@example.com", "Ada");

    expect(workspace.profile).toMatchObject({
      email: "creator@example.com",
      name: "Ada",
      credits: 0,
    });
    expect(workspace.projects).toEqual([]);
    expect(workspace.assets).toEqual([]);
    expect(workspace.posts).toEqual([]);
    expect(workspace.activity).toEqual([]);
  });

  it("does not share mutable arrays between workspaces", () => {
    const first = createEmptyWorkspace("first@example.com");
    const second = createEmptyWorkspace("second@example.com");

    first.activity.push({
      id: "event-1",
      type: "project",
      label: "Created",
      detail: "First project",
      createdAt: new Date().toISOString(),
    });

    expect(second.activity).toHaveLength(0);
  });
});
