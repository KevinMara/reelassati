import type { EditorChatReference } from "@contracts/editor-chat";

export type EditorChatTimeTarget = {
  range: { start: number; end: number };
  section?: { id: string; label: string };
};

/** A chosen interval owns the request scope. Its section reference is derived
 * from that same interval, so replacing/removing it cannot leave a stale target. */
export function editorChatTargetContext(
  target: EditorChatTimeTarget | undefined,
  selectedClipId?: string
) {
  const sectionReference: EditorChatReference | undefined = target?.section
    ? {
        name: target.section.label,
        text: JSON.stringify({
          timelineSection: { ...target.section, ...target.range },
        }),
      }
    : undefined;
  return {
    range: target?.range,
    selectedClipIds: !target && selectedClipId ? [selectedClipId] : undefined,
    sectionReference,
  };
}
