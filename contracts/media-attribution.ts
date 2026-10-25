import type { Asset, EditProject } from "./workspace";
export function editAttribution(
  project: Pick<EditProject, "clips">,
  assets: Asset[]
) {
  const used = new Set(
    project.clips.flatMap(clip => (clip.assetId ? [clip.assetId] : []))
  );
  return [
    ...new Map(
      assets
        .filter(asset => used.has(asset.id) && asset.stock)
        .map(asset => [
          `${asset.stock!.provider}:${asset.stock!.id}`,
          asset.stock!,
        ])
    ).values(),
  ]
    .map(
      item =>
        `${item.title} — ${item.creator}\n${item.attribution ? `${item.attribution}\n` : ""}${item.license}: ${item.licenseUrl}\n${item.source}`
    )
    .join("\n\n");
}
