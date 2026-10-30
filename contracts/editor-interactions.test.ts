import { describe, it, expect } from "vitest";
import {
  mergeStoryRanges,
  updateStoryBeat,
  type StoryBeat,
} from "./story-beats";
import {
  assertActionWithinRanges,
  readSelectionRanges,
} from "./editor-selection-ranges";
import {
  readEditorPresetFile,
  writeEditorPresetFile,
} from "./editor-preset-file";
import {
  editorPresetCatalog,
  resolveEditorPresetOperation,
} from "./editor-preset-catalog";
import { MOTION_KITS, motionKitClips } from "./motion-kits";
import {
  GRAPHIC_PRESETS,
  CAPTION_PRESETS,
  CLIP_LOOK_PRESETS,
} from "./editor-presets";
import type { EditorChatAction } from "./editor-chat";
import type { EditProject } from "./workspace";
describe("selected section boundaries", () => {
  it("merges adjacent ranges while preserving the unselected middle", () => {
    expect(
      mergeStoryRanges([
        { start: 20, end: 25 },
        { start: 0, end: 5 },
        { start: 5, end: 9 },
      ])
    ).toEqual([
      { start: 0, end: 9 },
      { start: 20, end: 25 },
    ]);
    expect(() => readSelectionRanges([{ start: NaN, end: 4 }])).toThrow();
    const project = { duration: 25, clips: [] } as unknown as EditProject;
    const action = {
      kind: "edit",
      operation: { start: 0, end: 25 },
    } as EditorChatAction;
    expect(() =>
      assertActionWithinRanges(
        action,
        [
          { start: 0, end: 9 },
          { start: 20, end: 25 },
        ],
        project
      )
    ).toThrow(/gap/);
    expect(() =>
      assertActionWithinRanges(
        { ...action, operation: { ...action.operation, start: 20, end: 25 } },
        [
          { start: 0, end: 9 },
          { start: 20, end: 25 },
        ],
        project
      )
    ).not.toThrow();
  });
  it("keeps Reel's initial timing and label across successive manual edits", () => {
    const base = {
      id: "hook",
      kind: "hook",
      label: "Hook: original",
      start: 0,
      end: 4,
      origin: "ai",
      evidenceIds: [],
      evidenceKey: "x",
    } as StoryBeat;
    const first = updateStoryBeat(
      [base],
      base.id,
      { ...base, label: "Changed", end: 3 },
      10
    )!;
    const second = updateStoryBeat(
      first,
      base.id,
      { ...first[0], label: "Again", end: 2 },
      10
    )!;
    expect(second[0].reelOriginal).toEqual({
      kind: "hook",
      label: "Hook: original",
      start: 0,
      end: 4,
    });
  });
});
describe("reusable free presets", () => {
  it("resolves every kit layer to the exact editable UI composition", () => {
    const catalog = editorPresetCatalog();
    for (const kit of MOTION_KITS) {
      const layers = motionKitClips(
        {
          kit: kit.id,
          title: "Actual heading",
          subtitle: "Actual detail",
          accent: "#123456",
          seconds: 4,
          value: 72,
        },
        [],
        0,
        "test"
      );
      const recipe = catalog.motionKits.find(k => k.id === kit.id)!;
      expect(recipe.layers.length).toBe(layers.length);
      recipe.layers.forEach((layer, index) => {
        const resolved = resolveEditorPresetOperation({
          type: "graphic",
          start: 8,
          end: 12,
          parameters: {
            presetId: layer.presetId,
            kitTitle: "Actual heading",
            kitSubtitle: "Actual detail",
            kitAccent: "#123456",
            kitValue: 72,
          },
        }) as { parameters: { graphic: unknown } };
        expect(resolved.parameters.graphic).toEqual(layers[index].graphic);
      });
    }
    expect(() =>
      resolveEditorPresetOperation({
        type: "graphic",
        start: 0,
        end: 4,
        parameters: { presetId: "motion:statistic:0" },
      })
    ).toThrow(/measured/);
  });
  it("resolves owned personal presets without exposing their geometry in model context", () => {
    const style = {
      id: "personal-1",
      name: "Custom",
      type: "graphic" as const,
      graphic: GRAPHIC_PRESETS[0].graphic,
      graphicDuration: 3,
    };
    expect(editorPresetCatalog([style]).personal[0]).toEqual({
      id: style.id,
      name: style.name,
      type: style.type,
    });
    const resolved = resolveEditorPresetOperation(
      {
        type: "graphic",
        parameters: { presetId: style.id, graphic: { text: "New text" } },
      },
      [style]
    ) as { parameters: { graphic: { text: string } } };
    expect(resolved.parameters.graphic).toMatchObject({
      ...style.graphic,
      text: "New text",
    });
    expect(() =>
      resolveEditorPresetOperation(
        { type: "graphic", parameters: { presetId: style.id } },
        []
      )
    ).toThrow(/no longer available/);
  });
  it("round trips animation settings and rejects executable/imported unknown formats", () => {
    const preset = GRAPHIC_PRESETS.find(p => p.graphic.motion?.length)!;
    const file = writeEditorPresetFile({
      id: "test",
      name: "My motion",
      type: "graphic",
      graphic: preset.graphic,
      graphicDuration: preset.duration,
    });
    const draft = readEditorPresetFile(file);
    expect(draft.type).toBe("graphic");
    if (draft.type === "graphic")
      expect(draft.graphic.motion).toEqual(preset.graphic.motion);
    expect(() => readEditorPresetFile('{"script":"alert(1)"}')).toThrow(
      /Reel preset/
    );
  });
  it("all IDs are unique and Reel resolves the same stock graph as the UI", () => {
    for (const catalog of [GRAPHIC_PRESETS, CAPTION_PRESETS, CLIP_LOOK_PRESETS])
      expect(new Set(catalog.map(p => p.id)).size).toBe(catalog.length);
    const preset = GRAPHIC_PRESETS.at(-1)!;
    const op = resolveEditorPresetOperation({
      type: "graphic",
      parameters: {
        presetId: preset.id,
        graphic: { text: "Actual user text" },
      },
    }) as {
      parameters: { graphic: Record<string, unknown>; presetId?: string };
    };
    expect(op.parameters.graphic).toEqual({
      ...preset.graphic,
      text: "Actual user text",
    });
    expect(op.parameters.presetId).toBeUndefined();
  });
});
