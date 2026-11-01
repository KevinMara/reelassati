import type { EditOperation, EditProject } from "./workspace";

/** Shared by every planning pass: a retained range is not a removed range. */
export const EDIT_CUT_GUIDANCE =
  "Cut semantics: trim REPLACES each target clip with ONE retained range; start is its new timeline position, end-start is the retained duration, and parameters.sourceIn is the beginning to KEEP in source-media seconds. It does not remove the start/end interval. Emit at most one trim per original clip, within that clip's existing source bounds. For example, keeping source seconds 0..8 at the beginning is trim start=0,end=8,sourceIn=0. To REMOVE an evidenced non-meaningful gap at timeline seconds 4..4.3 while preserving both surrounding phrases, use silence start=4,end=4.3. Silence ripple-deletes that interval across unlocked tracks and closes the gap. Multiple gap removals are separate silence operations on the ORIGINAL timeline clock, never multiple trims of the same clip. Do not infer removable silence merely from missing ASR words. Preserve complete speech, meaningful action and visual coverage from the opening; do not leave a black gap where removed footage used to be.";

/** Reject contradictory retained ranges before executing or charging for a plan.
 * Never reinterpret an ambiguous model trim as permission to erase footage. */
export function assertAutonomousTrimSemantics(
  project: Pick<EditProject, "clips">,
  operations: EditOperation[]
) {
  const trimmed = new Set<string>();
  for (const operation of operations) {
    if (operation.type !== "trim") continue;
    for (const id of new Set(operation.targetClipIds)) {
      if (trimmed.has(id))
        throw new Error(
          "The edit plan trims the same clip more than once. Gap removals need separate ripple cuts."
        );
      trimmed.add(id);
      const clip = project.clips.find(candidate => candidate.id === id);
      if (!clip) throw new Error("The trim target is no longer available.");
      const sourceIn = operation.parameters?.sourceIn ?? clip.inPoint;
      const sourceOut =
        sourceIn + (operation.end - operation.start) * (clip.speed ?? 1);
      if (
        !Number.isFinite(sourceIn) ||
        !Number.isFinite(sourceOut) ||
        sourceOut <= sourceIn ||
        sourceIn < clip.inPoint - 0.001 ||
        sourceOut > clip.outPoint + 0.001
      )
        throw new Error(
          "The trim must retain a range inside the selected source clip."
        );
    }
  }
}
