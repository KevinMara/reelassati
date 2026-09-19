import type { Asset, EditProject } from "@contracts/workspace";
import type { EditorChatAction } from "@contracts/editor-chat";
import { editorAudioUrl } from "@contracts/editor-audio-catalog";
import {
  catalogAudioPlacement,
  findCatalogAudio,
} from "@contracts/editor-catalog-audio";
import { insertChatAsset, recordChatEdit } from "./editor-chat-execution";

export type CatalogAudioAction = Extract<
  EditorChatAction,
  { kind: "catalog-audio" }
>;

/** Reuse the user's saved sound, including their filename; never buy or generate audio. */
export async function resolveChatCatalogAudio(
  catalogId: string,
  assets: Asset[],
  upload: (file: File) => Promise<Asset>,
  fetcher: typeof fetch = fetch
): Promise<Asset> {
  const entry = findCatalogAudio(catalogId);
  const group = `builtin-audio:${entry.id}`;
  const existing = assets.find(
    asset =>
      asset.variantGroupId === group &&
      asset.kind === "audio" &&
      asset.status === "ready" &&
      !!asset.url
  );
  if (existing) return { ...existing, duration: entry.duration };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetcher(editorAudioUrl(entry), {
      signal: controller.signal,
      credentials: "same-origin",
    });
    if (!response.ok)
      throw new Error(
        "The free sound could not be downloaded. No audio generation was started."
      );
    const contentType = (response.headers.get("content-type") || "").split(
      ";"
    )[0];
    if (
      contentType &&
      !contentType.startsWith("audio/") &&
      contentType !== "application/octet-stream"
    )
      throw new Error(
        "The free sound returned an invalid media file. No audio generation was started."
      );
    const blob = await response.blob();
    if (!blob.size || blob.size > 32 * 1024 * 1024)
      throw new Error(
        "The free sound file is empty or exceeds its supported size."
      );
    const extension = entry.file.split(".").pop() || "mp3";
    const type =
      extension === "wav"
        ? "audio/wav"
        : extension === "ogg"
          ? "audio/ogg"
          : "audio/mpeg";
    const saved = await upload(
      new File([blob], `${entry.name}.${extension}`, { type })
    );
    if (saved.kind !== "audio" || saved.status !== "ready" || !saved.url)
      throw new Error(
        "The sound upload did not finish. Check Library before trying again."
      );
    return {
      ...saved,
      name: entry.name,
      duration: entry.duration,
      variantGroupId: group,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** An absent insert field is Library-only; explicit placement is reversible and idempotent. */
export function applyChatCatalogAudio(
  project: EditProject,
  asset: Asset,
  action: CatalogAudioAction
): EditProject {
  const entry = findCatalogAudio(action.catalogId);
  if (
    asset.kind !== "audio" ||
    asset.variantGroupId !== `builtin-audio:${entry.id}`
  )
    throw new Error("This file does not match the requested catalog sound.");
  const placement = catalogAudioPlacement(
    entry,
    action.insert,
    project.duration
  );
  if (!placement) return project;
  return recordChatEdit(
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
  );
}
