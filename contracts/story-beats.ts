import type { EditProject } from "./workspace";

export const STORY_BEAT_KINDS = [
  "hook",
  "body",
  "proof",
  "payoff",
  "cta",
  "custom",
] as const;
export type StoryBeatKind = (typeof STORY_BEAT_KINDS)[number];

export interface StoryBeatEvidence {
  id: string;
  kind: "transcript" | "source";
  /** Measured positions in the CURRENT timeline, never source-media timestamps. */
  start: number;
  end: number;
  text: string;
  clipId?: string;
  assetId?: string;
}

export interface StoryBeat {
  id: string;
  kind: StoryBeatKind;
  label: string;
  start: number;
  end: number;
  evidenceIds: string[];
  /** A change detector, not a security or provenance signature. */
  evidenceKey: string;
  origin: "ai" | "manual";
}

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const labelFor = (kind: StoryBeatKind) =>
  ({
    hook: "Hook",
    body: "Body",
    proof: "Proof",
    payoff: "Payoff",
    cta: "Call to action",
    custom: "Section",
  })[kind];

/** Source observations are intersected with the actual trim and mapped through speed. */
export function buildStoryBeatEvidence(
  project: Pick<
    EditProject,
    "transcript" | "sourceReviews" | "clips" | "duration"
  >
): StoryBeatEvidence[] {
  if (!finite(project.duration) || project.duration <= 0) return [];
  const evidence: StoryBeatEvidence[] = [];
  for (const segment of project.transcript) {
    const text = segment.text.trim();
    if (!text || !finite(segment.start) || !finite(segment.end)) continue;
    const start = Math.max(0, segment.start);
    const end = Math.min(project.duration, segment.end);
    if (start >= end) continue;
    evidence.push({
      id: `transcript:${segment.id}`,
      kind: "transcript",
      start,
      end,
      text: text.slice(0, 1500),
    });
  }
  for (const clip of project.clips) {
    if (
      !clip.assetId ||
      (clip.track !== "video" &&
        clip.track !== "audio" &&
        clip.track !== "overlay")
    )
      continue;
    if (
      ![clip.start, clip.duration, clip.inPoint].every(finite) ||
      clip.duration <= 0 ||
      clip.inPoint < 0
    )
      continue;
    const speed = clip.speed ?? 1;
    if (!finite(speed) || speed <= 0) continue;
    const review = project.sourceReviews
      ?.filter(item => item.assetId === clip.assetId)
      .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))[0];
    if (!review) continue;
    const sourceOut = clip.inPoint + clip.duration * speed;
    review.moments.forEach((moment, index) => {
      if (!finite(moment.start) || !finite(moment.end) || !moment.note.trim())
        return;
      const sourceStart = Math.max(clip.inPoint, moment.start);
      const sourceEnd = Math.min(sourceOut, moment.end);
      if (sourceStart >= sourceEnd) return;
      const start = Math.max(
        0,
        clip.start + (sourceStart - clip.inPoint) / speed
      );
      const end = Math.min(
        project.duration,
        clip.start + (sourceEnd - clip.inPoint) / speed
      );
      if (start >= end) return;
      evidence.push({
        id: `source:${clip.id}:${review.reviewedAt}:${index}`,
        kind: "source",
        start,
        end,
        text: moment.note.trim().slice(0, 1500),
        clipId: clip.id,
        assetId: clip.assetId,
      });
    });
  }
  const seen = new Set<string>();
  return evidence
    .sort(
      (a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id)
    )
    .filter(item => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

function keyFor(entries: StoryBeatEvidence[]): string {
  const value = JSON.stringify(
    entries
      .map(({ id, kind, start, end, text, clipId, assetId }) => ({
        id,
        kind,
        start,
        end,
        text,
        clipId,
        assetId,
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  );
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++)
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

/**
 * The model assigns editorial roles to known evidence IDs. It does not invent
 * timestamps. Missing/stale references and overlapping sections are discarded.
 * A missing result remains missing; we never manufacture a standard 3s hook.
 */
export function normalizeStoryBeats(
  value: unknown,
  evidence: StoryBeatEvidence[],
  duration: number
): StoryBeat[] {
  if (!finite(duration) || duration <= 0) return [];
  const rows = Array.isArray(value) ? value : record(value)?.beats;
  if (!Array.isArray(rows)) return [];
  const byId = new Map(
    evidence
      .filter(
        item =>
          finite(item.start) &&
          finite(item.end) &&
          item.start >= 0 &&
          item.end <= duration &&
          item.start < item.end &&
          item.text.trim()
      )
      .map(item => [item.id, item])
  );
  const candidates: StoryBeat[] = [];
  for (const item of rows.slice(0, 32)) {
    const row = record(item);
    if (
      !row ||
      !STORY_BEAT_KINDS.includes(row.kind as StoryBeatKind) ||
      !Array.isArray(row.evidenceIds)
    )
      continue;
    const ids = [
      ...new Set(
        row.evidenceIds.filter((id): id is string => typeof id === "string")
      ),
    ];
    if (!ids.length || ids.some(id => !byId.has(id))) continue;
    const entries = ids.map(id => byId.get(id)!);
    const start = Math.min(...entries.map(entry => entry.start));
    const end = Math.max(...entries.map(entry => entry.end));
    const kind = row.kind as StoryBeatKind;
    const evidenceKey = keyFor(entries);
    candidates.push({
      id: `beat-${kind}-${evidenceKey}`,
      kind,
      label:
        typeof row.label === "string" && row.label.trim()
          ? row.label.trim().slice(0, 80)
          : labelFor(kind),
      start,
      end,
      evidenceIds: ids,
      evidenceKey,
      origin: "ai",
    });
  }
  const result: StoryBeat[] = [];
  for (const candidate of candidates.sort(
    (a, b) => a.start - b.start || a.end - b.end
  )) {
    const previous = result.at(-1);
    if (!previous || candidate.start >= previous.end) result.push(candidate);
  }
  return result;
}

export function storyBeatsAreCurrent(
  beats: StoryBeat[],
  evidence: StoryBeatEvidence[]
): boolean {
  const byId = new Map(evidence.map(item => [item.id, item]));
  return beats.every(
    beat =>
      beat.evidenceIds.length > 0 &&
      beat.evidenceIds.every(id => byId.has(id)) &&
      beat.evidenceKey === keyFor(beat.evidenceIds.map(id => byId.get(id)!))
  );
}

/** Manual timing changes are explicit edits, not inferred boundaries. Null means invalid. */
export function updateStoryBeat(
  beats: StoryBeat[],
  id: string,
  patch: Pick<StoryBeat, "label" | "kind" | "start" | "end">,
  duration: number
): StoryBeat[] | null {
  const original = beats.find(beat => beat.id === id);
  if (
    !original ||
    !finite(duration) ||
    !finite(patch.start) ||
    !finite(patch.end) ||
    patch.start < 0 ||
    patch.end > duration ||
    patch.start >= patch.end ||
    !patch.label.trim() ||
    !STORY_BEAT_KINDS.includes(patch.kind) ||
    beats.some(
      beat => beat.id !== id && patch.start < beat.end && patch.end > beat.start
    )
  )
    return null;
  return beats
    .map(beat =>
      beat.id === id
        ? {
            ...beat,
            ...patch,
            label: patch.label.trim().slice(0, 80),
            origin: "manual" as const,
          }
        : beat
    )
    .sort((a, b) => a.start - b.start);
}
