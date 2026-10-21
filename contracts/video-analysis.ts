import { referenceStyleSchema } from "./edit-style-template";
/** Versioned source-clock evidence returned by the multimodal video reviewer. */
export const VIDEO_ANALYSIS_SCHEMA_VERSION = "video-analysis-v2" as const;
export const VIDEO_ROLES = [
  "hook",
  "core",
  "proof",
  "payoff",
  "cta",
  "other",
  "unclassified",
] as const;
export type VideoRole = (typeof VIDEO_ROLES)[number];
export type VideoInsight = {
  start: number;
  end: number;
  role: VideoRole;
  /** Why the observed interval performs this story function. */
  roleReason?: string;
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
        : "unclassified",
      roleReason: text(row.roleReason),
      label: text(row.label, 160),
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

export type VideoAnalysisCompleteness = {
  complete: boolean;
  coveragePercent: number;
  reason: string;
};

/** This checks report completeness, not truth of model observations. Source
 * sampling remains explicit and audience response needs separate validation. */
export function analyzeVideoCompleteness(
  insights: VideoInsight[],
  duration: number
): VideoAnalysisCompleteness {
  if (!Number.isFinite(duration) || duration <= 0 || !insights.length)
    return { complete: false, coveragePercent: 0, reason: "missing-intervals" };
  const sorted = [...insights].sort((a, b) => a.start - b.start);
  let covered = 0;
  let previousEnd = 0;
  let largestGap = 0;
  for (const interval of sorted) {
    if (
      !Number.isFinite(interval.start) ||
      !Number.isFinite(interval.end) ||
      interval.start < previousEnd ||
      interval.start < 0 ||
      interval.end <= interval.start ||
      interval.end > duration
    )
      return { complete: false, coveragePercent: 0, reason: "invalid-ranges" };
    covered += interval.end - interval.start;
    largestGap = Math.max(largestGap, interval.start - previousEnd);
    previousEnd = interval.end;
  }
  largestGap = Math.max(largestGap, duration - previousEnd);
  const coveragePercent = Math.min(100, (covered / duration) * 100);
  // Permit only timestamp rounding, not an unobserved beginning, middle or tail.
  if (coveragePercent < 98 || largestGap > 0.1)
    return { complete: false, coveragePercent, reason: "incomplete-coverage" };
  if (
    insights.some(interval =>
      [
        interval.attention,
        interval.stimulation,
        interval.processingLoad,
        interval.clarity,
      ].some(value => number(value) === null)
    )
  )
    return { complete: false, coveragePercent, reason: "missing-channels" };
  if (
    insights.some(
      interval =>
        !text(interval.visualEvidence) ||
        !text(interval.audioEvidence) ||
        !text(interval.strength) ||
        !text(interval.improvement) ||
        !text(interval.rationale) ||
        !text(interval.roleReason) ||
        !text(interval.label) ||
        number(interval.confidence, 1) === null
    )
  )
    return { complete: false, coveragePercent, reason: "missing-evidence" };
  if (insights.some(interval => !VIDEO_ROLES.includes(interval.role)))
    return { complete: false, coveragePercent, reason: "invalid-role" };
  return { complete: true, coveragePercent, reason: "" };
}

export type VideoEditorialScore = {
  score: number | null;
  attention: number | null;
  stimulation: number | null;
  processingLoad: number | null;
  clarity: number | null;
  processingEase: number | null;
  coveragePercent: number;
  method: "editorial-v1";
  status: "complete" | "incomplete";
  reason: string;
};

/** A transparent product rubric, not a psychometric or performance model.
 * Intensity is descriptive: louder/faster content earns no automatic reward.
 * Processing ease is 100-load; that is ease, not a claim that complex content
 * is intrinsically bad. All four evidence channels are required for scoring. */
export function scoreVideoInsights(
  insights: VideoInsight[],
  duration: number
): VideoEditorialScore {
  const completeness = analyzeVideoCompleteness(insights, duration);
  const base = {
    coveragePercent: completeness.coveragePercent,
    method: "editorial-v1" as const,
    reason: completeness.reason,
  };
  if (!completeness.complete)
    return {
      ...base,
      score: null,
      attention: null,
      stimulation: null,
      processingLoad: null,
      clarity: null,
      processingEase: null,
      status: "incomplete",
    };
  const seconds = insights.reduce((sum, row) => sum + row.end - row.start, 0);
  const mean = (
    channel: "attention" | "stimulation" | "processingLoad" | "clarity"
  ) =>
    insights.reduce(
      (sum, row) => sum + (row[channel] as number) * (row.end - row.start),
      0
    ) / seconds;
  const attention = mean("attention"),
    stimulation = mean("stimulation"),
    processingLoad = mean("processingLoad"),
    clarity = mean("clarity"),
    processingEase = 100 - processingLoad;
  return {
    ...base,
    score: Math.round(attention * 0.45 + clarity * 0.35 + processingEase * 0.2),
    attention,
    stimulation,
    processingLoad,
    clarity,
    processingEase,
    status: "complete",
  };
}

export const VIDEO_STORY_ROLES = [
  "hook",
  "core",
  "proof",
  "payoff",
  "cta",
] as const;
export type VideoStoryAssessment = {
  role: (typeof VIDEO_STORY_ROLES)[number];
  status: "present" | "absent" | "uncertain";
  note: string;
};
export function normalizeVideoStructure(
  value: unknown,
  insights: VideoInsight[]
): VideoStoryAssessment[] {
  if (!Array.isArray(value)) return [];
  const result: VideoStoryAssessment[] = [];
  for (const role of VIDEO_STORY_ROLES) {
    const candidates = value.filter(
      row => row && typeof row === "object" && row.role === role
    );
    if (candidates.length !== 1) return [];
    const row = candidates[0] as Record<string, unknown>;
    const seen = insights.some(interval => interval.role === role);
    if (
      !["present", "absent", "uncertain"].includes(String(row.status)) ||
      !text(row.note) ||
      (seen && row.status !== "present") ||
      (!seen && row.status === "present")
    )
      return [];
    result.push({
      role,
      status: row.status as VideoStoryAssessment["status"],
      note: text(row.note),
    });
  }
  return result;
}

export type VideoEditorialRecommendation = {
  id: string;
  start: number;
  end: number;
  label: string;
  observation: string;
  action: string;
  reason: string;
  priority: "high" | "medium" | "low";
  confidence: number;
};
export function normalizeVideoRecommendations(
  value: unknown,
  duration: number
): VideoEditorialRecommendation[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (
      typeof row.start !== "number" ||
      !Number.isFinite(row.start) ||
      row.start < 0 ||
      typeof row.end !== "number" ||
      !Number.isFinite(row.end) ||
      row.end <= row.start ||
      row.end > duration ||
      !text(row.label) ||
      !text(row.observation) ||
      !text(row.action) ||
      !text(row.reason) ||
      !["high", "medium", "low"].includes(String(row.priority)) ||
      number(row.confidence, 1) === null
    )
      return [];
    return [
      {
        id: `recommendation-${index + 1}`,
        start: row.start,
        end: row.end,
        label: text(row.label, 160),
        observation: text(row.observation),
        action: text(row.action),
        reason: text(row.reason),
        priority: row.priority as VideoEditorialRecommendation["priority"],
        confidence: row.confidence as number,
      },
    ];
  });
}

