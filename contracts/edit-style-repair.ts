import type { EditOperation } from "./workspace";
import { assertExecutableEditPlan } from "./edit-planning-context";
import { EditPlanValidationError } from "./edit-plan-validation";

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;

/** Run before filtering scope/stock so source and compiled indexes still match.
 * Only absent style controls qualify; transport, targets and other failures do not. */
export function missingStyleControls(raw: unknown, compiled: EditOperation[]) {
  if (!Array.isArray(raw) || raw.length !== compiled.length) return [];
  const failures: number[] = [];
  compiled.forEach((operation, index) => {
    if (operation.type !== "style" || record(raw[index])?.type !== "style") return;
    try { assertExecutableEditPlan([operation]); }
    catch (error) {
      if (!(error instanceof EditPlanValidationError) || error.reason !== "missing_control") throw error;
      failures.push(index);
    }
  });
  return failures;
}

const controls = new Set(["fadeIn", "fadeOut", "exposure", "temperature", "tint", "highlights",
  "shadows", "whites", "blacks", "brightness", "contrast", "saturation", "fit", "colorLut", "visual"]);

/** Preserve every operation, cue, target, range and scene index. A correction
 * supplies controls only; the caller must normalize and validate the entire plan. */
export function mergeStyleControlRepair(raw: unknown[], indices: number[], correction: unknown) {
  const invalid = (): never => { throw new EditPlanValidationError("missing_control", "The style correction did not supply executable controls."); };
  const fixes = record(correction)?.styles;
  if (!indices.length || !Array.isArray(fixes) || fixes.length !== indices.length) return invalid();
  const remaining = new Set(indices);
  if (remaining.size !== indices.length) return invalid();
  const result = raw.slice();
  for (const item of fixes) {
    const fix = record(item), parameters = record(fix?.parameters);
    const index = fix?.operationIndex;
    if (!fix || typeof index !== "number" || !Number.isInteger(index) || !remaining.delete(index) ||
        Object.keys(fix).some(key => !["operationIndex", "parameters"].includes(key)) ||
        !parameters || !Object.keys(parameters).length || Object.keys(parameters).some(key => !controls.has(key)) ||
        record(raw[index])?.type !== "style") return invalid();
    result[index] = { ...record(raw[index]), parameters };
  }
  return result;
}

export const EDIT_STYLE_REPAIR_DIRECTION = `Correct only the listed style operations with missing executable controls.
Return JSON {styles:[{operationIndex:0,parameters:{...}}]} with exactly one entry for each supplied index.
Keep the stated creative purpose. Supply actual supported visual, color or fade controls, using the capability schema.
Do not change timing, cue, targets, type, labels, other operations, or source content. Do not add media generation,
text or an unsupported effect. A preset name or prose description is not an executable control.
This proposal has not been applied. Every corrected operation will be normalized and the complete timeline revalidated.`;
