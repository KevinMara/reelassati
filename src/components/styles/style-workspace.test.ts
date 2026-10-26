import { describe, expect, it } from "vitest";
import { createEmptyWorkspace, type EditProject } from "@contracts/workspace";
import { EDIT_STYLE_TEMPLATE_LIMIT } from "@contracts/edit-style-template";
import { EDITOR_SAVED_STYLE_LIMIT } from "@contracts/editor-style-library";
import {
  newWorkspaceStyle,
  removeWorkspaceStyle,
  saveWorkspaceStyle,
  selectProjectEditingStyle,
  styleKind,
  workspaceStyles,
  type StyleKind,
} from "./style-workspace";

function draft(kind: StyleKind, id: string = kind) {
  const value = newWorkspaceStyle(kind, id);
  value.value.name = `  My ${kind}  `;
  return value;
}
const empty = () => createEmptyWorkspace("styles@example.com");

describe("style workspace persistence", () => {
  it.each(["editing", "captions", "graphic", "look"] as const)(
    "creates and round-trips a %s style in its existing library",
    kind => {
      const original = empty();
      const saved = saveWorkspaceStyle(original, draft(kind), "create");
      const restored = workspaceStyles(JSON.parse(JSON.stringify(saved)));
      expect(restored).toHaveLength(1);
      expect(styleKind(restored[0])).toBe(kind);
      expect(restored[0].value.name).toBe(`My ${kind}`);
      expect(
        kind === "editing" ? saved.editorStyles : saved.editStyleTemplates
      ).toBeUndefined();
      expect(original.editorStyles).toBeUndefined();
      expect(original.editStyleTemplates).toBeUndefined();
      expect(saved.projects).toBe(original.projects);
    }
  );

  it.each(["editing", "captions", "graphic", "look"] as const)(
    "updates a %s style without erasing the other library or changing its ID",
    kind => {
      const first = saveWorkspaceStyle(
        empty(),
        draft("editing", "same-id"),
        "create"
      );
      const saved = saveWorkspaceStyle(
        first,
        draft(kind === "editing" ? "graphic" : kind, "same-id"),
        "create"
      );
      const selected = workspaceStyles(saved).find(
        style => styleKind(style) === kind
      )!;
      selected.value.name = "Revised style";
      const updated = saveWorkspaceStyle(saved, selected, "update");
      expect(workspaceStyles(updated)).toHaveLength(2);
      expect(
        workspaceStyles(updated).find(style => styleKind(style) === kind)?.value
      ).toMatchObject({ id: "same-id", name: "Revised style" });
      expect(
        kind === "editing" ? updated.editorStyles : updated.editStyleTemplates
      ).toBe(
        kind === "editing" ? saved.editorStyles : saved.editStyleTemplates
      );
    }
  );

  it("preserves complete editing settings and a graphic's animation when renaming", () => {
    const editing = draft("editing");
    if (editing.kind !== "editing") throw new Error("wrong draft");
    editing.value.source = "reference";
    editing.value.profile.shotSeconds = { short: 1, typical: 3, long: 9 };
    editing.value.profile.graphicTreatment = {
      kinds: ["callout"],
      palette: ["#123456"],
      animations: ["slide"],
      compositions: ["lower-third"],
      typicalSize: 8,
    };
    editing.value.profile.captionTreatment = {
      preset: "word-pop",
      appearance: { activeColor: "#ABCDEF" },
    };
    editing.value.profile.grade = {
      brightness: 0.1,
      saturation: 1.3,
      contrast: 1.1,
      temperature: 0.3,
    };
    const graphic = draft("graphic");
    if (graphic.kind !== "element" || graphic.value.type !== "graphic")
      throw new Error("wrong draft");
    graphic.value.graphic.motion = [
      { at: 0, x: 10, y: 10, scale: 1, rotation: 0 },
      { at: 1, x: 80, y: 60, scale: 1.5, rotation: 10, easing: "ease-out" },
    ];
    graphic.value.graphicDuration = 95;
    let workspace = saveWorkspaceStyle(
      saveWorkspaceStyle(empty(), editing, "create"),
      graphic,
      "create"
    );
    const before = workspaceStyles(workspace);
    for (const item of before)
      workspace = saveWorkspaceStyle(
        workspace,
        { ...item, value: { ...item.value, name: "Renamed" } } as typeof item,
        "update"
      );
    expect(workspace.editStyleTemplates?.[0]).toMatchObject({
      source: "reference",
      profile: editing.value.profile,
    });
    expect(workspace.editorStyles?.[0]).toMatchObject({
      graphicDuration: 95,
      graphic: { motion: graphic.value.graphic.motion },
    });
  });

  it("allows updates at the limit and rejects new, duplicate, missing and mismatched styles", () => {
    let workspace = empty();
    for (let index = 0; index < EDITOR_SAVED_STYLE_LIMIT; index++)
      workspace = saveWorkspaceStyle(
        workspace,
        draft("captions", `caption-${index}`),
        "create"
      );
    expect(() =>
      saveWorkspaceStyle(workspace, draft("look", "overflow"), "create")
    ).toThrow("room");
    expect(() =>
      saveWorkspaceStyle(workspace, draft("captions", "caption-0"), "create")
    ).toThrow("already exists");
    expect(() =>
      saveWorkspaceStyle(workspace, draft("captions", "missing"), "update")
    ).toThrow("removed");
    expect(() =>
      saveWorkspaceStyle(workspace, draft("look", "caption-0"), "update")
    ).toThrow("changed");
    expect(
      saveWorkspaceStyle(workspace, draft("captions", "caption-0"), "update")
        .editorStyles
    ).toHaveLength(EDITOR_SAVED_STYLE_LIMIT);
    for (let index = 0; index < EDIT_STYLE_TEMPLATE_LIMIT; index++)
      workspace = saveWorkspaceStyle(
        workspace,
        draft("editing", `editing-${index}`),
        "create"
      );
    expect(() =>
      saveWorkspaceStyle(workspace, draft("editing", "overflow"), "create")
    ).toThrow("room");
    expect(
      saveWorkspaceStyle(workspace, draft("editing", "editing-0"), "update")
        .editStyleTemplates
    ).toHaveLength(EDIT_STYLE_TEMPLATE_LIMIT);
  });

  it("rejects empty names and deletes only from the intended library", () => {
    expect(() =>
      saveWorkspaceStyle(
        empty(),
        newWorkspaceStyle("captions", "invalid"),
        "create"
      )
    ).toThrow("name");
    const editing = draft("editing", "shared");
    const workspace = saveWorkspaceStyle(
      saveWorkspaceStyle(empty(), editing, "create"),
      draft("captions", "shared"),
      "create"
    );
    const removed = removeWorkspaceStyle(workspace, editing);
    expect(removed.editStyleTemplates).toEqual([]);
    expect(removed.editorStyles).toBe(workspace.editorStyles);
  });

  it("attaches a detached saved profile only to the chosen project and never runs an edit", () => {
    const workspace = saveWorkspaceStyle(empty(), draft("editing"), "create");
    workspace.projects = [
      { id: "chosen", title: "Chosen", clips: [] },
      { id: "other", title: "Other", clips: [] },
    ] as unknown as EditProject[];
    const next = selectProjectEditingStyle(workspace, "editing", "chosen");
    expect(next.projects[0].editStyleTemplate).toEqual(
      workspace.editStyleTemplates?.[0]
    );
    expect(next.projects[0].editStyleTemplate).not.toBe(
      workspace.editStyleTemplates?.[0]
    );
    expect(next.projects[0].clips).toBe(workspace.projects[0].clips);
    expect(next.projects[1]).toBe(workspace.projects[1]);
    expect(next.jobs).toBe(workspace.jobs);
    expect(() =>
      selectProjectEditingStyle(workspace, "missing", "chosen")
    ).toThrow("changed");
    expect(() =>
      selectProjectEditingStyle(workspace, "editing", "missing")
    ).toThrow("changed");
  });
});
