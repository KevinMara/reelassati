import type { Asset, EditProject } from "./workspace";
import type { NativeTransitionRecipe } from "./native-transitions";
import { clipLaneNumber, clipLaneKind } from "./timeline-layers";

/** Renderer-local overlay. Never persists a blob URL or changes the source
 * speech/caption clocks. The durable project retains its editable recipe. */
export function materializeNativeTransition(
  project: EditProject,
  recipe: NativeTransitionRecipe,
  rendered: {
    url: string;
    width: number;
    height: number;
    duration: number;
    size?: number;
  }
): { project: EditProject; asset: Asset } {
  const assetId = `${recipe.key}-render`,
    existing = project.clips.find(c => c.id === recipe.key);
  if (existing)
    throw new Error("Native transition render identity is already in use");
  const asset: Asset = {
    id: assetId,
    name: "Rendered shot transition",
    kind: "video",
    status: "ready",
    contentType: "video/x-matroska",
    url: rendered.url,
    width: rendered.width,
    height: rendered.height,
    duration: rendered.duration,
    size: rendered.size ?? 0,
    createdAt: "",
  };
  const lane =
    Math.max(
      1,
      ...project.clips
        .filter(c => c.track === "video" || c.track === "overlay")
        .map(clipLaneNumber)
    ) + 1;
  const pictureSolo = project.trackSettings?.some(
    row =>
      row.soloPicture &&
      project.clips.some(
        c => clipLaneKind(c) === row.kind && clipLaneNumber(c) === row.number
      )
  );
  return {
    asset,
    project: {
      ...project,
      // The materialized frame is a companion of the visible source pair,
      // including when their original video lanes are soloed.
      trackSettings: pictureSolo
        ? [
            ...(project.trackSettings ?? []),
            { kind: "video", number: lane, soloPicture: true },
          ]
        : project.trackSettings,
      clips: [
        ...project.clips,
        {
          id: recipe.key,
          assetId,
          track: "overlay",
          lane,
          label: "Shot transition",
          start: recipe.start,
          duration: recipe.duration,
          inPoint: 0,
          outPoint: recipe.duration,
          locked: true,
          muted: true,
          primaryFootage: false,
          transitionHandle: true,
          color: "#8d7ae6",
          fit: "cover",
        },
      ],
    },
  };
}
