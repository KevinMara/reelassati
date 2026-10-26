import type { AutonomousGraphicReview } from "./autonomous-execution";
import type { EditOperation } from "@contracts/workspace";

/** Once execution omits a proposal, its authored summary can no longer be
 * treated as a receipt. Count the submitted steps and report omissions apart. */
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
  const changed = review.omitted.length > 0 || review.warnings.length > 0;
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
    summary: changed
      ? appliedCategories.length
        ? appliedCategories.join(" ")
        : ui("Edit saved.")
      : proposedSummary,
    details,
  };
}
