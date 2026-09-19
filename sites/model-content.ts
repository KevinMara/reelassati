export type ModelContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "video_url"; video_url: { url: string } };

/** Native media parts must stay arrays. Stringifying them turns actual media into filenames/URL text. */
export function modelUserContent(value: unknown): string | ModelContentPart[] {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return JSON.stringify(value) ?? "";
  if (!value.length) throw new Error("Model content cannot be empty.");
  return value.map(part => {
    if (!part || typeof part !== "object")
      throw new Error("Invalid model content part.");
    if (part.type === "text" && typeof part.text === "string")
      return { type: "text", text: part.text };
    for (const type of ["image_url", "video_url"] as const) {
      if (
        part.type === type &&
        typeof part[type]?.url === "string" &&
        /^(?:https:\/\/|data:(?:image|video)\/[a-zA-Z0-9.+-]+;base64,)/.test(
          part[type].url
        )
      ) {
        return type === "image_url"
          ? { type, image_url: { url: part.image_url.url } }
          : { type, video_url: { url: part.video_url.url } };
      }
    }
    throw new Error("Unsupported model content part.");
  });
}
