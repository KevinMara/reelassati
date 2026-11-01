/** Searchable organization shared by editing, caption, graphic and look styles. */
export interface StyleMetadata {
  folder?: string;
  contentType?: string;
  language?: string;
}

export function normalizeStyleMetadata(
  value: Record<string, unknown>
): StyleMetadata {
  const result: StyleMetadata = {};
  for (const key of ["folder", "contentType", "language"] as const) {
    const text = typeof value[key] === "string" ? value[key].trim() : "";
    if (
      text &&
      text.length <= 60 &&
      !Array.from(text).some(
        character =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
      )
    )
      result[key] = text;
  }
  return result;
}
