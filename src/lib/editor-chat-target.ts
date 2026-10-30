import {
  mergeStoryRanges,
  storySectionShortName,
  type StoryBeat,
} from "@contracts/story-beats";
import type { EditorChatReference } from "@contracts/editor-chat";

export type EditorChatTimeTarget = {
  range: { start: number; end: number };
  ranges?: { start: number; end: number }[];
  sections?: Pick<StoryBeat, "id" | "label" | "kind" | "start" | "end">[];
  section?: { id: string; label: string };
};

/** A chosen interval owns the request scope. Its section reference is derived
 * from that same interval, so replacing/removing it cannot leave a stale target. */
export function editorChatTargetContext(
  target: EditorChatTimeTarget | undefined,
  selectedClipId?: string
) {
  const ranges = target?.ranges ? mergeStoryRanges(target.ranges) : undefined;
  const sectionReference: EditorChatReference | undefined = target?.sections
    ?.length
    ? {
        name: target.sections.map(storySectionShortName).join(" + "),
        text: JSON.stringify({
          timelineSections: target.sections,
          selectedRanges: ranges,
        }),
      }
    : target?.section
      ? {
          name: target.section.label,
          text: JSON.stringify({
            timelineSection: { ...target.section, ...target.range },
          }),
        }
      : undefined;
  return {
    range: target?.range,
    ranges,
    selectedClipIds: !target && selectedClipId ? [selectedClipId] : undefined,
    sectionReference,
  };
}