/** Provider-side shape enforcement complements (never replaces) the evidence,
 * coverage and source-clock validation above. Unsupported observations may be
 * null; a provider is never forced to invent a number to satisfy this schema. */
export function videoAnalysisResponseSchema(
  maxIntervals: number,
  duration: number,
  extractStyle = false
) {
  const object = (properties: Record<string, unknown>) => ({
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  });
  const string = { type: "string" };
  const score = { type: ["number", "null"], minimum: 0, maximum: 100 };
  const confidence = { type: ["number", "null"], minimum: 0, maximum: 1 };
  const time = { type: "number", minimum: 0, maximum: duration };
  const nullableNumber = { type: ["number", "null"] };
  const graphic = {
    ...object({
      kind: { type: "string", enum: ["text", "callout", "arrow", "highlight"] },
      text: string,
      color: string,
      background: string,
      x: { type: "number", minimum: 10, maximum: 90 },
      y: { type: "number", minimum: 10, maximum: 90 },
      size: { type: "number", minimum: 2, maximum: 16 },
      animation: { type: "string", enum: ["none", "fade", "pop", "slide"] },
    }),
    type: ["object", "null"],
  };
  const parameters = object({
    sourceIn: nullableNumber,
    speed: nullableNumber,
    volume: nullableNumber,
    // Keep null outside the string enum for providers whose schema adapter
    // represents enum values as strings. This accepts the same three values.
    fit: {
      anyOf: [{ type: "string", enum: ["cover", "contain"] }, { type: "null" }],
    },
    brightness: nullableNumber,
    contrast: nullableNumber,
    saturation: nullableNumber,
    fadeIn: nullableNumber,
    fadeOut: nullableNumber,
    graphic,
  });
  return object({
    ...(extractStyle ? { editingStyle: referenceStyleSchema() } : {}),
    schemaVersion: { type: "string", enum: [VIDEO_ANALYSIS_SCHEMA_VERSION] },
    summary: string,
    insights: {
      type: "array",
      minItems: 1,
      maxItems: maxIntervals,
      items: object({
        start: time,
        end: time,
        role: { type: "string", enum: VIDEO_ROLES },
        roleReason: string,
        label: string,
        attention: score,
        stimulation: score,
        processingLoad: score,
        clarity: score,
        confidence,
        visualEvidence: string,
        audioEvidence: string,
        strength: string,
        improvement: string,
        rationale: string,
      }),
    },
    structure: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: object({
        role: { type: "string", enum: VIDEO_STORY_ROLES },
        status: { type: "string", enum: ["present", "absent", "uncertain"] },
        note: string,
      }),
    },
    recommendations: {
      type: "array",
      maxItems: 10,
      items: object({
        start: time,
        end: time,
        label: string,
        observation: string,
        action: string,
        reason: string,
        priority: { type: "string", enum: ["high", "medium", "low"] },
        confidence,
      }),
    },
    noChangesReason: string,
    review: object({
      captions: { type: "string", enum: ["present", "absent", "unknown"] },
      captionNote: string,
      audio: { type: "string", enum: ["present", "absent", "unknown"] },
      audioNote: string,
      ending: {
        ...object({
          time,
          confidence,
          completed: { type: "boolean" },
          trailingContent: {
            type: "string",
            enum: ["empty", "meaningful", "unknown"],
          },
          note: string,
        }),
        type: ["object", "null"],
      },
    }),
    hook: object({ score, note: string }),
    pacing: object({ score, note: string }),
    changes: {
      type: "array",
      maxItems: 10,
      items: object({
        type: {
          type: "string",
          enum: [
            "trim",
            "split",
            "silence",
            "pacing",
            "audio",
            "style",
            "graphic",
          ],
        },
        label: string,
        reason: string,
        evidence: string,
        start: time,
        end: time,
        confidence,
        intensity: {
          type: "string",
          enum: ["light", "balanced", "aggressive"],
        },
        parameters,
      }),
    },
  });
}

