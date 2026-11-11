import type { Asset, EditProject } from "@contracts/workspace";
import type { EditorChatAction } from "@contracts/editor-chat";
import {
  normalizeSharedCatalogItem,
  sharedCatalogPlacement,
} from "@contracts/shared-media-catalog";
import {
  platformApi,
  captureUploadRequestScope,
  verifyUploadRequestScope,
} from "./platform-api";
import { insertChatAsset, recordChatEdit } from "./editor-chat-execution";

export async function resolveSharedCatalogAsset(
  id: string,
  assets: Asset[],
  signal?: AbortSignal
): Promise<Asset> {
  signal?.throwIfAborted();
  const saved = assets.find(
    asset =>
      asset.variantGroupId === `shared-catalog:${id}` &&
      asset.catalog?.id === id &&
      asset.status === "ready" &&
      asset.url
  );
  if (saved) return saved;
  const scope = await captureUploadRequestScope();
  const asset = await platformApi.importSharedCatalog(id, { signal, scope });
  signal?.throwIfAborted();
  await verifyUploadRequestScope(scope);
  const item = normalizeSharedCatalogItem(asset.catalog);
  if (
    item.id !== id ||
    asset.kind !== item.kind ||
    asset.status !== "ready" ||
    !asset.url
  )
    throw new Error("The catalog import did not finish correctly.");
  return {
    ...asset,
    catalog: item,
    duration: item.duration,
    width: item.width,
    height: item.height,
    variantGroupId: `shared-catalog:${item.id}`,
  };
}
export function applySharedCatalogAction(
  project: EditProject,
  asset: Asset,
  action: Extract<EditorChatAction, { kind: "shared-media" }>
) {
  const item = normalizeSharedCatalogItem(asset.catalog);
  if (
    item.id !== action.catalogId ||
    asset.variantGroupId !== `shared-catalog:${item.id}`
  )
    throw new Error("This asset does not match the selected catalog item.");
  const insert = sharedCatalogPlacement(item, action.insert, project.duration);
  return insert
    ? recordChatEdit(
        project,
        insertChatAsset(
          project,
          asset,
          action.id,
          insert.start,
          insert.duration
        ),
        action.id,
        action.label
      )
    : project;
}
