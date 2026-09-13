export interface SourceReview {
  assetId: string;
  reviewedAt: string;
  summary: string;
  captions: "present" | "absent" | "unknown";
  captionNote: string;
  audio: "present" | "absent" | "unknown";
  audioNote: string;
  moments: Array<{ start: number; end: number; note: string }>;
}
export function normalizeReview(value: unknown) {
  const row =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const state = (v: unknown): SourceReview["captions"] =>
    v === "present" || v === "absent" ? v : "unknown";
  return {
    captions: state(row.captions),
    captionNote:
      typeof row.captionNote === "string"
        ? row.captionNote.slice(0, 1500)
        : "Caption visibility was not established.",
    audio: state(row.audio),
    audioNote:
      typeof row.audioNote === "string"
        ? row.audioNote.slice(0, 1500)
        : "Audio was not assessed.",
  };
}
