import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import { allocateTimelineLane, type TimelineLane } from "./timeline-lanes";
import { contentDuration } from "./edit-timeline";

/** Both direct insertion and drag/drop use the same measured source bounds. */
export function placeLibraryAsset(
  project: EditProject,
  asset: Asset,
  id: string,
  at = contentDuration(project.clips, 0),
  destination?: TimelineLane
): TimelineClip {
  if (asset.status !== "ready") throw new Error("This file is not ready yet.");
  const duration =
    asset.kind === "image" ? asset.duration || 3 : asset.duration;
  if (!duration || !Number.isFinite(duration) || duration <= 0)
    throw new Error(
      "Measure the file duration before adding it to the timeline."
    );
  if (!Number.isFinite(at) || at < 0)
    throw new Error("Choose a valid timeline position.");
  const track = asset.kind === "audio" ? "audio" : "video";
  if (destination && destination.kind !== track)
    throw new Error("Choose a matching media track.");
  return {
    id,
    assetId: asset.id,
    track,
    lane: allocateTimelineLane(
      project.clips,
      track,
      at,
      duration,
      destination?.number ?? 1
    ),
    label: asset.name,
    start: at,
    duration,
    inPoint: 0,
    outPoint: duration,
    locked: false,
    muted: false,
    speed: 1,
    volume: 1,
    color: track === "audio" ? "#B45F7A" : "#6F5AD8",
  };
}
