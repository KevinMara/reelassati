import type { Asset, EditProject } from "@contracts/workspace";
import { contentDuration, resizeTimeline } from "./edit-timeline";
import { normalizeReview } from "@contracts/source-review";

/** Trim only an observed empty tail; all unassessed or intentional layers hold the end. */
export function trimObservedEnding(
  project: EditProject,
  assets: Asset[]
): EditProject {
  const originalEnd = contentDuration(project.clips);
  let ending = 0;
  for (const clip of project.clips) {
    const finish = clip.start + clip.duration;
    const asset = assets.find(a => a.id === clip.assetId);
    const review = normalizeReview(
      project.sourceReviews?.find(r => r.assetId === clip.assetId),
      asset?.duration
    ).ending;
    if (
      clip.locked ||
      asset?.kind !== "video" ||
      !review ||
      !review.completed ||
      review.confidence < 0.9 ||
      review.trailingContent !== "empty" ||
      review.time < clip.inPoint ||
      review.time >= clip.outPoint
    ) {
      ending = Math.max(ending, finish);
      continue;
    }
    // Source seconds must be mapped into timeline seconds, including speed and trim.
    ending = Math.max(
      ending,
      Math.min(
        finish,
        clip.start + (review.time - clip.inPoint) / (clip.speed ?? 1) + 0.2
      )
    );
  }
  // Complete the entire last transcribed phrase, even if visual analysis ended earlier.
  ending = Math.max(ending, ...project.transcript.map(s => s.end + 0.2));
  ending = Math.min(originalEnd, ending);
  if (!Number.isFinite(ending) || ending < 0.2 || originalEnd - ending < 0.25)
    return project;
  const resized = resizeTimeline(project, ending);
  // Avoid even floating-point normalization of a protected clip's source bounds.
  resized.clips = resized.clips.map(
    c =>
      project.clips.find(original => original.id === c.id && original.locked) ??
      c
  );
  return resized;
}

export const EDIT_RECIPES = {
  "Fast product demo":
    "Show the product or result in the opening 1–2 seconds. Preserve a clear problem, demonstration, proof and payoff. Cut on completed phrases and visible action. Use supporting footage only where it proves a specific claim. Keep speech at natural speed. Avoid random transitions or unrelated stock shots.",
  "Clean editorial":
    "Use restrained straight cuts, legible short captions from actual speech and clean shot continuity. Preserve pauses that carry meaning. Prefer original framing; avoid cropping product details or faces. Subtle color and short fades only where motivated. No decorative B-roll without a clear purpose.",
  "Cinematic story":
    "Build setup, development and resolution using observed footage. Preserve intentional atmosphere and natural movement. Use longer holds where the image communicates, restrained color and motivated fades. Never invent a dramatic event or remove context just to hit a duration.",
  "Natural talking head":
    "Keep the speaker's meaning and authentic delivery. Trim only evidenced dead time, false starts and repetition. Preserve breaths and complete words at boundaries. Keep playback speed natural and use supporting visuals sparingly. Captions must follow timestamped speech and finish before the next phrase.",
} as const;

/** Deterministic checks before an automated edit may replace the user's timeline. */
export function auditAutomatedEdit(
  before: EditProject,
  after: EditProject,
  assets: Asset[]
): string[] {
  const problems: string[] = [];
  if (before.clips.length && !after.clips.length)
    problems.push("The edit removed every clip");
  for (const locked of before.clips.filter(c => c.locked)) {
    if (
      JSON.stringify(after.clips.find(c => c.id === locked.id)) !==
      JSON.stringify(locked)
    )
      problems.push(`Locked clip changed: ${locked.label}`);
  }
  for (const clip of after.clips) {
    const speed = clip.speed ?? 1;
    if (
      ![clip.start, clip.duration, clip.inPoint, clip.outPoint, speed].every(
        Number.isFinite
      ) ||
      clip.start < 0 ||
      clip.duration <= 0 ||
      clip.inPoint < 0 ||
      clip.outPoint <= clip.inPoint ||
      speed < 0.25 ||
      speed > 4
    )
      problems.push(`Invalid timing: ${clip.label}`);
    const asset = assets.find(a => a.id === clip.assetId);
    if (clip.assetId && !asset) problems.push(`Missing media: ${clip.label}`);
    if (
      asset &&
      (asset.kind === "video" || asset.kind === "audio") &&
      asset.duration &&
      (clip.outPoint > asset.duration + 0.05 ||
        clip.inPoint + clip.duration * speed > asset.duration + 0.05)
    )
      problems.push(`Clip extends beyond its source: ${clip.label}`);
  }
  return problems;
}
