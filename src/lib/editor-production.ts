import type { Asset, EditProject } from "@contracts/workspace";

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
