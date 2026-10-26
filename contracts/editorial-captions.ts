import {
  CAPTION_PRESETS,
  getCaptionPreset,
  type CaptionAppearance,
} from "./editor-presets";
import { normalizeTranscriptWords } from "./transcript-timing";
import type { EditProject } from "./workspace";

export interface AutonomousCaptionTreatment {
  preset: string;
  appearance: CaptionAppearance;
}

export function canStyleAutonomousCaptions(
  project: EditProject,
  enabled: boolean
) {
  return (
    enabled &&
    project.transcript.length > 0 &&
    !project.sourceReviews?.some(review => review.captions === "present") &&
    !project.editStyleTemplate?.profile.captionTreatment
  );
}

/** A single bounded presentation choice, never new text or estimated word timing. */
export function normalizeAutonomousCaptionTreatment(
  project: EditProject,
  value: unknown
): AutonomousCaptionTreatment | undefined {
  if (
    !canStyleAutonomousCaptions(project, true) ||
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  )
    return;
  const row = value as Record<string, unknown>;
  if (
    typeof row.preset !== "string" ||
    !CAPTION_PRESETS.some(preset => preset.id === row.preset)
  )
    return;
  const appearance =
    row.appearance &&
    typeof row.appearance === "object" &&
    !Array.isArray(row.appearance)
      ? (row.appearance as CaptionAppearance)
      : undefined;
  const p = getCaptionPreset(row.preset, appearance);
  const timed = project.transcript.every(segment => {
    const words = normalizeTranscriptWords(segment.text, segment.words);
    return Boolean(
      words?.length &&
      words.every(
        word =>
          word.start >= segment.start - 0.001 && word.end <= segment.end + 0.001
      )
    );
  });
  return {
    preset: p.id,
    appearance: {
      color: p.color,
      outlineColor: p.outlineColor,
      activeColor: p.activeColor,
      background: p.background ?? null,
      size: p.size,
      bold: p.bold,
      uppercase: p.uppercase,
      outline: p.outline,
      position: p.position,
      margin: p.margin,
      maxCharacters: p.maxCharacters,
      animation: timed ? p.animation : "none",
    },
  };
}

export function applyAutonomousCaptionTreatment(
  project: EditProject,
  value: unknown
): EditProject {
  const treatment = normalizeAutonomousCaptionTreatment(project, value);
  return treatment
    ? {
        ...project,
        captionStyle: treatment.preset,
        captionAppearance: treatment.appearance,
      }
    : project;
}

export function autonomousCaptionDirection(
  project: EditProject,
  enabled: boolean
) {
  if (!canStyleAutonomousCaptions(project, enabled))
    return "Do not return captionTreatment. Preserve the explicit template and prepared caption treatment; never add or restyle burned-in source captions.";
  return `You may return one optional top-level captionTreatment:{preset,appearance} for the prepared editable captions. Choose its typography and rhythm from this content and any specific user style request; do not default every source to word-pop or giant uppercase text. This styles existing transcript words only. Available presets: ${JSON.stringify(CAPTION_PRESETS.map(({ id, description }) => ({ id, description })))}. Appearance supports color/outlineColor/activeColor:#RRGGBB,background:#RRGGBB|null,size:2..12,bold:boolean,uppercase:boolean,outline:0..2,position:top|bottom,margin:2..40,maxCharacters:12..64,animation:none|active-word|word-reveal|word-only|word-pulse|word-pop|word-slide|word-fade|word-type. Use word animation only with complete measured word clocks; otherwise use none. Keep short readable lines, sufficient outline or a contrasting surface, and observed space around faces, demonstrations and other text. Preserve any explicit template treatment. Omit captionTreatment when the existing treatment already suits the content.`;
}
