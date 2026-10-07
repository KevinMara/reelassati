import { describe, expect, it } from "vitest";
import {
  createDefaultEditorKeybindings,
  editorChordFromEvent,
  EDITOR_KEYBINDINGS_STORAGE_KEY,
  formatEditorChord,
  loadEditorKeybindings,
  matchEditorKeybinding,
  normalizeEditorChord,
  saveEditorKeybindings,
  validateEditorKeybindings,
  type EditorKeyEvent,
} from "./editor-keybindings";

const key = (
  key: string,
  rest: Partial<EditorKeyEvent> = {}
): EditorKeyEvent => ({ key, ...rest });

describe("configurable editor shortcuts", () => {
  it("keeps defaults valid and resolves portable Mod shortcuts on either platform", () => {
    const defaults = createDefaultEditorKeybindings();
    expect(validateEditorKeybindings(defaults).errors).toEqual([]);
    expect(
      matchEditorKeybinding(key("z", { code: "KeyZ", ctrlKey: true }), defaults)
    ).toBe("undo");
    expect(
      matchEditorKeybinding(key("z", { code: "KeyZ", metaKey: true }), defaults)
    ).toBe("undo");
    expect(
      matchEditorKeybinding(
        key("Z", { ctrlKey: true, shiftKey: true }),
        defaults
      )
    ).toBe("redo");
    expect(matchEditorKeybinding(key("y", { ctrlKey: true }), defaults)).toBe(
      "redo"
    );
    expect(
      matchEditorKeybinding(key("y", { metaKey: true }), defaults)
    ).toBeNull();
    expect(matchEditorKeybinding(key("g", { metaKey: true }), defaults)).toBe(
      "group"
    );
    expect(
      matchEditorKeybinding(
        key("G", { ctrlKey: true, shiftKey: true }),
        defaults
      )
    ).toBe("ungroup");
    expect(
      matchEditorKeybinding(
        key("g", { altKey: true, shiftKey: true }),
        defaults
      )
    ).toBe("link");
    expect(
      matchEditorKeybinding(
        key("U", { altKey: true, shiftKey: true }),
        defaults
      )
    ).toBe("unlink");
  });

  it("preserves documented playback, editing, numpad and zoom aliases", () => {
    const defaults = createDefaultEditorKeybindings();
    for (const event of [key(" ", { code: "Space" }), key("k")])
      expect(matchEditorKeybinding(event, defaults)).toBe("play");
    for (const event of [key("Delete"), key("Backspace")])
      expect(matchEditorKeybinding(event, defaults)).toBe("delete");
    for (const event of [
      key("Delete", { shiftKey: true }),
      key("Backspace", { shiftKey: true }),
    ])
      expect(matchEditorKeybinding(event, defaults)).toBe("rippleDelete");
    expect(
      matchEditorKeybinding(key("ArrowLeft", { altKey: true }), defaults)
    ).toBe("nudgeLeft");
    expect(
      matchEditorKeybinding(
        key("ArrowRight", { altKey: true, shiftKey: true }),
        defaults
      )
    ).toBe("nudgeSecondRight");
    expect(
      matchEditorKeybinding(key("ArrowRight", { shiftKey: true }), defaults)
    ).toBe("secondForward");
    expect(matchEditorKeybinding(key("j"), defaults)).toBe("seekBackward");
    for (const event of [
      key("="),
      key("+", { code: "Equal", shiftKey: true }),
      key("+", { code: "NumpadAdd" }),
    ])
      expect(matchEditorKeybinding(event, defaults)).toBe("zoomIn");
    expect(
      matchEditorKeybinding(key("-", { code: "NumpadSubtract" }), defaults)
    ).toBe("zoomOut");
  });

  it("removes the old default when changing or disabling an action", () => {
    const changed = createDefaultEditorKeybindings();
    changed.split = ["F2"];
    changed.play = [];
    expect(validateEditorKeybindings(changed).valid).toBe(true);
    expect(matchEditorKeybinding(key("s"), changed)).toBeNull();
    expect(matchEditorKeybinding(key("F2"), changed)).toBe("split");
    expect(matchEditorKeybinding(key("k"), changed)).toBeNull();
    expect(matchEditorKeybinding(key(" "), changed)).toBeNull();
  });

  it("rejects collisions with Ctrl/Meta equivalents of Mod across platforms", () => {
    const changed = createDefaultEditorKeybindings();
    changed.split = ["Ctrl+Z"];
    expect(
      validateEditorKeybindings(changed).errors.some(
        error => error.action === "undo" || error.action === "split"
      )
    ).toBe(true);
    changed.split = ["Command+Z"];
    expect(validateEditorKeybindings(changed).valid).toBe(false);
    changed.split = ["Ctrl+F2", "Meta+F2"];
    expect(validateEditorKeybindings(changed).valid).toBe(true);
    changed.split = ["Mod+F2", "Meta+F2"];
    expect(validateEditorKeybindings(changed).valid).toBe(false);
  });

  it("normalizes aliases and rejects duplicate physical punctuation chords", () => {
    expect(normalizeEditorChord("Option + Shift + Left")).toBe(
      "Alt+Shift+ArrowLeft"
    );
    expect(normalizeEditorChord("Ctrl + +")).toBe("Ctrl+Shift+=");
    expect(normalizeEditorChord("CmdOrCtrl+?")).toBe("Mod+Shift+/");
    expect(normalizeEditorChord("Mod+KeyS")).toBe("Mod+S");
    expect(normalizeEditorChord(" ")).toBe("Space");
    expect(formatEditorChord("Mod+Shift+ArrowLeft")).toBe("Ctrl/⌘ + Shift + ←");
    const changed = createDefaultEditorKeybindings();
    changed.split = ["+"];
    expect(validateEditorKeybindings(changed).valid).toBe(false);
    changed.split = ["?", "Shift+/"];
    expect(validateEditorKeybindings(changed).valid).toBe(false);
  });

  it("does not fire during composition, AltGr typing, handled events or extra modifiers", () => {
    const defaults = createDefaultEditorKeybindings();
    for (const event of [
      key("s", { isComposing: true }),
      key("s", { keyCode: 229 }),
      key("Dead", { code: "KeyS" }),
      key("Process", { code: "KeyS" }),
      key("Unidentified", { code: "KeyS" }),
      key("s", { getModifierState: name => name === "AltGraph" }),
      key("s", { code: "KeyS", ctrlKey: true, altKey: true }),
      key("z", { ctrlKey: true, metaKey: true }),
      key("s", { defaultPrevented: true }),
      key("s", { shiftKey: true }),
      key("k", { altKey: true }),
    ])
      expect(matchEditorKeybinding(event, defaults)).toBeNull();
    expect(editorChordFromEvent(key("ß", { code: "KeyS", altKey: true }))).toBe(
      "Alt+S"
    );
    expect(
      editorChordFromEvent(key("y", { code: "KeyZ", ctrlKey: true }))
    ).toBe("Ctrl+Z");
  });

  it("rejects reserved typing/system chords and malformed action maps", () => {
    const changed = createDefaultEditorKeybindings();
    for (const chord of [
      "Ctrl+Alt+E",
      "Mod+Alt+Q",
      "Mod+W",
      "Mod+L",
      "Meta+Q",
      "Alt+F4",
      "Ctrl+Alt+Delete",
      "Mod+Alt+Delete",
      "Meta+Alt+Escape",
      "Tab",
      "Shift+Tab",
      "Enter",
      "F5",
      "Mod+Space",
      "Ctrl",
      "Ctrl+Ctrl+S",
      "Mod+Ctrl+S",
      "constructor",
      "toString+C",
      "S+J",
    ]) {
      changed.split = [chord];
      expect(validateEditorKeybindings(changed).valid, chord).toBe(false);
    }
    expect(validateEditorKeybindings(null).valid).toBe(false);
    expect(validateEditorKeybindings({ split: ["S"] }).valid).toBe(false);
    expect(
      validateEditorKeybindings({
        ...createDefaultEditorKeybindings(),
        unknown: [],
      }).valid
    ).toBe(false);
    changed.split = Array.from({ length: 9 }, () => "F2");
    expect(validateEditorKeybindings(changed).valid).toBe(false);
  });

  it("persists replacements and explicitly disabled actions without reviving defaults", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (name: string) => values.get(name) ?? null,
      setItem: (name: string, value: string) => {
        values.set(name, value);
      },
    };
    const changed = createDefaultEditorKeybindings();
    changed.split = ["F2"];
    changed.play = [];
    expect(saveEditorKeybindings(changed, storage)).toBe(true);
    expect(values.has(EDITOR_KEYBINDINGS_STORAGE_KEY)).toBe(true);
    expect(loadEditorKeybindings(storage)).toEqual(changed);
    const loaded = loadEditorKeybindings(storage);
    loaded.split.push("F3");
    expect(loadEditorKeybindings(storage).split).toEqual(["F2"]);
  });

  it("falls back atomically for corrupt, conflicting, incomplete or future storage", () => {
    const defaults = createDefaultEditorKeybindings();
    const conflict = { ...defaults, split: ["Mod+Z"] };
    for (const saved of [
      "bad JSON",
      "null",
      JSON.stringify({ version: 2, bindings: defaults }),
      JSON.stringify({ version: 1, bindings: { split: [] } }),
      JSON.stringify({ version: 1, bindings: conflict }),
    ]) {
      expect(
        loadEditorKeybindings({
          getItem: () => saved,
          setItem: () => undefined,
        })
      ).toEqual(defaults);
    }
    expect(
      loadEditorKeybindings({
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => undefined,
      })
    ).toEqual(defaults);
    expect(
      saveEditorKeybindings(defaults, {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
      })
    ).toBe(false);
    expect(
      saveEditorKeybindings(conflict, {
        getItem: () => null,
        setItem: () => {
          throw new Error("must not write invalid bindings");
        },
      })
    ).toBe(false);
  });
});
