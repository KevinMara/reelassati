import {
  normalizeEditorSavedStyle,
  type EditorSavedStyle,
  type EditorSavedStyleDraft,
} from "./editor-style-library";
export function readEditorPresetFile(text: string): EditorSavedStyleDraft {
  if (new TextEncoder().encode(text).length > 256_000)
    throw new Error("This preset file is too large.");
  const file = JSON.parse(text);
  if (file?.format !== "reel-preset" || file.version !== 1)
    throw new Error("Choose a Reel preset JSON file.");
  const style = normalizeEditorSavedStyle({ ...file.style, id: "imported" });
  if (!style) throw new Error("This preset contains unsupported settings.");
  const draft = { ...style };
  Reflect.deleteProperty(draft, "id");
  return draft;
}
export function writeEditorPresetFile(style: EditorSavedStyle) {
  const normalized = normalizeEditorSavedStyle(style);
  if (!normalized)
    throw new Error("This preset contains unsupported settings.");
  const draft = { ...normalized };
  Reflect.deleteProperty(draft, "id");
  return JSON.stringify(
    { format: "reel-preset", version: 1, style: draft },
    null,
    2
  );
}
