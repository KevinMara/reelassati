import type { Asset, EditProject } from "./workspace";
import { effectiveTimelineClips } from "./timeline-mixer";
import { normalizeGraphic } from "./motion-graphics";
import { graphicReadabilityProblems } from "./graphic-readability";

/** Deterministic checks before an automated edit may replace the user's timeline. */
export function auditAutomatedEdit(
  before: EditProject,
  after: EditProject,
  assets: Asset[]
): string[] {
  const problems: string[] = [];
  if (before.clips.length && !after.clips.length)
    problems.push("The edit removed every clip");
  const sourceKinds = new Map(assets.map(asset => [asset.id, asset.kind]));
  // Match renderer eligibility, including hidden/solo tracks. Audio must not
  // disguise complete picture loss; replacement media or graphics still count.
  const pictureClips = (project: EditProject) =>
    effectiveTimelineClips(project).filter(clip => {
      if (
        clip.hidden ||
        clip.duration <= 0 ||
        clip.start + clip.duration <= 0 ||
        clip.start >= (project.duration ?? Infinity)
      )
        return false;
      if (normalizeGraphic(clip.graphic)) return true;
      return (
        clip.track !== "audio" &&
        clip.track !== "captions" &&
        ["video", "image", "export"].includes(
          sourceKinds.get(clip.assetId ?? "") ?? ""
        )
      );
    });
  const beforePicture = pictureClips(before);
  const afterPicture = pictureClips(after);
  if (beforePicture.length && !afterPicture.length)
    problems.push("The edit removed all visible picture content");
  if (
    beforePicture.some(clip => clip.start <= 0.001) &&
    afterPicture.length &&
    !afterPicture.some(clip => clip.start <= 0.001)
  )
    problems.push("The edit introduced a blank opening");
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
    const originalGraphic = before.clips.find(c => c.id === clip.id);
    if (
      clip.graphic &&
      (!originalGraphic ||
        originalGraphic.duration !== clip.duration ||
        JSON.stringify(originalGraphic.graphic) !==
          JSON.stringify(clip.graphic))
    )
      problems.push(...graphicReadabilityProblems(clip, after.aspectRatio));
    const originalSource = before.clips.filter(c => c.assetId === clip.assetId);
    const words =
      after.sourceSpeech
        ?.find(s => s.assetId === clip.assetId)
        ?.segments.flatMap(s => s.words ?? []) ?? [];
    if (!clip.muted && !clip.graphic && originalSource.length && words.length) {
      for (const side of ["inPoint", "outPoint"] as const) {
        const boundary = clip[side];
        if (originalSource.some(c => Math.abs(c[side] - boundary) < 0.001))
          continue;
        const continuous = after.clips.some(
          peer =>
            peer.id !== clip.id &&
            peer.assetId === clip.assetId &&
            !peer.muted &&
            (side === "inPoint"
              ? Math.abs(peer.start + peer.duration - clip.start) < 0.001 &&
                Math.abs(peer.outPoint - boundary) < 0.001
              : Math.abs(clip.start + clip.duration - peer.start) < 0.001 &&
                Math.abs(peer.inPoint - boundary) < 0.001)
        );
        if (
          !continuous &&
          words.some(
            word => boundary > word.start + 0.035 && boundary < word.end - 0.035
          )
        )
          problems.push(`Cut crosses a spoken word: ${clip.label}`);
      }
    }
  }
  return problems;
}
