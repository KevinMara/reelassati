import { captionLines, getCaptionPreset } from "./editor-presets";
/** The bundled font metrics decide graphic line breaks for both CSS and ASS. */
export function graphicTextLines(text: string, size: number) {
  return captionLines(text, {
    ...getCaptionPreset("classic"),
    size,
    maxCharacters: 1000,
  });
}
