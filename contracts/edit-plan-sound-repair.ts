import { resolveEditPlanningReferences, type EditPlanningContext } from "./edit-planning-context";
import { EditPlanValidationError } from "./edit-plan-validation";

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;

/** Inspect every reference so a repair never conceals an unrelated invalid cut.
 * Only sound selection/alignment is repairable here; timing and scope stay fixed. */
export function editPlanSoundRepairFeedback(
  raw: unknown, context: EditPlanningContext, duration: number, selected: string[] = []
) {
  if (!Array.isArray(raw)) return [];
  const failures: Array<{ operationIndex: number; operation: Record<string, unknown> }> = [];
  raw.forEach((candidate, index) => {
    try {
      resolveEditPlanningReferences([candidate], context, duration, selected);
    } catch (error) {
      const operation = object(candidate);
      if (!(error instanceof EditPlanValidationError) ||
          error.reason !== "sound_cue_invalid" || operation?.type !== "sound") {
        if (error instanceof EditPlanValidationError)
          throw new EditPlanValidationError(error.reason, error.message, index, error.operationType);
        throw error;
      }
      failures.push({ operationIndex: index, operation });
    }
  });
  return failures;
}

/** Apply the two allowed fields only, preserving all other decisions and indexes.
 * Recompile the complete proposal before it can reach the timeline or billing. */
export function mergeEditPlanSoundRepair(
  raw: unknown[], feedback: ReturnType<typeof editPlanSoundRepairFeedback>, repair: unknown,
  context: EditPlanningContext, duration: number, selected: string[] = []
) {
  const entries = object(repair)?.sounds;
  const invalid = () => { throw new EditPlanValidationError("sound_cue_invalid", "The sound correction did not resolve the supplied cues."); };
  if (!Array.isArray(entries) || entries.length !== feedback.length || !feedback.length) return invalid();
  const changes = raw.slice();
  const remaining = new Set(feedback.map(item => item.operationIndex));
  for (const entry of entries) {
    const fix = object(entry);
    if (!fix || !Number.isInteger(fix.operationIndex) || !remaining.delete(Number(fix.operationIndex)) ||
        typeof fix.assetId !== "string" || !["start", "peak"].includes(String(fix.align)) ||
        Object.keys(fix).some(key => !["operationIndex", "assetId", "align"].includes(key))) return invalid();
    const index = Number(fix.operationIndex);
    const original = object(raw[index])!;
    changes[index] = { ...original,
      parameters: { ...object(original.parameters), assetId: fix.assetId },
      cue: { ...object(original.cue), align: fix.align },
    };
  }
  resolveEditPlanningReferences(changes, context, duration, selected);
  return changes;
}

export const EDIT_PLAN_SOUND_REPAIR_DIRECTION = `Repair only the supplied invalid sound selections/alignment in this existing edit plan.
Return JSON {"sounds":[{"operationIndex":0,"assetId":"exact supplied freeSounds assetId","align":"start or peak"}]}.
Return one entry per failure, using its original operationIndex. Keep its stated purpose and choose a relevant available sound.
assetId must exactly match freeSounds. align:peak requires an SFX; music uses start. Do not invent IDs or change timing, targets,
other operations, or the creative direction. No new media generation or purchases. This is an internal correction, not user-facing copy.`;
