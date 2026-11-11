import { sha256 } from "@noble/hashes/sha2.js";
import {
  normalizeSharedCatalogItem,
  type CatalogObject,
  type SharedMediaCatalogItem,
  type SharedMediaCatalogManifest,
} from "@contracts/shared-media-catalog";

export type CatalogImportProblem = "manifest" | "files" | "digest" | "server";
export class CatalogImportError extends Error {
  readonly problem: CatalogImportProblem;
  readonly detail: string;
  constructor(problem: CatalogImportProblem, detail = "") {
    super(detail || problem);
    this.problem = problem;
    this.detail = detail;
  }
}
export interface CatalogAdminStatus {
  items: Array<{
    id: string;
    status: "ready" | "pending" | "missing";
    missingObjects: Array<"media" | "poster">;
  }>;
}
export interface PreparedCatalogImport {
  manifest: SharedMediaCatalogManifest;
  files: Map<string, File>;
  totalBytes: number;
  objectCount: number;
}
export interface CatalogImportProgress {
  stage: "checking" | "verifying" | "uploading" | "complete";
  completedItems: number;
  totalItems: number;
  alreadyReady: number;
  uploadedObjects: number;
  uploadedBytes: number;
  currentName?: string;
  verifiedBytes?: number;
  currentBytes?: number;
}
export interface CatalogImportApi {
  status(ids: string[]): Promise<CatalogAdminStatus>;
  manifest(manifest: SharedMediaCatalogManifest): Promise<unknown>;
  object(
    id: string,
    role: "media" | "poster",
    file: File,
    metadata: CatalogObject
  ): Promise<unknown>;
}

/** Inspect the prepared public manifest and file identities before any writes.
 * Directory paths are never sent to the service. Only declared hashed files can
 * be transferred; extra private documents in the chosen folder are ignored. */
