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
      }
    >
  )[id!];
}
export function editorFontCssFamily(id: string) {
  return `Reel-${id}`;
}
export function editorFontDirection() {
  return `Optional fontId selects an exact bundled face: ${EDITOR_FONTS.map(f => `${f.id} (${f.label})`).join(", ")}. Omit it to retain the existing font; use default to restore Editor Sans. A selected face includes its own weight and italic styling. Use heavy sans faces for concise emphasis, regular sans for sustained reading, and decorative/script faces only for short requested accents. Never choose a decorative face for a dense transcript or change fonts merely to add variety. These are fonts, not converted native templates.`;
}
