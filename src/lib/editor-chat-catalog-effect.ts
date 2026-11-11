import type { Asset, EditProject } from "@contracts/workspace";
import type { EditorChatAction } from "@contracts/editor-chat";
import {
  findCatalogEffect,
  editorEffectUrl,
  catalogEffectPlacement,
} from "@contracts/editor-effect-catalog";
import { insertChatAsset, recordChatEdit } from "./editor-chat-execution";

export type CatalogEffectAction = Extract<
  EditorChatAction,
  { kind: "catalog-effect" }
>;

export async function resolveChatCatalogEffect(
  id: string,
  assets: Asset[],
  upload: (file: File) => Promise<Asset>,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch
): Promise<Asset> {
  const entry = findCatalogEffect(id);
  const variantGroupId = `builtin-effect:${entry.id}`;
  const saved = assets.find(
    asset =>
      asset.variantGroupId === variantGroupId &&
      asset.kind === "video" &&
      asset.status === "ready" &&
      asset.url
  );
  if (saved)
    return {
      ...saved,
      duration: entry.duration,
      width: entry.width,
      height: entry.height,
    };
  signal?.throwIfAborted();
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(45000)])
    : AbortSignal.timeout(45000);
  const response = await fetcher(editorEffectUrl(entry), {
    signal: requestSignal,
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("The effect file could not be downloaded.");
  const blob = await response.blob();
  if (blob.size !== entry.bytes)
    throw new Error("The effect file does not match the catalog.");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer()
  );
  const actual = Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  if (actual !== entry.sha256)
    throw new Error("The effect file does not match the catalog.");
  signal?.throwIfAborted();
  const asset = await upload(
    new File([blob], `${entry.name}.mp4`, { type: "video/mp4" })
  );
  if (asset.kind !== "video" || asset.status !== "ready" || !asset.url)
    throw new Error(
      "The effect upload did not finish. Check Library before trying again."
    );
  return {
    ...asset,
    name: entry.name,
    duration: entry.duration,
    width: entry.width,
    height: entry.height,
    variantGroupId,
  };
}

export function applyChatCatalogEffect(
  project: EditProject,
  asset: Asset,
  action: CatalogEffectAction
) {
  const entry = findCatalogEffect(action.catalogId);
  if (
    asset.kind !== "video" ||
    asset.variantGroupId !== `builtin-effect:${entry.id}`
  )
    throw new Error("This file does not match the requested catalog effect.");
  const placement = catalogEffectPlacement(
    entry,
    action.insert,
    project.duration
  );
  return placement
    ? recordChatEdit(
        project,
        insertChatAsset(
          project,
          asset,
          action.id,
          placement.start,
          placement.duration
        ),
        action.id,
        action.label
      )
    : project;
}
