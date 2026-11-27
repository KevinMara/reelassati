import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  CATALOG_CHUNK_BYTES,
  normalizeSharedCatalogItem,
  type CatalogObject,
} from "../contracts/shared-media-catalog";
import type { CatalogVisualObservation } from "../contracts/catalog-evidence";
import { catalogContentSearchText } from "./catalog-evidence";
import type { CatalogEnvironment } from "./shared-media-catalog";
import release from "./bundled-stock.json";

const entries = release.map(record => ({
  item: normalizeSharedCatalogItem(record.item),
  observation: record.visual as CatalogVisualObservation,
}));
export const includedVisuals = new Map(
  entries.map(({ observation }) => [observation.mediaSha256, observation])
);
const includedObjects = new Set(
  entries.flatMap(({ item }) => [item.media.sha256, item.poster?.sha256])
);
const revision = bytesToHex(
  sha256(new TextEncoder().encode(JSON.stringify(release)))
);
const releaseOrigin = "https://studio.invalid/stock-release/";

/** Content-addressed binaries live on our frontend CDN. Review packets and the release marker ship with the Worker. */
export async function releaseAsset(
  env: CatalogEnvironment,
  file: string,
  signal?: AbortSignal
) {
  const response = /^[0-9a-f]{64}\.\d+\.bin$/.test(file)
    ? await fetch("https://www.reelassati.app/stock-release/" + file, {
        signal,
        redirect: "manual",
      })
    : await env.ASSETS!.fetch(new Request(releaseOrigin + file, { signal }));
  if (
    !response.ok ||
    response.headers.get("content-type")?.includes("text/html")
  ) {
    await response.body?.cancel();
    throw new Error("The included stock file is unavailable in this build.");
  }
  return response;
}

export async function indexBundledStock(env: CatalogEnvironment) {
  if (!env.ASSETS) return;
  // A preview can serve a different static tree from the Worker. Only publish
  // the index when that tree identifies the matching collection.
  const marker = await env.ASSETS.fetch(
    new Request(releaseOrigin + "revision.txt")
  );
  if (
    !marker.ok ||
    marker.headers.get("content-type")?.includes("text/html") ||
    Number(marker.headers.get("content-length") || 0) > 128
  ) {
    await marker.body?.cancel();
    return;
  }
  if ((await marker.text()).trim() !== revision) return;
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS shared_catalog_releases (revision TEXT PRIMARY KEY)"
  ).run();
  if (
    await env.DB.prepare(
      "SELECT revision FROM shared_catalog_releases WHERE revision=?"
    )
      .bind(revision)
      .first()
  )
    return;
  for (let start = 0; start < entries.length; start += 20) {
    const statements = entries
      .slice(start, start + 20)
      .flatMap(({ item, observation }) => [
        env.DB.prepare(
          "INSERT INTO shared_media_catalog(id,name,group_name,design_id,kind,search_text,payload,media_ready,poster_ready,status,created_at) VALUES(?,?,?,?,?,?,?,1,1,'ready',CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET search_text=excluded.search_text,media_ready=1,poster_ready=1,status='ready' WHERE shared_media_catalog.payload=excluded.payload"
        ).bind(
          item.id,
          item.name,
          item.group,
          item.designId,
          item.kind,
          catalogContentSearchText(item, undefined, observation),
          JSON.stringify(item)
        ),
        env.DB.prepare(
          "INSERT INTO shared_catalog_evidence(id,media_sha,sample_sha,evidence_ready) SELECT id,?,?,1 FROM shared_media_catalog WHERE id=? AND json_extract(payload,'$.media.sha256')=? ON CONFLICT(id) DO NOTHING"
        ).bind(
          item.media.sha256,
          observation.sampleSha256,
          item.id,
          item.media.sha256
        ),
        env.DB.prepare(
          "INSERT INTO shared_catalog_visual_reviews(id,media_sha,sample_sha) SELECT id,media_sha,sample_sha FROM shared_catalog_evidence WHERE id=? AND media_sha=? AND sample_sha=? ON CONFLICT(id) DO NOTHING"
        ).bind(item.id, item.media.sha256, observation.sampleSha256),
      ]);
    await env.DB.batch(statements);
  }
  await env.DB.prepare(
    "INSERT OR IGNORE INTO shared_catalog_releases(revision) VALUES(?)"
  )
    .bind(revision)
    .run();
}

declare const FixedLengthStream: new (
  length: number
) => TransformStream<Uint8Array, Uint8Array>;
const transfers = new WeakMap<
  CatalogEnvironment["BUCKET"],
  Map<string, Promise<void>>
>();

/** Install immutable, build-owned content into the normal verified object store on first use. */
export async function materializeBundledObject(
  env: CatalogEnvironment,
  object: CatalogObject
) {
  if (!env.ASSETS || !includedObjects.has(object.sha256)) return false;
  const active = transfers.get(env.BUCKET) ?? new Map<string, Promise<void>>();
  transfers.set(env.BUCKET, active);
  let transfer = active.get(object.sha256);
  if (!transfer) {
    transfer = storeParts(env, object).finally(() =>
      active.delete(object.sha256)
    );
    active.set(object.sha256, transfer);
  }
  await transfer;
  return true;
}

async function storeParts(env: CatalogEnvironment, object: CatalogObject) {
  let position = 0;
  const digest = sha256.create();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const index = Math.floor(position / CATALOG_CHUNK_BYTES);
      const source = await releaseAsset(
        env,
        object.sha256 + "." + index + ".bin"
      );
      const bytes = new Uint8Array(await source.arrayBuffer());
      if (
        bytes.length !== Math.min(CATALOG_CHUNK_BYTES, object.bytes - position)
      )
        throw new Error("Incomplete stock part.");
      position += bytes.length;
      digest.update(bytes);
      // Validate before releasing the final bytes to R2. Failed streams do not commit an object.
      if (
        position === object.bytes &&
        bytesToHex(digest.digest()) !== object.sha256
      )
        throw new Error("Stock file digest mismatch.");
      controller.enqueue(bytes);
      if (position === object.bytes) controller.close();
    },
  });
  await env.BUCKET.put(
    "shared-catalog/" + object.file,
    stream.pipeThrough(new FixedLengthStream(object.bytes)),
    {
      httpMetadata: { contentType: object.contentType },
      customMetadata: { sha256: object.sha256, bytes: String(object.bytes) },
    }
  );
}
