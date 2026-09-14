export interface SourceReview {
  assetId: string;
  reviewedAt: string;
  summary: string;
  captions: "present" | "absent" | "unknown";
  captionNote: string;
  audio: "present" | "absent" | "unknown";
  audioNote: string;
  ending?: ObservedEnding | null;
  moments: Array<{ start: number; end: number; note: string }>;
}
export interface ObservedEnding {
  time: number;
  confidence: number;
  completed: boolean;
  trailingContent: "empty" | "meaningful" | "unknown";
  note: string;
}
export function normalizeReview(value: unknown, duration?: number) {
  const row =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const state = (v: unknown): SourceReview["captions"] =>
    v === "present" || v === "absent" ? v : "unknown";
  const end =
    row.ending && typeof row.ending === "object"
      ? (row.ending as Record<string, unknown>)
      : null;
  const ending: ObservedEnding | null =
    end &&
    typeof end.time === "number" &&
    Number.isFinite(end.time) &&
    end.time > 0 &&
    (!duration || end.time <= duration) &&
    typeof end.confidence === "number" &&
    Number.isFinite(end.confidence) &&
    end.confidence >= 0 &&
    end.confidence <= 1 &&
    typeof end.note === "string" &&
    end.note.trim()
      ? {
          time: end.time,
          confidence: end.confidence,
          completed: end.completed === true,
          trailingContent:
            end.trailingContent === "empty" ||
            end.trailingContent === "meaningful"
              ? end.trailingContent
              : "unknown",
          note: end.note.slice(0, 1500),
        }
      : null;
  return {
    ending,
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
