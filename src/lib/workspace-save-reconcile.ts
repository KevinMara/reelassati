import type { WorkspaceDocument } from "@contracts/workspace";

/** Only the save that owns the latest local mutation may replace its body. */
export function reconcileAcknowledgedWorkspace(
  current: WorkspaceDocument,
  acknowledged: WorkspaceDocument,
  savingMutation: number,
  latestMutation: number
): WorkspaceDocument {
  if (savingMutation === latestMutation) return acknowledged;
  // Server revisions acknowledge persistence, not the ordering of local edits.
  // Several optimistic bodies can legitimately have the same revision number.
  return {
    ...current,
    revision: Math.max(current.revision, acknowledged.revision),
  };
}
