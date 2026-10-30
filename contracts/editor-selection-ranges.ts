import type { EditorChatAction } from "./editor-chat";
import type { EditProject } from "./workspace";
import { mergeStoryRanges } from "./story-beats";

export type EditRange = { start: number; end: number };
export function readSelectionRanges(value: unknown): EditRange[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > 32 ||
    value.some(
      r =>
        !r ||
        typeof r !== "object" ||
        !Number.isFinite(r.start) ||
        !Number.isFinite(r.end) ||
        r.start < 0 ||
        r.end <= r.start ||
        r.end > 86400
    )
  )
    throw new Error("Choose valid section ranges.");
  return mergeStoryRanges(value);
}

/** The outer range is only an envelope. Never authorize edits through its gaps. */
export function assertActionWithinRanges(
  action: EditorChatAction,
  ranges: EditRange[] | undefined,
  project: EditProject
) {
  if (!ranges?.length) return;
  const contains = (start: number, end: number) =>
    ranges.some(r => start >= r.start - 1e-6 && end <= r.end + 1e-6);
  const requireRange = (start: number, end: number) => {
    if (!contains(start, end))
      throw new Error(
        "This action crosses a gap between the selected sections."
      );
  };
  if (action.kind === "edit")
    requireRange(action.operation.start, action.operation.end);
  else if (action.kind === "insert")
    requireRange(
      action.start,
      action.start + (action.duration ?? project.duration)
    );
  else if (
    (action.kind === "generate" || action.kind === "catalog-audio") &&
    action.insert
  )
    requireRange(
      action.insert.start,
      action.insert.start + (action.insert.duration ?? project.duration)
    );
  else if (action.kind === "story-beats")
    action.beats.forEach(b => requireRange(b.start, b.end));
  else if (action.kind === "speech-zoom" || action.kind === "beat-cuts") {
    for (const id of action.targetClipIds) {
      const clip = project.clips.find(c => c.id === id);
      if (clip) requireRange(clip.start, clip.start + clip.duration);
    }
  } else if (action.kind === "adjacent-transition") {
    const incoming = project.clips.find(c => c.id === action.incomingId);
    if (incoming)
      requireRange(
        incoming.start - action.duration / 2,
        incoming.start + action.duration / 2
      );
  } else if (action.kind === "settings" || action.kind === "history") {
    throw new Error(
      "This action changes the whole edit. Clear the section selection first."
    );
  }
}
