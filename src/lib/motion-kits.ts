import { motionKitClips, type MotionKitDraft } from "@contracts/motion-kits";
import type { Asset, EditProject } from "@contracts/workspace";
import { allocateTimelineLane, clipLaneKind } from "./timeline-lanes";

/** One history change, fresh selection group, and no overwrite of existing footage. */
export function insertMotionKit(
  project: EditProject,
  assets: readonly Asset[],
  draft: MotionKitDraft,
  start: number,
  identity: string
): EditProject {
  const added = motionKitClips(draft, assets, start, identity);
  const clips = [...project.clips];
  for (const clip of added) {
    clip.lane = allocateTimelineLane(
      clips,
      clipLaneKind(clip),
      start,
      clip.duration,
      clip.assetId ? 2 : 1
    );
    clips.push(clip);
  }
  return {
    ...project,
    duration: Math.max(project.duration, start + draft.seconds),
    clips,
  };
}
