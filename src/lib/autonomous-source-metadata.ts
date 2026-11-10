import type { Asset, EditProject } from "@contracts/workspace";
import { resolveVideoMetadata } from "./media-metadata";

/** Legacy library records can have a duration but no geometry. Preview keeps its
 * own DOM dimensions; the planner and spatial guard need the measured record. */
export async function resolveAutonomousSourceMetadata(
  project: EditProject,
  assets: Asset[],
  signal?: AbortSignal,
  resolve = resolveVideoMetadata
): Promise<Asset[]> {
  const sourceIds = new Set(
    project.clips
      .filter(clip => clip.track === "video" && !clip.hidden && !clip.graphic)
      .map(clip => clip.assetId)
  );
  const measured: Asset[] = [];
  for (const asset of assets) {
    signal?.throwIfAborted();
    if (asset.kind !== "video" || !sourceIds.has(asset.id)) continue;
    const result = await resolve(asset, signal);
    signal?.throwIfAborted();
    if (
      result.duration !== asset.duration ||
      result.width !== asset.width ||
      result.height !== asset.height
    )
      measured.push(result);
  }
  return measured;
}

/** Merge only measured metadata, preserving concurrent names/folders/URLs. A
 * removed or replaced source must never be recreated by a slow metadata load. */
export function mergeAutonomousSourceMetadata(
  current: Asset[],
  measured: Asset[]
): Asset[] {
  for (const source of measured) {
    const match = current.find(asset => asset.id === source.id);
    if (
      !match ||
      match.kind !== source.kind ||
      match.size !== source.size ||
      match.contentType !== source.contentType
    )
      throw new Error(
        "The source changed while its metadata was loading. Reopen the edit."
      );
  }
  return current.map(asset => {
    const source = measured.find(item => item.id === asset.id);
    return source
      ? {
          ...asset,
          duration: source.duration,
          width: source.width,
          height: source.height,
        }
      : asset;
  });
}
