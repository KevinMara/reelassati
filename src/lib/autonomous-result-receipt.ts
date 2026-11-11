import type { AutonomousGraphicReview } from "./autonomous-execution";
import type { EditOperation, EditProject } from "@contracts/workspace";
import type { EditorChatMessage } from "@contracts/editor-chat";
import type { EditorialCoverageReview } from "@contracts/editorial-coverage";
import type { EditorialStockReview } from "@contracts/editorial-stock";

/** The server may withdraw a graphic before the client preflight sees it. Its
 * omission still belongs to the saved result, even when every remaining step
 * executes successfully. Deduplicate by operation, never by model-written text. */
export function autonomousReceiptReview(
  local: AutonomousGraphicReview,
  withdrawn: AutonomousGraphicReview["omitted"] = []
): AutonomousGraphicReview {
  const omitted = new Map(
    withdrawn.map(decision => [decision.operationId, decision])
  );
  for (const decision of local.omitted) {
    const previous = omitted.get(decision.operationId);
    omitted.set(decision.operationId, {
      ...decision,
      issues: [
        ...new Map(
          [...(previous?.issues ?? []), ...decision.issues].map(issue => [
            issue.reason,
            issue,
          ])
        ).values(),
      ],
    });
  }
  return { ...local, omitted: [...omitted.values()] };
}

/** Planning prose is never an execution receipt. Summarize the applied
 * categories and keep the proposed rationale and omissions in the details. */
export function autonomousResultReceipt(
  proposedSummary: string,
  applied: ReadonlyArray<Pick<EditOperation, "type">>,
  review: AutonomousGraphicReview,
  ui: (text: string) => string,
  coverage?: EditorialCoverageReview,
  stockReview?: EditorialStockReview
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
  if (stockReview?.omitted.length)
    details.push(
      ui(
        "Supporting shots left out: {count}. Their source timing or availability could not be verified."
      ).replace("{count}", String(stockReview.omitted.length))
    );
  if (coverage?.status === "partial")
    details.push(
      ui("Content decisions need review: {count}.").replace(
        "{count}",
        String(
          Math.max(
            1,
            coverage.scenes.filter(scene => scene.issues.length).length
          )
        )
      )
    );
  if (review.omittedSounds?.length)
    details.push(
      ui("Skipped sound cues: {count}.").replace(
        "{count}",
        String(review.omittedSounds.length)
      )
    );
  if (review.omitted.length)
    details.push(
      `${skipped} ${[...new Set(review.omitted.flatMap(item => item.issues.map(issue => reasonText[issue.reason])))].join(" ")}`
    );
  if (review.warnings.length)
    for (const reason of new Set(
      review.warnings.flatMap(item => item.issues.map(issue => issue.reason))
    )) {
      const notice = reasonText[reason];
      if (notice && !details.some(detail => detail.includes(notice)))
        details.push(notice);
    }
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
  const partial =
    review.omitted.length > 0 ||
    Boolean(review.omittedSounds?.length) ||
    coverage?.status === "partial" ||
    Boolean(stockReview?.omitted.length);
  const appliedSummary = appliedCategories.length
    ? appliedCategories.join(" ")
    : ui("Edit saved.");
  return {
    status: partial ? ("partial" as const) : ("completed" as const),
    summary: partial
      ? `${ui("Partial edit saved.")}${appliedCategories.length ? ` ${appliedSummary}` : ""}`
      : appliedSummary,
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
  if (
    message.activity?.kind !== "auto-edit" ||
    !["completed", "partial"].includes(message.status ?? "")
  )
    return;
  const saved = project.editorChat?.messages.find(
    candidate =>
      candidate.id === message.id && candidate.createdAt === message.createdAt
  );
  const start = Date.parse(message.createdAt);
  if (!saved || !Number.isFinite(start))
    return message.status === "partial"
      ? ui("Partial edit saved.")
      : ui("Edit saved.");
  const completeSummary = (summary: string) =>
    saved.status === "partial" ||
    saved.activity?.editorialCoverage?.status === "partial"
      ? `${ui("Partial edit saved.")}${summary === ui("Edit saved.") ? "" : ` ${summary}`}`
      : summary;
  if (saved.activity?.appliedTypes)
    return completeSummary(
      autonomousResultReceipt(
        "",
        saved.activity.appliedTypes.map(type => ({ type })),
        { changes: [], omitted: [], warnings: [] },
        ui
      ).summary
    );
  const next = Math.min(
    ...(project.editorChat?.messages ?? [])
      .map(candidate => Date.parse(candidate.createdAt))
      .filter(time => Number.isFinite(time) && time > start)
  );
  const completions = project.revisions
    .filter(revision => revision.label === "Auto-edit")
    .map(revision => Date.parse(revision.createdAt))
    .filter(time => Number.isFinite(time) && time >= start && time < next);
  if (completions.length !== 1) return completeSummary(ui("Edit saved."));
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
  return completeSummary(
    autonomousResultReceipt(
      "",
      applied,
      { changes: [], omitted: [], warnings: [] },
      ui
    ).summary
  );
}
