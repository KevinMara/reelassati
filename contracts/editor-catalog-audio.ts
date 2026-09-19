import {
  editorAudioCatalog,
  type EditorAudioCatalogEntry,
} from "./editor-audio-catalog";

export interface CatalogAudioPlacement {
  start: number;
  duration: number;
}

/** Only the bundled, audited catalog can supply a file. No model URL is accepted. */
export function findCatalogAudio(catalogId: unknown): EditorAudioCatalogEntry {
  const entry = editorAudioCatalog.find(item => item.id === catalogId);
  if (!entry || entry.license !== "CC0-1.0" || entry.creditCost !== 0)
    throw new Error("Choose a sound from the available free audio catalog.");
  return entry;
}

/** Audio defaults to its real length, bounded by the current edit or selected interval. */
export function catalogAudioPlacement(
  entry: EditorAudioCatalogEntry,
  raw: unknown,
  projectDuration: number,
  range?: { start: number; end: number }
): CatalogAudioPlacement | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error(
      "A sound placement needs a start time and optional duration."
    );
  const value = raw as Record<string, unknown>;
  if (!Number.isFinite(projectDuration) || projectDuration <= 0)
    throw new Error(
      "Add footage or set a timeline duration before placing this sound."
    );
  const lower = range?.start ?? 0;
  const upper = Math.min(projectDuration, range?.end ?? projectDuration);
  if (
    typeof value.start !== "number" ||
    !Number.isFinite(value.start) ||
    value.start < lower ||
    value.start >= upper
  )
    throw new Error(
      range
        ? "This sound starts outside your selected range."
        : "This sound needs a start time inside the timeline."
    );
  const available = Math.min(entry.duration, upper - value.start);
  const duration = value.duration === undefined ? available : value.duration;
  if (
    typeof duration !== "number" ||
    !Number.isFinite(duration) ||
    duration <= 0
  )
    throw new Error("This sound needs a positive, finite duration.");
  if (duration > entry.duration + 0.000001)
    throw new Error(
      "This placement exceeds the sound file’s actual duration. Use another placement to repeat it."
    );
  if (value.start + duration > upper + 0.000001)
    throw new Error(
      range
        ? "This sound extends outside your selected range."
        : "This sound extends beyond the current timeline."
    );
  return { start: value.start, duration: Math.min(duration, available) };
}
