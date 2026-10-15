/** Source-clock evidence returned by the multimodal video reviewer. */
export const VIDEO_ROLES = [
  "hook",
  "core",
  "proof",
  "payoff",
  "cta",
  "other",
] as const;
export type VideoRole = (typeof VIDEO_ROLES)[number];
export type VideoInsight = {
  start: number;
  end: number;
  role: VideoRole;
  label: string;
  attention: number | null;
  stimulation: number | null;
  processingLoad: number | null;
  clarity: number | null;
  confidence: number | null;
  visualEvidence: string;
  audioEvidence: string;
  strength: string;
  improvement: string;
  rationale: string;
};
const text = (value: unknown, max = 1600) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const number = (value: unknown, max = 100) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= max
    ? value
    : null;

/** Reject invented/out-of-source ranges and unsupported scores. Never fill gaps
 * or manufacture a hook/CTA when the model did not observe one. */
export function normalizeVideoInsights(
  value: unknown,
  duration: number
): VideoInsight[] {
  if (!Array.isArray(value) || !Number.isFinite(duration) || duration <= 0)
    return [];
  const candidates: VideoInsight[] = [];
  for (const item of value.slice(0, 180)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.start !== "number" ||
      typeof row.end !== "number" ||
      !Number.isFinite(row.start) ||
      !Number.isFinite(row.end) ||
      row.start < 0 ||
      row.start >= row.end ||
      row.end > duration
    )
      continue;
    const visualEvidence = text(row.visualEvidence),
      audioEvidence = text(row.audioEvidence);
    if (!visualEvidence && !audioEvidence) continue;
    candidates.push({
      start: row.start,
      end: row.end,
      role: VIDEO_ROLES.includes(row.role as VideoRole)
        ? (row.role as VideoRole)
        : "other",
      label: text(row.label, 160) || "Source interval",
      attention: number(row.attention),
      stimulation: number(row.stimulation),
      processingLoad: number(row.processingLoad),
      clarity: number(row.clarity),
      confidence: number(row.confidence, 1),
      visualEvidence,
      audioEvidence,
      strength: text(row.strength),
      improvement: text(row.improvement),
      rationale: text(row.rationale),
    });
  }
  const sorted = candidates.sort(
    (a, b) => a.start - b.start || (b.confidence ?? 0) - (a.confidence ?? 0)
  );
  const result: VideoInsight[] = [];
  for (const row of sorted)
    if (!result.length || row.start >= result[result.length - 1].end)
      result.push(row);
  return result;
}

export const VIDEO_ANALYSIS_RUBRIC = `
Return insights as chronological non-overlapping source-time intervals covering the video where evidence is available. For short-form sources, use intervals around 1-3 seconds or meaningful cuts; use up to 180 intervals and never fabricate unobserved content to fill coverage gaps.
Each insight: {start,end,role:hook|core|proof|payoff|cta|other,label,attention:0..100|null,stimulation:0..100|null,processingLoad:0..100|null,clarity:0..100|null,confidence:0..1|null,visualEvidence,audioEvidence,strength,improvement,rationale}.
Observe the actual temporal video and available audio together: framing, movement, edits, visible text, intelligible speech, sound changes, context and payoff. This is never a transcript-only or isolated-screenshot review.
Automatically identify hook, core, proof, payoff, CTA and other sections from observed content; a CTA can be absent. Never force standard hook lengths or invent a CTA. Preserve intentional pauses and meaningful action.
Attention means an editorial estimate of how clearly this interval gives a target short-form viewer a reason to keep watching, using orientation, specificity, promised payoff and relevant visible evidence. Stimulation means content intensity from observed movement, edits and sound, not physiological arousal. ProcessingLoad estimates competing concepts, text, speech and visual tasks; high is not automatically bad. Clarity estimates how easily the interval's message and connection to the story can be followed.
For every estimate, give specific visual/audio evidence, explain what works, what should improve and why. Cite the exact source interval; prioritize the first meaningful promise, time to visible proof, coherent progression, readable text, audible delivery and earned payoff. More cuts, louder sound or stronger visual intensity are not automatically better. Confidence is evidential confidence, not a calibrated probability.
Use null for unsupported scores. Do not invent EEG, neural activity, brain-region activation, measured audience attention, dopamine, physiological responses, predicted retention percentages or scientifically validated performance lifts. These require actual viewer studies and a calibrated model. Do not claim training on a research corpus or number of studies. Research principles inform an editorial rubric, not a validated neural predictor.
`;
