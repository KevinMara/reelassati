import type { Asset } from "@contracts/workspace";
type Folder = { id: string; name: string };
/** Earlier sound imports used this collection name; it is stock, not a separate library. */
export function isStockCollection(folder: Folder): boolean {
  return /^(?:futuristic\s+sfxs?|reel\s+stock|stock)$/i.test(folder.name.trim());
}
export type LibraryOrganizationState = {
  folder: string;
  origin: string;
  date: string;
  sort: string;
};
export const DEFAULT_LIBRARY_ORGANIZATION: LibraryOrganizationState = {
  folder: "",
  origin: "all",
  date: "all",
  sort: "recent",
};
export function assetOrigin(
  asset: Asset,
  folders: readonly Folder[] = []
): "stock" | "generated" | "uploaded" | "export" {
  if (
    asset.variantGroupId?.startsWith("builtin-audio:") ||
    asset.variantGroupId?.startsWith("stock:") ||
    folders.some(folder => folder.id === asset.folderId && isStockCollection(folder))
  )
    return "stock";
  if (asset.kind === "export") return "export";
  return asset.provenance?.origin === "ai-generated" ? "generated" : "uploaded";
}
export function libraryOrganizationMatches(
  asset: Asset,
  state: LibraryOrganizationState,
  now: number,
  folders: readonly Folder[] = []
): boolean {
  if (state.folder && asset.folderId !== state.folder) return false;
  if (state.origin !== "all" && state.origin !== assetOrigin(asset, folders))
    return false;
  const days = Number(state.date);
  if (
    Number.isFinite(days) &&
    days > 0 &&
    now - Date.parse(asset.createdAt) > days * 86400000
  )
    return false;
  return true;
}
