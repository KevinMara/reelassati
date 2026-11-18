import faces from "./editor-font-data.json";
import measurements from "./editor-font-metrics.json";

/** Exact static faces: preview and export load the same checked-in bytes. */
export const EDITOR_FONTS = faces;
export function editorFont(id?: string) {
  return EDITOR_FONTS.find(face => face.id === id);
}
export function editorFontMetrics(id?: string) {
  if (!editorFont(id)) return undefined;
  return (
    measurements as Record<
      string,
      {
        height: number;
        ascent: number;
        descent: number;
        advances: Record<string, number>;
        unsupportedCharacters?: string;
      }
    >
  )[id!];
}
export function editorFontCssFamily(id: string) {
  return `Reel-${id}`;
}
/** Decorative faces often omit accents or punctuation. Detect this before
 * rendering instead of letting the OS and export engine choose different fonts. */
export function missingEditorFontCharacters(
  id: string | undefined,
  text: string
) {
  const metrics = editorFontMetrics(id);
  if (!metrics) return [];
  return [
    ...new Set(
      Array.from(text).filter(
        c =>
          !/\s/u.test(c) &&
          (metrics.advances[c] === undefined ||
            metrics.unsupportedCharacters?.includes(c))
      )
    ),
  ];
}
export function editorFontDirection(text = "") {
  const characters = [...new Set(text + text.toUpperCase())].join("");
  const eligible = EDITOR_FONTS.filter(
    f => !missingEditorFontCharacters(f.id, characters).length
  );
  return `Optional fontId selects an exact bundled face compatible with the current caption characters: ${eligible.map(f => `${f.id} (${f.label})`).join(", ") || "none; retain the existing default"}. Omit it to retain the existing font; use default to restore Editor Sans. Unlisted faces lack verified lettering for this transcript; do not select them or change spoken text to fit a font. A selected face includes its own weight and italic styling. Use heavy sans faces for concise emphasis, regular sans for sustained reading, and decorative/script faces only for short requested accents. Never choose a decorative face for a dense transcript or change fonts merely to add variety. These are fonts, not converted native templates.`;
}
