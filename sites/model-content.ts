export type ModelContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "video_url"; video_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string; format: "mp3" } };

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
    if (
      part.type === "input_audio" &&
      part.input_audio?.format === "mp3" &&
      typeof part.input_audio.data === "string" &&
      part.input_audio.data.length <= 1500000 &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(part.input_audio.data)
    )
      return {
        type: "input_audio",
        input_audio: { data: part.input_audio.data, format: "mp3" },
      };
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
