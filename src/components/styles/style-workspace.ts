import {
  EDIT_STYLE_TEMPLATE_LIMIT,
  normalizeEditStyleTemplate,
  normalizeEditStyleTemplates,
  type EditStyleTemplate,
} from "@contracts/edit-style-template";
import {
  EDITOR_SAVED_STYLE_LIMIT,
  normalizeEditorSavedStyle,
  normalizeEditorSavedStyles,
  type EditorSavedStyle,
} from "@contracts/editor-style-library";
import { normalizeGraphic } from "@contracts/motion-graphics";
import { normalizeVisual } from "@contracts/clip-visual";
import type { WorkspaceDocument } from "@contracts/workspace";

export type StyleKind = "editing" | "captions" | "graphic" | "look";
export type WorkspaceStyle =
  | { kind: "editing"; value: EditStyleTemplate }
  | { kind: "element"; value: EditorSavedStyle };

export function styleKind(style: WorkspaceStyle): StyleKind {
  return style.kind === "editing" ? "editing" : style.value.type;
}

export function workspaceStyles(
  workspace: WorkspaceDocument
): WorkspaceStyle[] {
  return [
    ...normalizeEditStyleTemplates(workspace.editStyleTemplates).map(value => ({
      kind: "editing" as const,
      value,
    })),
    ...normalizeEditorSavedStyles(workspace.editorStyles).map(value => ({
      kind: "element" as const,
      value,
    })),
  ];
}

export function newWorkspaceStyle(kind: StyleKind, id: string): WorkspaceStyle {
  if (kind === "editing")
    return {
      kind: "editing",
      value: {
        id,
        name: "",
        source: "edit",
        profile: {
          version: 1,
          traits: {
            pacing: "balanced",
            framing: "mixed",
            color: "natural",
            motion: "subtle",
            transitions: "cuts",
            captions: "phrase",
            graphics: "minimal",
            sound: "speech-led",
          },
          shotSeconds: null,
          graphicsPerMinute: null,
        },
      },
    };
  if (kind === "captions")
    return {
      kind: "element",
      value: {
        id,
        name: "",
        type: kind,
        captionStyle: "classic",
        captionAppearance: {},
      },
    };
  if (kind === "graphic")
    return {
      kind: "element",
      value: {
        id,
        name: "",
        type: kind,
        graphic: normalizeGraphic({
          kind: "text",
          text: "",
          animation: "fade",
        })!,
        graphicDuration: 3,
      },
    };
  return {
    kind: "element",
    value: {
      id,
      name: "",
      type: kind,
      settings: {
        brightness: 0,
        contrast: 1,
        saturation: 1,
        fit: "contain",
        visual: normalizeVisual({}),
      },
    },
  };
}

/** Updates only the matching library. Updating cannot resurrect a deleted style. */
export function saveWorkspaceStyle(
  workspace: WorkspaceDocument,
  draft: WorkspaceStyle,
  mode: "create" | "update"
): WorkspaceDocument {
  const value =
    draft.kind === "editing"
      ? normalizeEditStyleTemplate(draft.value)
      : normalizeEditorSavedStyle(draft.value);
  if (!value) throw new Error("Use a style name of 1 to 60 characters.");
  if (draft.kind === "editing") {
    const styles = workspace.editStyleTemplates ?? [];
    const exists = styles.some(style => style.id === value.id);
    assertSaveMode(exists, mode, styles.length, EDIT_STYLE_TEMPLATE_LIMIT);
    return {
      ...workspace,
      editStyleTemplates: exists
        ? styles.map(style =>
            style.id === value.id ? (value as EditStyleTemplate) : style
          )
        : [...styles, value as EditStyleTemplate],
    };
  }
  const styles = workspace.editorStyles ?? [];
  const existing = styles.find(style => style.id === value.id);
  assertSaveMode(
    Boolean(existing),
    mode,
    styles.length,
    EDITOR_SAVED_STYLE_LIMIT
  );
  if (existing && existing.type !== (value as EditorSavedStyle).type)
    throw new Error("The saved style changed. Open it again before saving.");
  return {
    ...workspace,
    editorStyles: existing
      ? styles.map(style =>
          style.id === value.id ? (value as EditorSavedStyle) : style
        )
      : [...styles, value as EditorSavedStyle],
  };
}

function assertSaveMode(
  exists: boolean,
  mode: "create" | "update",
  count: number,
  limit: number
) {
  if (mode === "update" && !exists)
    throw new Error(
      "This style was removed. Create a new style to save your changes."
    );
  if (mode === "create" && exists)
    throw new Error("This saved style ID already exists.");
  if (!exists && count >= limit)
    throw new Error("Delete a saved style to make room for another.");
}

export function removeWorkspaceStyle(
  workspace: WorkspaceDocument,
  style: WorkspaceStyle
): WorkspaceDocument {
  return style.kind === "editing"
    ? {
        ...workspace,
        editStyleTemplates: workspace.editStyleTemplates?.filter(
          item => item.id !== style.value.id
        ),
      }
    : {
        ...workspace,
        editorStyles: workspace.editorStyles?.filter(
          item => item.id !== style.value.id
        ),
      };
}

export function selectProjectEditingStyle(
  workspace: WorkspaceDocument,
  styleId: string,
  projectId: string
): WorkspaceDocument {
  const template = normalizeEditStyleTemplates(
    workspace.editStyleTemplates
  ).find(style => style.id === styleId);
  if (
    !template ||
    !workspace.projects.some(project => project.id === projectId)
  )
    throw new Error("The style or project changed. Choose it again.");
  return {
    ...workspace,
    projects: workspace.projects.map(project =>
      project.id === projectId
        ? { ...project, editStyleTemplate: structuredClone(template) }
        : project
    ),
  };
}
