import type { EditorChatMessage } from "@contracts/editor-chat";

/** In-memory intent only. A reload never schedules or resumes model work. */
export interface ReelAddition {
  id: string;
  parentId?: string;
}
export function nextReelAddition(
  queue: ReelAddition[],
  messages: EditorChatMessage[]
) {
  const next = queue[0];
  if (!next) return;
  const parent = messages.find(message => message.id === next.parentId);
  if (
    parent &&
    ["failed", "stopped", "partial"].includes(parent.status ?? "")
  ) {
    queue.splice(0); // The saved request remains available for an explicit resume.
    return;
  }
  if (parent && ["planning", "running", "ready"].includes(parent.status ?? ""))
    return;
  return queue.shift();
}
