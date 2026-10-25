import type { Asset } from "@contracts/workspace";
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
  asset: Asset
): "stock" | "generated" | "uploaded" | "export" {
  if (
    asset.variantGroupId?.startsWith("builtin-audio:") ||
    asset.variantGroupId?.startsWith("stock:")
  )
    return "stock";
  if (asset.kind === "export") return "export";
  return asset.provenance?.origin === "ai-generated" ? "generated" : "uploaded";
}
export function libraryOrganizationMatches(
  asset: Asset,
  state: LibraryOrganizationState,
  now: number
): boolean {
  if (state.folder && asset.folderId !== state.folder) return false;
  if (state.origin !== "all" && state.origin !== assetOrigin(asset))
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
