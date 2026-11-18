import {
  editorFont,
  editorFontCssFamily,
  editorFontMetrics,
} from "@contracts/editor-fonts";

const loading = new Map<string, Promise<void>>();
export async function fetchEditorFont(id: string, signal?: AbortSignal) {
  const font = editorFont(id);
  if (!font) throw new Error("Unknown caption font.");
  const response = await fetch(font.url, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("Caption font could not load. Try again.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
  )
    .map(v => v.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== font.sha256)
    throw new Error(
      "Caption font did not match the saved style. Reload and try again."
    );
  return bytes;
}
/** Failed loads are retryable; no silent substitute is advertised as the chosen face. */
export function loadEditorFont(id?: string): Promise<void> {
  const font = editorFont(id);
  if (!font) return Promise.resolve();
  const existing = loading.get(font.id);
  if (existing) return existing;
  const request = fetchEditorFont(font.id)
    .then(bytes => {
      const metrics = editorFontMetrics(font.id)!;
      // Match libass's OS/2 Windows metrics for baseline and multiline spacing.
      // The glyph outlines and em size remain the exact same font in both paths.
      return new FontFace(editorFontCssFamily(font.id), bytes, {
        ascentOverride: `${metrics.ascent * 100}%`,
        descentOverride: `${metrics.descent * 100}%`,
        lineGapOverride: "0%",
      }).load();
    })
    .then(face => {
      document.fonts.add(face);
    })
    .catch(error => {
      loading.delete(font.id);
      throw error;
    });
  loading.set(font.id, request);
  return request;
}