export async function prepareSharedCatalogImport(
  selected: readonly File[]
): Promise<PreparedCatalogImport> {
  const manifests = selected.filter(file => file.name === "catalog.json");
  if (manifests.length !== 1 || manifests[0].size > 8 * 1024 * 1024)
    throw new CatalogImportError("manifest");
  let raw: unknown;
  try {
    raw = JSON.parse(await manifests[0].text());
  } catch {
    throw new CatalogImportError("manifest");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new CatalogImportError("manifest");
  const row = raw as Record<string, unknown>;
  if (
    row.schemaVersion !== 1 ||
    !Array.isArray(row.items) ||
    !row.items.length ||
    row.items.length > 10000 ||
    Object.keys(row).some(key => !["schemaVersion", "items"].includes(key))
  )
    throw new CatalogImportError("manifest");
  let items: SharedMediaCatalogItem[];
  try {
    items = row.items.map(normalizeSharedCatalogItem);
  } catch {
    throw new CatalogImportError("manifest");
  }
  if (new Set(items.map(item => item.id)).size !== items.length)
    throw new CatalogImportError("manifest");
  const manifestPath = manifests[0].webkitRelativePath || manifests[0].name;
  const prefix = manifestPath.slice(0, manifestPath.lastIndexOf("/") + 1);
  const candidates = new Map<string, File[]>();
  for (const file of selected) {
    const path = file.webkitRelativePath || file.name;
    if (prefix && !path.startsWith(prefix)) continue;
    const relative = prefix ? path.slice(prefix.length) : path;
    if (relative.split("/").some(part => part === ".." || part === "."))
      throw new CatalogImportError("files", file.name);
    const key = relative.includes("/") ? relative : `media/${relative}`;
    candidates.set(key, [...(candidates.get(key) ?? []), file]);
  }
  const objects = new Map<string, CatalogObject>();
  for (const item of items)
    for (const object of [item.media, item.poster].filter(
      (value): value is CatalogObject => Boolean(value)
    )) {
      const previous = objects.get(object.file);
      if (
        previous &&
        (previous.bytes !== object.bytes ||
          previous.sha256 !== object.sha256 ||
          previous.contentType !== object.contentType)
      )
        throw new CatalogImportError("manifest");
      objects.set(object.file, object);
    }
  const files = new Map<string, File>();
  for (const object of objects.values()) {
    const matches = candidates.get(object.file) ?? [];
    if (matches.length !== 1 || matches[0].size !== object.bytes)
      throw new CatalogImportError("files", object.file);
    files.set(object.file, matches[0]);
  }
  return {
    manifest: { schemaVersion: 1, items },
    files,
    objectCount: objects.size,
    totalBytes: [...objects.values()].reduce(
      (sum, object) => sum + object.bytes,
      0
    ),
  };
}

/** Hash one MiB at a time, yielding through Blob reads. Large catalogs never
 * become one in-memory buffer and stopping is checked between each chunk. */
export async function verifyCatalogFile(
  file: File,
  object: CatalogObject,
  signal: AbortSignal,
  onBytes?: (bytes: number) => void
) {
  const digest = sha256.create();
  for (let offset = 0; offset < file.size; offset += 1024 * 1024) {
    signal.throwIfAborted();
    const bytes = new Uint8Array(
      await file.slice(offset, offset + 1024 * 1024).arrayBuffer()
    );
    signal.throwIfAborted();
    digest.update(bytes);
    onBytes?.(Math.min(file.size, offset + bytes.byteLength));
  }
  const actual = Array.from(digest.digest(), value =>
    value.toString(16).padStart(2, "0")
  ).join("");
  if (file.size !== object.bytes || actual !== object.sha256)
    throw new CatalogImportError("digest", object.file);
}

/** One explicitly started, foreground import. No retries, timers, model calls or
 * persistent queues. Each new run asks the server what is still missing. */
export async function runSharedCatalogImport(
  prepared: PreparedCatalogImport,
  api: CatalogImportApi,
  signal: AbortSignal,
  onProgress: (progress: CatalogImportProgress) => void
) {
  const state: CatalogImportProgress = {
    stage: "checking",
    totalItems: prepared.manifest.items.length,
    completedItems: 0,
    alreadyReady: 0,
    uploadedObjects: 0,
    uploadedBytes: 0,
  };
  const emit = () => onProgress({ ...state });
  const checked = new Set<string>();
  const statuses = async (items: SharedMediaCatalogItem[]) => {
    signal.throwIfAborted();
    const response = await api.status(items.map(item => item.id));
    signal.throwIfAborted();
    if (
      !response ||
      !Array.isArray(response.items) ||
      response.items.length !== items.length
    )
      throw new CatalogImportError("server");
    const byId = new Map(response.items.map(item => [item.id, item]));
    if (byId.size !== items.length || items.some(item => !byId.has(item.id)))
      throw new CatalogImportError("server");
    for (const item of byId.values())
      if (
        !["ready", "pending", "missing"].includes(item.status) ||
        !Array.isArray(item.missingObjects) ||
        item.missingObjects.some(role => !["media", "poster"].includes(role)) ||
        new Set(item.missingObjects).size !== item.missingObjects.length ||
        (item.status === "ready" && item.missingObjects.length)
      )
        throw new CatalogImportError("server");
    return byId;
  };
  emit();
  for (let offset = 0; offset < prepared.manifest.items.length; offset += 50) {
    const batch = prepared.manifest.items.slice(offset, offset + 50);
    state.stage = "checking";
    state.currentName = undefined;
    emit();
    const initial = await statuses(batch);
    const pending = batch.filter(
      item => initial.get(item.id)!.status !== "ready"
    );
    state.alreadyReady += batch.length - pending.length;
    state.completedItems += batch.length - pending.length;
    emit();
    if (!pending.length) continue;
    signal.throwIfAborted();
    await api.manifest({ schemaVersion: 1, items: pending });
    signal.throwIfAborted();
    const current = await statuses(pending);
    let next = 0;
    let failed = false;
    let failure: unknown;
    const checkActive = () => {
      signal.throwIfAborted();
      if (failed) throw failure;
    };
    const uploadItem = async (item: SharedMediaCatalogItem) => {
      signal.throwIfAborted();
      for (const role of current.get(item.id)!.missingObjects) {
        const object = role === "media" ? item.media : item.poster;
        if (!object) throw new CatalogImportError("server", item.id);
        const file = prepared.files.get(object.file);
        if (!file) throw new CatalogImportError("files", object.file);
        state.currentName = item.name;
        state.currentBytes = object.bytes;
        if (!checked.has(object.sha256)) {
          state.stage = "verifying";
          state.verifiedBytes = 0;
          emit();
          await verifyCatalogFile(file, object, signal, bytes => {
            state.verifiedBytes = bytes;
            emit();
          });
          checked.add(object.sha256);
        }
        checkActive();
        state.stage = "uploading";
        emit();
        await api.object(item.id, role, file, object);
        checkActive();
        state.uploadedObjects++;
        state.uploadedBytes += object.bytes;
        emit();
      }
      checkActive();
      const verified = await statuses([item]);
      if (verified.get(item.id)!.status !== "ready")
        throw new CatalogImportError("server", item.name);
      state.completedItems++;
      emit();
    };
    // Four foreground streams overlap network latency while keeping hashing
    // bounded. A failure stops dispatch; all in-flight work settles before the
    // panel becomes idle. Nothing is queued beyond this explicitly started run.
    await Promise.all(
      Array.from({ length: Math.min(4, pending.length) }, async () => {
        while (!failed && next < pending.length) {
          const item = pending[next++];
          try {
            checkActive();
            await uploadItem(item);
          } catch (error) {
            if (!failed) {
              failed = true;
              failure = error;
            }
          }
        }
      })
    );
    if (failed) throw failure;
  }
  state.stage = "complete";
  state.currentName = undefined;
  emit();
  return state;
}
