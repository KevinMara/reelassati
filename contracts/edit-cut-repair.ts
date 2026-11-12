import type { EditOperation } from "./workspace";
import { EditPlanValidationError } from "./edit-plan-validation";

/** A cut correction can replace only proposed trims. It cannot silently change
 * the sound, graphics, generation requests or other valid parts of the plan. */
export function cutRepairScope(error: unknown, raw: unknown): number[] | null {
  if (
    !(error instanceof EditPlanValidationError) ||
    !["trim_duplicate", "trim_bounds_invalid"].includes(error.reason) ||
    !Array.isArray(raw)
  )
    return null;
  const indices = raw.flatMap((operation, index) =>
    operation && typeof operation === "object" && operation.type === "trim"
      ? [index]
      : []
  );
  return indices.length ? indices : null;
}

export function mergeCutRepair(
  raw: unknown[],
  indices: number[],
  correction: unknown,
  coverage?: unknown
) {
  const result = correction as { cuts?: unknown; note?: unknown } | null;
  if (
    !result ||
    !Array.isArray(result.cuts) ||
    !result.cuts.length ||
    result.cuts.some(
      operation =>
        !operation ||
        typeof operation !== "object" ||
        !["trim", "silence"].includes(operation.type)
    )
  )
    throw new EditPlanValidationError(
      "retained_range_conflict",
      "The cut correction did not provide executable retained ranges."
    );
  const replacements = new Set(indices);
  const originalTargets = new Set(
    indices.flatMap(index => {
      const operation = raw[index] as Partial<EditOperation> | undefined;
      return Array.isArray(operation?.targetClipIds)
        ? operation.targetClipIds
        : [];
    })
  );
  if (
    originalTargets.size &&
    result.cuts.some(
      operation =>
        !Array.isArray(operation.targetClipIds) ||
        !operation.targetClipIds.length ||
        operation.targetClipIds.some((id: string) => !originalTargets.has(id))
    )
  )
    throw new EditPlanValidationError(
      "retained_range_conflict",
      "The cut correction changed a clip outside the original cut scope."
    );
  const mapping = new Map<number, number[]>();
  const changes: unknown[] = [];
  const cutIndices = result.cuts.map((_, index) => indices[0] + index);
  raw.forEach((operation, index) => {
    if (replacements.has(index)) {
      mapping.set(index, cutIndices);
      if (index === indices[0])
        changes.push(...(result.cuts as EditOperation[]));
    } else {
      mapping.set(index, [changes.length]);
      changes.push(operation);
    }
  });
  const editorialCoverage = Array.isArray(coverage)
    ? coverage.map(scene => {
        if (
          !scene ||
          typeof scene !== "object" ||
          !Array.isArray(scene.operationIndexes)
        )
          return scene;
        return {
          ...scene,
          operationIndexes: [
            ...new Set(
              scene.operationIndexes.flatMap((index: unknown) =>
                typeof index === "number" ? (mapping.get(index) ?? []) : []
              )
            ),
          ],
        };
      })
    : coverage;
  return { changes, editorialCoverage };
}

export const EDIT_CUT_REPAIR_DIRECTION =
  "Correct only the proposed cuts that failed timeline validation. Return JSON {cuts:[...]} with complete executable operations, using the same operation schema. The supplied draft has NOT been applied. trim means KEEP one source range, not delete a range: at most one trim per original target clip. To remove a proven dead interval inside a clip, use silence on the ORIGINAL timeline clock, preserving all meaningful words, actions and coverage. Never turn an uncertain trim into deletion. Retained ranges must remain within the original clip's source bounds and speed mapping. Do not add any other operation type. Keep the editorial intent; all non-trim draft operations are preserved automatically. Use only the supplied evidence and original clip IDs. Return no invented transcript or new media.";
