import type { AutonomousGraphicReview } from "./autonomous-execution";
import type { EditOperation, EditProject } from "@contracts/workspace";
import type { EditorChatMessage } from "@contracts/editor-chat";

/** Planning prose is never an execution receipt. Summarize the applied
 * categories and keep the proposed rationale and omissions in the details. */
export function autonomousResultReceipt(
  proposedSummary: string,
  applied: ReadonlyArray<Pick<EditOperation, "type">>,
  review: AutonomousGraphicReview,
  ui: (text: string) => string
) {
  const reasonText = {
    "unknown-source-layout": ui("Source layout is unverified."),
    "source-overlap": ui("Overlay would cover source content."),
    "repeated-source-text": ui("Overlay repeats existing text."),
    "unsupported-source-copy": ui("Overlay adds unsupported text."),
    "competing-text": ui("Overlays overlap."),
    "reading-time": ui("Not enough reading time."),
  };
  const skipped = ui("Skipped overlays: {count}.").replace(
    "{count}",
    String(review.omitted.length)
  );
  const details: string[] = [];
  if (review.omitted.length)
    details.push(
      `${skipped} ${[...new Set(review.omitted.flatMap(item => item.issues.map(issue => reasonText[issue.reason])))].join(" ")}`
    );
  if (review.warnings.length) details.push(ui("Source layout is unverified."));
  const categories: Record<EditOperation["type"], string> = {
    trim: ui("Refined the pacing and cuts."),
    split: ui("Refined the pacing and cuts."),
    move: ui("Refined the pacing and cuts."),
    delete: ui("Refined the pacing and cuts."),
    silence: ui("Refined the pacing and cuts."),
    pacing: ui("Refined the pacing and cuts."),
    style: ui("Updated the visual treatment."),
    audio: ui("Updated the sound."),
    sound: ui("Updated the sound."),
    caption: ui("Updated the captions."),
    graphic: ui("Updated the graphics."),
    broll: ui("Added supporting shots."),
  };
  const appliedCategories = [
    ...new Set(applied.map(operation => categories[operation.type])),
  ].slice(0, 2);
  return {
    summary: appliedCategories.length
      ? appliedCategories.join(" ")
      : ui("Edit saved."),
    details,
    planSummary: proposedSummary.trim(),
  };
}

/** Older auto-edit messages persisted the proposal as their headline. Derive a
 * display-only receipt only from this project's applied operations, exact saved
 * step labels and this message's time window. Ambiguity gets a neutral receipt;
 * neither advice, other projects nor later runs can manufacture an action. */
export function persistedAutonomousReceipt(
  message: EditorChatMessage,
  project: EditProject,
  ui: (text: string) => string
): string | undefined {
  if (message.activity?.kind !== "auto-edit" || message.status !== "completed")
    return;
  const saved = project.editorChat?.messages.find(
    candidate =>
      candidate.id === message.id && candidate.createdAt === message.createdAt
  );
  const start = Date.parse(message.createdAt);
  if (!saved || !Number.isFinite(start)) return ui("Edit saved.");
  if (saved.activity?.appliedTypes)
    return autonomousResultReceipt(
      "",
      saved.activity.appliedTypes.map(type => ({ type })),
      { changes: [], omitted: [], warnings: [] },
      ui
    ).summary;
  const next = Math.min(
    ...(project.editorChat?.messages ?? [])
      .map(candidate => Date.parse(candidate.createdAt))
      .filter(time => Number.isFinite(time) && time > start)
  );
  const completions = project.revisions
    .filter(revision => revision.label === "Auto-edit")
    .map(revision => Date.parse(revision.createdAt))
    .filter(time => Number.isFinite(time) && time >= start && time < next);
  if (completions.length !== 1) return ui("Edit saved.");
  const applied = project.proposedChanges.filter(operation => {
    const reviewed = Date.parse(operation.reviewedAt ?? "");
    return (
      operation.status === "accepted" &&
      Number.isFinite(reviewed) &&
      reviewed >= start &&
      reviewed <= completions[0] &&
      message.activity!.steps.includes(operation.label)
    );
  });
  return autonomousResultReceipt(
    "",
    applied,
    { changes: [], omitted: [], warnings: [] },
    ui
  ).summary;
}
