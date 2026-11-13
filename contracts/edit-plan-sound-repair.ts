import {
  resolveEditPlanningReferences,
  type EditPlanningContext,
} from "./edit-planning-context";
import { EditPlanValidationError } from "./edit-plan-validation";

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** Inspect every reference so a repair never conceals an unrelated invalid cut.
 * Only sound selection/alignment is repairable here; timing and scope stay fixed. */
export function editPlanSoundRepairFeedback(
  raw: unknown,
  context: EditPlanningContext,
  duration: number,
  selected: string[] = []
) {
  if (!Array.isArray(raw)) return [];
  const failures: Array<{
    operationIndex: number;
    operation: Record<string, unknown>;
    timingMode: "cue" | "range";
  }> = [];
  raw.forEach((candidate, index) => {
    try {
      resolveEditPlanningReferences([candidate], context, duration, selected);
    } catch (error) {
      const operation = object(candidate);
      if (
        !(error instanceof EditPlanValidationError) ||
        error.reason !== "sound_cue_invalid" ||
        operation?.type !== "sound"
      ) {
        if (error instanceof EditPlanValidationError)
          throw new EditPlanValidationError(
            error.reason,
            error.message,
            index,
            error.operationType
          );
        throw error;
      }
      failures.push({
        operationIndex: index,
        operation,
        timingMode: operation.cue == null ? "range" : "cue",
      });
    }
  });
  return failures;
}

/** Apply only source/alignment controls, preserving all other decisions and indexes.
 * Recompile the complete proposal before it can reach the timeline or billing. */
export function mergeEditPlanSoundRepair(
  raw: unknown[],
  feedback: ReturnType<typeof editPlanSoundRepairFeedback>,
  repair: unknown,
  context: EditPlanningContext,
  duration: number,
  selected: string[] = []
) {
  const entries = object(repair)?.sounds;
  const invalid = () => {
    throw new EditPlanValidationError(
      "sound_cue_invalid",
      "The sound correction did not resolve the supplied cues."
    );
  };
  if (
    !Array.isArray(entries) ||
    entries.length !== feedback.length ||
    !feedback.length
  )
    return invalid();
  const changes = raw.slice();
  const remaining = new Set(feedback.map(item => item.operationIndex));
  for (const entry of entries) {
    const fix = object(entry);
    if (
      !fix ||
      !Number.isInteger(fix.operationIndex) ||
      !remaining.delete(Number(fix.operationIndex)) ||
      typeof fix.assetId !== "string"
    )
      return invalid();
    const index = Number(fix.operationIndex);
    const original = object(raw[index])!;
    if (original.cue != null) {
      if (
        !["start", "peak"].includes(String(fix.align)) ||
        Object.keys(fix).some(
          key => !["operationIndex", "assetId", "align"].includes(key)
        )
      )
        return invalid();
      changes[index] = {
        ...original,
        parameters: { ...object(original.parameters), assetId: fix.assetId },
        cue: { ...object(original.cue), align: fix.align },
      };
    } else {
      const sound = context.freeSounds.find(
        sound => sound.assetId === fix.assetId
      );
      const span = Number(original.end) - Number(original.start);
      const sourceIn = fix.sourceIn;
      if (
        Object.keys(fix).some(
          key => !["operationIndex", "assetId", "sourceIn"].includes(key)
        ) ||
        typeof original.start !== "number" ||
        typeof original.end !== "number" ||
        !Number.isFinite(span) ||
        span <= 0 ||
        !sound ||
        typeof sourceIn !== "number" ||
        !Number.isFinite(sourceIn) ||
        sourceIn < 0 ||
        sourceIn + span > sound.duration + 0.000001 ||
        !sound.sourceRanges.some(
          range =>
            sourceIn >= range.start - 0.000001 &&
            sourceIn + span <= range.end + 0.000001
        )
      )
        return invalid();
      changes[index] = {
        ...original,
        parameters: {
          ...object(original.parameters),
          assetId: fix.assetId,
          sourceIn: fix.sourceIn,
        },
      };
    }
  }
  resolveEditPlanningReferences(changes, context, duration, selected);
  return changes;
}

export const EDIT_PLAN_SOUND_REPAIR_DIRECTION = `Repair only the supplied invalid sound selections/alignment in this existing edit plan.
Return JSON {"sounds":[...]}.
For timingMode=cue, return {"operationIndex":0,"assetId":"exact supplied freeSounds assetId","align":"start or peak"}.
For timingMode=range, return {"operationIndex":0,"assetId":"exact supplied freeSounds assetId","sourceIn":0}.
Return one entry per failure, using its original operationIndex. Keep its stated purpose and choose a relevant available sound.
assetId must exactly match freeSounds. align:peak requires an SFX; music uses start. A numeric-range correction must preserve
its original start/end and duration, selecting sourceIn so the entire duration fits inside one supplied heard sourceRanges interval
and the available source duration. Never add a cue to a numeric-range operation. Do not invent IDs or change timeline timing, targets,
other operations, or the creative direction. No new media generation or purchases. This is an internal correction, not user-facing copy.`;
