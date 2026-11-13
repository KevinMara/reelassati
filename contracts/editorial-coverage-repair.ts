import type { EditorialCoverageReview } from "./editorial-coverage";

const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

export function editorialCoverageRepairScope(review: EditorialCoverageReview) {
  return review.scenes.filter(scene =>
    scene.issues.some(issue => issue !== "unresolved-source")
  );
}

/** Retain every valid draft operation. A review may correct flagged decisions
 * and append evidence-based content edits, but cannot rewrite unrelated beats,
 * delete working operations or silently authorize media generation. */
export function mergeEditorialCoverageRepair(
  draft: unknown,
  coverage: unknown,
  review: EditorialCoverageReview,
  response: unknown
) {
  const raw = record(response);
  const scope = editorialCoverageRepairScope(review);
  if (!Array.isArray(draft) || !Array.isArray(raw?.decisions) ||
      !Array.isArray(raw?.additions) || raw.decisions.length !== scope.length)
    throw new Error("Invalid editorial correction.");
  const expected = new Set(scope.map(scene => scene.sceneId));
  const decisions = raw.decisions.map(record);
  if (decisions.some(row => !row || !expected.has(String(row.sceneId))) ||
      new Set(decisions.map(row => row!.sceneId)).size !== scope.length)
    throw new Error("Editorial correction changed unrelated scenes.");
  const additions = raw.additions.map(record);
  const allowed = new Set(["trim", "move", "delete", "silence", "pacing", "broll", "caption", "graphic"]);
  if (additions.some(row => !row || !allowed.has(String(row.type)) ||
      (row.type === "broll" && (!record(row.parameters)?.assetId || record(row.parameters)?.prompt))))
    throw new Error("Editorial correction requested unsupported media.");
  const referenced = new Set(decisions.filter(row => row!.decision === "improve")
    .flatMap(row => Array.isArray(row!.operationIndexes) ? row!.operationIndexes : []));
  if (additions.some((_, index) => !referenced.has(draft.length + index)))
    throw new Error("Editorial correction added an unaccounted operation.");
  // Missing and duplicated original decisions are replaced, not carried forward.
  const untouched = Array.isArray(coverage)
    ? coverage.filter(row => !expected.has(String(record(row)?.sceneId))) : [];
  return { changes: [...draft, ...additions], editorialCoverage: [...untouched, ...decisions] };
}

export const EDITORIAL_COVERAGE_REPAIR_DIRECTION = `
Review the supplied plan's flagged content decisions before the edit is applied.
The deterministic feedback is not a request to add effects or inflate edit count.
Return JSON {decisions:[...],additions:[...]}. Return exactly one corrected decision
for each supplied flagged scene, using the editorialCoverage schema. Other scenes
and all existing draft operations are preserved automatically and cannot be changed.
If the source already communicates the scene's purpose and the draft merely adds
color, camera motion or sound, its content decision is preserve. Explain what the
source already delivers; do not invent a deficiency to justify an improvement.
If there is an actual missing explanation, demonstration, continuity or pacing
need, address it with supported, source-grounded content operations in additions.
Use the same operation schema and original timeline clock. operationIndexes refer
to the concatenation of draft followed by additions. Every addition must be linked
to an improve decision. No new stock search or media generation is authorized by
this correction; use only supplied media and evidence. Do not duplicate existing
captions, visible prop labels or working graphics. Do not change or remove existing
draft operations. If existing edits prevent a safe correction or the source cannot
support it, use blocked and explain the concrete limitation. Unknown evidence must
stay unknown. Return no audience-performance guarantees or claimed render checks.
`.trim();
