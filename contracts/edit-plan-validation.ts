import type { EditOperation } from "./workspace";

export const EDIT_PLAN_VALIDATION_STAGES = [
  "references",
  "template",
  "normalization",
  "scope",
  "executable",
  "trim",
  "composition",
  "graphic_preflight",
  "graphic_refinement",
] as const;
export type EditPlanValidationStage =
  (typeof EDIT_PLAN_VALIDATION_STAGES)[number];
export const EDIT_PLAN_VALIDATION_REASONS = [
  "changes_not_array",
  "unsupported_operation",
  "target_invalid",
  "reference_unavailable",
  "reference_conflict",
  "cue_unsupported",
  "cue_invalid",
  "cue_timing_unavailable",
  "sound_cue_invalid",
  "source_offset_conflict",
  "duration_invalid",
  "range_invalid",
  "timing_conflict",
  "target_not_visual",
  "selection_conflict",
  "missing_timing",
  "missing_control",
  "missing_media",
  "missing_target",
  "trim_duplicate",
  "trim_bounds_invalid",
  "linked_targets_invalid",
  "retained_range_conflict",
  "clock_conflict",
  "ripple_range_invalid",
  "style_example_excluded",
  "preset_unavailable",
  "graphic_mode_invalid",
  "graphic_refinement_invalid",
  "graphic_refinement_scope",
  "graphic_refinement_unsafe",
  "execution_duplicate",
  "execution_locked",
  "execution_interval_unavailable",
  "execution_caption_overlap",
  "execution_supporting_media",
  "execution_apply_failed",
  "execution_split_target",
  "audit_empty_edit",
  "audit_picture_removed",
  "audit_blank_opening",
  "audit_locked_changed",
  "audit_timing_invalid",
  "audit_missing_media",
  "audit_source_overrun",
  "audit_graphic_readability",
  "audit_spoken_word_cut",
  "validation_failed",
] as const;
export type EditPlanValidationReason =
  (typeof EDIT_PLAN_VALIDATION_REASONS)[number];
const operationTypes = new Set<EditOperation["type"]>([
  "trim",
  "split",
  "move",
  "delete",
  "caption",
  "silence",
  "pacing",
  "broll",
  "audio",
  "style",
  "graphic",
  "sound",
]);

/** Diagnostics carry explicit codes, never classifications parsed from provider
 * text or Error.message. The message remains internal to local validation. */
export class EditPlanValidationError extends Error {
  readonly reason: EditPlanValidationReason;
  readonly operationIndex?: number;
  readonly operationType?: EditOperation["type"];

  constructor(
    reason: EditPlanValidationReason,
    message: string,
    operationIndex?: number,
    operationType?: EditOperation["type"]
  ) {
    super(message);
    this.name = "EditPlanValidationError";
    this.reason = reason;
    this.operationIndex = operationIndex;
    this.operationType = operationType;
  }
}

export interface EditPlanValidationDiagnostic {
  version: 1;
  stage: EditPlanValidationStage;
  reason: EditPlanValidationReason;
  operationCount: number;
  operationIndex?: number;
  operationType?: EditOperation["type"];
}

/** A fresh bounded projection suitable for logs, the response and owned ledger
 * metadata. Never spread an error, operation, prompt, label, URL or parameters. */
export function editPlanValidationDiagnostic(
  error: unknown,
  stage: EditPlanValidationStage,
  operationCount: number
): EditPlanValidationDiagnostic {
  const recognized =
    error instanceof EditPlanValidationError &&
    EDIT_PLAN_VALIDATION_REASONS.includes(error.reason);
  return {
    version: 1,
    stage: EDIT_PLAN_VALIDATION_STAGES.includes(stage)
      ? stage
      : "normalization",
    reason: recognized ? error.reason : "validation_failed",
    operationCount: Number.isSafeInteger(operationCount)
      ? Math.max(0, Math.min(10000, operationCount))
      : 0,
    ...(recognized &&
    Number.isSafeInteger(error.operationIndex) &&
    error.operationIndex! >= 0 &&
    error.operationIndex! < 10000
      ? { operationIndex: error.operationIndex }
      : {}),
    ...(recognized &&
    error.operationType &&
    operationTypes.has(error.operationType)
      ? { operationType: error.operationType }
      : {}),
  };
}