export const VIDEO_ANALYSIS_RUBRIC = `
Required response schemaVersion: "${VIDEO_ANALYSIS_SCHEMA_VERSION}". A response lacking this exact schema, all four channels, full source-clock interval coverage and evidenced editorial recommendations is incomplete; never substitute a legacy attention-only report.
Return insights as chronological non-overlapping source-time intervals covering the video where evidence is available. For short-form sources, use intervals around 1-3 seconds or meaningful cuts; use up to 180 intervals and never fabricate unobserved content to fill coverage gaps.
Each insight: {start,end,role:hook|core|proof|payoff|cta|other|unclassified,roleReason,label,attention:0..100|null,stimulation:0..100|null,processingLoad:0..100|null,clarity:0..100|null,confidence:0..1|null,visualEvidence,audioEvidence,strength,improvement,rationale}. All text fields are required and specific to the interval. For genuinely silent/no-audio content, audioEvidence states the observed absence; it is not an empty string. If no change is justified, improvement explains what to preserve and why.
Observe the actual temporal video and available audio together: framing, movement, edits, visible text, intelligible speech, sound changes, context and payoff. This is never a transcript-only or isolated-screenshot review.
Automatically identify hook, core, proof, payoff, CTA and other sections from observed content; a CTA can be absent. Hook is an observed opening promise, question, outcome or pattern interruption; core advances the topic/story; proof substantiates a claim; payoff resolves a promise; CTA explicitly requests a viewer action. Other is observed content that serves none of those functions (for example credits); unclassified is a genuinely ambiguous role with a specific explanation. Never use Other as a default when role detection is missing. Never force standard hook lengths or invent a CTA. Preserve intentional pauses and meaningful action.
Return structure with exactly one {role:hook|core|proof|payoff|cta,status:present|absent|uncertain,note} assessment for each of those five roles. Present must correspond to at least one insight with that role; explain genuine absence or uncertainty.
Attention means an editorial estimate of how clearly this interval gives a target short-form viewer a reason to keep watching, using orientation, specificity, promised payoff and relevant visible evidence. Stimulation means content intensity from observed movement, edits and sound, not physiological arousal. ProcessingLoad estimates competing concepts, text, speech and visual tasks; high is not automatically bad. Clarity estimates how easily the interval's message and connection to the story can be followed.
Use consistent anchored editorial scales: Attention 0-20=no discernible reason to continue, 40-60=understandable but generic/deferred value, 80-100=specific immediate reason with visible/verbal support. Stimulation 0-20=mostly static/quiet, 40-60=moderate relevant audiovisual changes, 80-100=dense/rapid/loud changes; intensity alone is never quality. ProcessingLoad 0-20=one simple aligned cue, 40-60=multiple aligned cues/concepts, 80-100=competing speech/text/visual tasks that demand simultaneous processing. Clarity 0-20=meaning or relation to story cannot be followed, 40-60=understandable with ambiguity/readability costs, 80-100=precise readable coherent progression. Intermediate values require concrete reasons; these ordinal rubric values are not measured viewer percentages.
For every estimate, give specific visual/audio evidence, explain what works, what should improve and why. Cite the exact source interval; prioritize the first meaningful promise, time to visible proof, coherent progression, readable text, audible delivery and earned payoff. More cuts, louder sound or stronger visual intensity are not automatically better. Confidence is evidential confidence, not a calibrated probability.
Return recommendations [{start,end,label,observation,action,reason,priority:high|medium|low,confidence:0..1}] for specific editorial improvements, independently of executable changes. Rewrites, reshoots, factual verification and source assets not provided are editorial recommendations, not fictional executable operations. If no editorial or machine change is justified, return recommendations:[], changes:[] and a non-empty noChangesReason explaining the evidence for preserving the source. Do not return an unexplained empty plan.
The server computes an overall editorial index only from complete evidenced coverage: duration-weighted 45% Attention + 35% Clarity + 20% Processing ease (100-ProcessingLoad). Stimulation is required and reported but excluded from the scalar because more intensity is not necessarily better. This transparent product weighting is not a research-validated performance formula; do not output an independent overall score or predicted lift.
Use null for unsupported scores. Do not invent EEG, neural activity, brain-region activation, measured audience attention, dopamine, physiological responses, predicted retention percentages or scientifically validated performance lifts. These require actual viewer studies and a calibrated model. Do not claim training on a research corpus or number of studies. Research principles inform an editorial rubric, not a validated neural predictor.
Research context only: Lang (2000), https://doi.org/10.1111/j.1460-2466.2000.tb02833.x models mediated-message processing under limited capacity; Sweller (1988), https://doi.org/10.1207/s15516709cog1202_4 studies cognitive load and learning. Neither validates these numerical weights, short-form performance forecasts, or a neural reading from video alone. Cite a principle only when it explains an observed editorial tradeoff; never claim an individual viewer response was measured.
Assess audiovisual delivery separately from factual accuracy. A clear or compelling health, medical, scientific or numerical claim is not thereby correct. Do not certify source claims, diagnostic tests, advice or evidence from their presentation. Where a consequential claim is not substantiated by supplied material, identify the exact claim and recommend source verification as an editorial action; do not invent a citation, diagnose anyone or call the claim false from uncertainty alone. An editorial score never certifies truth, clinical validity or safety.
`;
