import type { Asset, WorkspaceDocument } from "@contracts/workspace";

/** Preserve the uploaded output's server identity and provenance; reference the original separately. */
export function derivedStillAsset(uploaded: Asset, original: Asset, projectId: string, width: number, height: number): Asset {
  return { ...uploaded, parentAssetId: original.id, projectId, width, height };
}

export function assertStillImageContext(workspace: WorkspaceDocument, projectId: string, original: Asset) {
  const current = workspace.assets.find(asset => asset.id === original.id);
  if (!workspace.projects.some(project => project.id === projectId) || !current || current.kind !== "image" || current.status !== "ready" || current.url !== original.url || current.size !== original.size || current.createdAt !== original.createdAt) {
    throw new Error("The project or source image changed. Start again with the current Library image.");
  }
}
