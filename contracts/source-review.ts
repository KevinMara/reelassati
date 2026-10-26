import {
  normalizeSourceVisualEvidence,
  type SourceVisualEvidence,
} from "./source-visual-evidence";

export interface SourceObservation {
  start: number;
  end: number;
  visualEvidence: string;
  audioEvidence: string;
  confidence: number | null;
}
export interface SourceReview {
  assetId: string;
  reviewedAt: string;
  summary: string;
  captions: "present" | "absent" | "unknown";
  captionNote: string;
  audio: "present" | "absent" | "unknown";
  audioNote: string;
  ending?: ObservedEnding | null;
  visualProtection?: SourceVisualEvidence;
  /** Observed source facts only; proposals remain in the analyzer report. */
  observations?: SourceObservation[];
  moments: Array<{ start: number; end: number; note: string }>;
}
export interface ObservedEnding {
  time: number;
  confidence: number;
  completed: boolean;
  trailingContent: "empty" | "meaningful" | "unknown";
  note: string;
}
export function normalizeReview(
  value: unknown,
  duration?: number
): Pick<
  SourceReview,
  | "captions"
  | "captionNote"
  | "audio"
  | "audioNote"
  | "ending"
  | "visualProtection"
> {
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
    visualProtection: normalizeSourceVisualEvidence(
      row.visualProtection,
      duration
    ),
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

export function normalizeSourceObservations(
  value: unknown,
  duration?: number
): SourceObservation[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 180).flatMap(candidate => {
    if (!candidate || typeof candidate !== "object") return [];
    const row = candidate as Record<string, unknown>;
    if (
      typeof row.start !== "number" ||
      !Number.isFinite(row.start) ||
      row.start < 0 ||
      typeof row.end !== "number" ||
      !Number.isFinite(row.end) ||
      row.end <= row.start ||
      (duration !== undefined && row.end > duration + 0.000001)
    )
      return [];
    const visualEvidence =
      typeof row.visualEvidence === "string"
        ? row.visualEvidence.trim().slice(0, 3000)
        : "";
    const audioEvidence =
      typeof row.audioEvidence === "string"
        ? row.audioEvidence.trim().slice(0, 3000)
        : "";
    if (!visualEvidence && !audioEvidence) return [];
    return [
      {
        start: row.start,
        end: row.end,
        visualEvidence,
        audioEvidence,
        confidence:
          typeof row.confidence === "number" &&
          Number.isFinite(row.confidence) &&
          row.confidence >= 0 &&
          row.confidence <= 1
            ? row.confidence
            : null,
      },
    ];
  });
}

/** Deliberately excludes legacy mixed notes, summaries, improvements and
 * rationale. A saved recommendation is not a human request or a source fact. */
export function sourceReviewFacts(review: SourceReview): SourceReview {
  const observations = normalizeSourceObservations(review.observations);
  return {
    assetId: review.assetId,
    reviewedAt: review.reviewedAt,
    summary: "",
    ...normalizeReview(review),
    observations,
    moments: observations.map(row => ({
      start: row.start,
      end: row.end,
      note: [
        row.visualEvidence && `Observed picture: ${row.visualEvidence}`,
        row.audioEvidence && `Observed audio: ${row.audioEvidence}`,
      ]
        .filter(Boolean)
        .join("\n"),
    })),
  };
}
