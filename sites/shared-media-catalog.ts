import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  normalizeSharedCatalogItem,
  type SharedMediaCatalogItem,
  type SharedMediaCatalogPage,
  type CatalogObject,
} from "../contracts/shared-media-catalog";

type Statement = {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[]; success: boolean }>;
  run(): Promise<unknown>;
};
type StoredObject = {
  body: ReadableStream;
  size: number;
  httpEtag: string;
  customMetadata?: Record<string, string>;
};
export interface CatalogEnvironment {
  DB: {
    prepare(query: string): Statement;
    batch(statements: Statement[]): Promise<unknown>;
  };
  BUCKET: {
    put(
      key: string,
      data: ReadableStream | ArrayBuffer | Uint8Array,
      options?: {
        httpMetadata?: { contentType?: string };
        customMetadata?: Record<string, string>;
      }
    ): Promise<unknown>;
    get(
      key: string,
      options?: { range?: { offset: number; length?: number; suffix?: number } }
    ): Promise<StoredObject | null>;
    delete(key: string): Promise<void>;
  };
}
interface Row {
  id: string;
  payload: string;
  media_ready: number;
  poster_ready: number;
  status: "pending" | "ready";
}
const response = (value: unknown, status = 200) =>
  Response.json(value, { status });
function fail(message: string, status = 422): never {
  throw response({ error: message }, status);
}
const objectKey = (object: CatalogObject) => `shared-catalog/${object.file}`;
const catalogInitializations = new WeakMap<
  CatalogEnvironment["DB"],
  Promise<void>
>();
export function initializeSharedCatalog(env: CatalogEnvironment) {
  const existing = catalogInitializations.get(env.DB);
  if (existing) return existing;
  const pending = env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS shared_media_catalog (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, group_name TEXT NOT NULL, design_id TEXT NOT NULL, kind TEXT NOT NULL, search_text TEXT NOT NULL, payload TEXT NOT NULL, media_ready INTEGER NOT NULL DEFAULT 0, poster_ready INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL)`
    ),
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS shared_catalog_search ON shared_media_catalog(status, kind, group_name, name, id)"
    ),
  ])
    .then(() => undefined)
    .catch(error => {
      catalogInitializations.delete(env.DB);
      throw error;
    });
  catalogInitializations.set(env.DB, pending);
  return pending;
}
export async function readSharedCatalog(
  env: CatalogEnvironment,
  id: string,
  ready = true
) {
  if (!/^stock-[a-f0-9]{24}$/.test(id)) fail("Invalid catalog identity.");
  const row = await env.DB.prepare(
    `SELECT * FROM shared_media_catalog WHERE id = ?${ready ? " AND status = 'ready'" : ""}`
  )
    .bind(id)
    .first<Row>();
  if (!row) fail("This catalog item is not available.", 404);
  return { row, item: normalizeSharedCatalogItem(JSON.parse(row.payload)) };
}
export async function searchSharedCatalog(
  env: CatalogEnvironment,
  options: {
    query?: string;
    kind?: string;
    group?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<SharedMediaCatalogPage> {
  const page = Math.max(1, Math.min(100000, Math.floor(options.page || 1)));
  const pageSize = Math.max(
    1,
    Math.min(60, Math.floor(options.pageSize || 24))
  );
  const conditions = ["status = 'ready'"],
    args: unknown[] = [];
  if (["audio", "video", "image", "lut"].includes(options.kind || "")) {
    conditions.push("kind = ?");
    args.push(options.kind);
  }
  if (options.kind === "media") conditions.push("kind != 'lut'");
  if (options.kind === "visual") conditions.push("kind IN ('video', 'image')");
  if (options.group?.trim()) {
    conditions.push("group_name = ?");
    args.push(options.group.trim().slice(0, 60));
  }
  // Literal substrings: wildcard characters never expand an owner's label into a broad SQL query.
  const words =
    (options.query || "")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu)
      ?.slice(0, 8) || [];
  for (const word of words) {
    conditions.push("instr(search_text, ?) > 0");
    args.push(word.slice(0, 60));
  }
  const where = conditions.join(" AND ");
  const rows = await env.DB.prepare(
    `SELECT payload FROM (SELECT payload, group_name, name, id, ROW_NUMBER() OVER (PARTITION BY design_id ORDER BY ABS(COALESCE(json_extract(payload, '$.width') * json_extract(payload, '$.height'), 2073600) - 2073600), id) AS position FROM shared_media_catalog WHERE ${where}) WHERE position = 1 ORDER BY group_name, name, id LIMIT ? OFFSET ?`
  )
    .bind(...args, pageSize, (page - 1) * pageSize)
    .all<{ payload: string }>();
  const count = await env.DB.prepare(
    `SELECT COUNT(DISTINCT design_id) AS total FROM shared_media_catalog WHERE ${where}`
  )
    .bind(...args)
    .first<{ total: number }>();
  const groupKind = ["audio", "video", "image", "lut"].includes(
    options.kind || ""
  )
    ? " AND kind = ?"
    : options.kind === "visual"
      ? " AND kind IN ('video', 'image')"
      : options.kind === "media"
        ? " AND kind != 'lut'"
        : "";
  const groupStatement = env.DB.prepare(
    `SELECT group_name AS name, COUNT(DISTINCT design_id) AS count FROM shared_media_catalog WHERE status = 'ready'${groupKind} GROUP BY group_name ORDER BY group_name`
  );
  const groups = await (
    groupKind.includes("?") ? groupStatement.bind(options.kind) : groupStatement
  ).all<{ name: string; count: number }>();
  const items = rows.results.map(row =>
    normalizeSharedCatalogItem(JSON.parse(row.payload))
  );
  const variants: Record<string, SharedMediaCatalogItem[]> =
    Object.create(null);
  if (items.length) {
    const all = await env.DB.prepare(
      `SELECT payload FROM shared_media_catalog WHERE status = 'ready' AND design_id IN (${items.map(() => "?").join(",")}) ORDER BY json_extract(payload, '$.width'), id`
    )
      .bind(...items.map(item => item.designId))
      .all<{ payload: string }>();
    for (const row of all.results) {
      const item = normalizeSharedCatalogItem(JSON.parse(row.payload));
      (variants[item.designId] ||= []).push(item);
    }
  }
  return {
    items,
    variants,
    total: count?.total || 0,
    page,
    pageSize,
    groups: groups.results,
  };
}
/** A bounded, diverse candidate set; only actually published records are proposed. */
async function sharedCatalogKindCandidates(
  env: CatalogEnvironment,
  prompt: string,
  kind: "media" | "lut"
) {
  const catalog = await searchSharedCatalog(env, {
    pageSize: 60,
    kind,
  });
  const terms = [
    ...new Set(prompt.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []),
  ].slice(0, 12);
  const conditions = terms.map(() => "instr(search_text, ?) > 0").join(" OR ");
  const relevance = terms
    .map(() => "CASE WHEN instr(search_text, ?) > 0 THEN 1 ELSE 0 END")
    .join(" + ");
  const kindCondition = kind === "lut" ? "kind = 'lut'" : "kind != 'lut'";
  const matches = terms.length
    ? await env.DB.prepare(
        `SELECT payload FROM shared_media_catalog WHERE status = 'ready' AND ${kindCondition} AND (${conditions}) ORDER BY (${relevance}) DESC, name LIMIT 40`
      )
        .bind(...terms, ...terms)
        .all<{ payload: string }>()
    : { results: [] };
  const grouped = await env.DB.prepare(
    `SELECT payload FROM (SELECT payload, ROW_NUMBER() OVER (PARTITION BY group_name ORDER BY name, id) AS position FROM shared_media_catalog WHERE status = 'ready' AND ${kindCondition}) WHERE position <= 2 LIMIT 40`
  ).all<{ payload: string }>();
  return [
    ...new Map(
      [
        ...matches.results,
        ...grouped.results,
        ...catalog.items.map(item => ({ payload: JSON.stringify(item) })),
      ].map(row => {
        const item = normalizeSharedCatalogItem(JSON.parse(row.payload));
        return [item.id, item] as const;
      })
    ).values(),
  ].slice(0, 60);
}
export async function sharedCatalogCandidates(
  env: CatalogEnvironment,
  prompt: string,
  appliedLookIds: string[] = []
) {
  const [media, looks] = await Promise.all([
    sharedCatalogKindCandidates(env, prompt, "media"),
    sharedCatalogKindCandidates(env, prompt, "lut"),
  ]);
  const known = new Map([...media, ...looks].map(item => [item.id, item]));
  const missing = [...new Set(appliedLookIds)].filter(
    id => /^stock-[a-f0-9]{24}$/.test(id) && !known.has(id)
  );
  // Existing manual selections stay available for intensity/reset instructions
  // even when the current command's retrieval terms do not rank that look.
  for (let offset = 0; offset < missing.length; offset += 50) {
    const ids = missing.slice(offset, offset + 50);
    const rows = await env.DB.prepare(
      `SELECT payload FROM shared_media_catalog WHERE status = 'ready' AND kind = 'lut' AND id IN (${ids.map(() => "?").join(",")})`
    )
      .bind(...ids)
      .all<{ payload: string }>();
    for (const row of rows.results) {
      const item = normalizeSharedCatalogItem(JSON.parse(row.payload));
      known.set(item.id, item);
    }
  }
  return [...known.values()];
}
async function boundedManifest(
  request: Request
): Promise<SharedMediaCatalogItem[]> {
  if (Number(request.headers.get("content-length") || 0) > 256 * 1024)
    fail("Catalog batches must be smaller than 256 KiB.", 413);
  const body = await request.text();
  if (body.length > 256 * 1024)
    fail("Catalog batches must be smaller than 256 KiB.", 413);
  let value: { schemaVersion?: unknown; items?: unknown };
  try {
    value = JSON.parse(body);
  } catch {
    fail("Invalid catalog manifest.");
  }
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value!.items) ||
    value!.items.length < 1 ||
    value!.items.length > 50 ||
    Object.keys(value!).some(key => !["schemaVersion", "items"].includes(key))
  )
    fail("Submit a manifest containing 1–50 public records.");
  try {
    return (value!.items as unknown[]).map(normalizeSharedCatalogItem);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Invalid catalog manifest.");
  }
}
async function verifyStoredObject(
  env: CatalogEnvironment,
  object: CatalogObject
) {
  const stored = await env.BUCKET.get(objectKey(object), {
    range: { offset: 0, length: 1 },
  });
  if (!stored) return false;
  const valid =
    stored.customMetadata?.sha256 === object.sha256 &&
    stored.customMetadata?.bytes === String(object.bytes);
  await stored.body.cancel();
  return valid;
}
export async function handleCatalogAdmin(
  request: Request,
  env: CatalogEnvironment,
  url: URL,
  owner: boolean
): Promise<Response> {
  if (!owner)
    return response(
      { error: "Only the studio owner can import shared media." },
      403
    );
  await initializeSharedCatalog(env);
  if (
    url.pathname === "/api/catalog/admin/status" &&
    request.method === "GET"
  ) {
    const ids = [
      ...new Set(
        (url.searchParams.get("ids") || "").split(",").filter(Boolean)
      ),
    ];
    if (ids.length > 50 || ids.some(id => !/^stock-[a-f0-9]{24}$/.test(id)))
      fail("Choose up to 50 valid catalog IDs.");
    const items = [];
    for (const id of ids) {
      const row = await env.DB.prepare(
        "SELECT * FROM shared_media_catalog WHERE id = ?"
      )
        .bind(id)
        .first<Row>();
      items.push({
        id,
        status: row?.status || "missing",
        missingObjects: row
          ? [
              ...(row.media_ready ? [] : ["media"]),
              ...(row.poster_ready ? [] : ["poster"]),
            ]
          : ["media", "poster"],
      });
    }
    return response({ items });
  }
  if (
    url.pathname === "/api/catalog/admin/manifest" &&
    request.method === "POST"
  ) {
    const items = await boundedManifest(request);
    if (new Set(items.map(item => item.id)).size !== items.length)
      fail("Catalog IDs must be unique.");
    for (const item of items) {
      const existing = await env.DB.prepare(
        "SELECT payload FROM shared_media_catalog WHERE id = ?"
      )
        .bind(item.id)
        .first<{ payload: string }>();
      if (
        existing &&
        JSON.stringify(
          normalizeSharedCatalogItem(JSON.parse(existing.payload))
        ) !== JSON.stringify(item)
      )
        fail(
          "An existing catalog ID has different metadata. Keep the original immutable.",
          409
        );
    }
    const statements = [];
    for (const item of items) {
      const mediaReady = await verifyStoredObject(env, item.media),
        posterReady =
          !item.poster || (await verifyStoredObject(env, item.poster));
      statements.push(
        env.DB.prepare(
          "INSERT INTO shared_media_catalog (id, name, group_name, design_id, kind, search_text, payload, media_ready, poster_ready, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET media_ready=excluded.media_ready, poster_ready=excluded.poster_ready, status=excluded.status"
        ).bind(
          item.id,
          item.name,
          item.group,
          item.designId,
          item.kind,
          [item.name, item.group, item.variant, ...item.tags]
            .join(" ")
            .toLowerCase(),
          JSON.stringify(item),
          Number(mediaReady),
          Number(posterReady),
          mediaReady && posterReady ? "ready" : "pending",
          new Date().toISOString()
        )
      );
    }
    await env.DB.batch(statements);
    return response({ accepted: items.length });
  }
  const match = url.pathname.match(
    /^\/api\/catalog\/admin\/object\/(stock-[a-f0-9]{24})\/(media|poster)$/
  );
  if (match && request.method === "PUT") {
    const { item } = await readSharedCatalog(env, match[1], false);
    const role = match[2] as "media" | "poster",
      object = item[role];
    if (!object || !request.body) fail("This catalog object is not expected.");
    const declared = Number(request.headers.get("content-length"));
    if (request.headers.has("content-length") && declared !== object.bytes)
      fail("Catalog file size does not match its manifest.");
    const temp = `shared-catalog-pending/${crypto.randomUUID()}`;
    const hash = sha256.create();
    let bytes = 0;
    const verified = request.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          bytes += chunk.byteLength;
          if (bytes > object.bytes)
            throw new Error("Catalog upload exceeds declared size.");
          hash.update(chunk);
          controller.enqueue(chunk);
        },
      })
    );
    try {
      await env.BUCKET.put(temp, verified, {
        httpMetadata: { contentType: object.contentType },
      });
      request.signal.throwIfAborted();
      if (bytes !== object.bytes || bytesToHex(hash.digest()) !== object.sha256)
        fail(
          "Catalog bytes do not match the manifest. The item was not published."
        );
      const source = await env.BUCKET.get(temp);
      if (!source) fail("Staged catalog upload was not found.", 502);
      await env.BUCKET.put(objectKey(object), source.body, {
        httpMetadata: { contentType: object.contentType },
        customMetadata: { sha256: object.sha256, bytes: String(object.bytes) },
      });
      const column = role === "media" ? "media_ready" : "poster_ready";
      await env.DB.prepare(
        `UPDATE shared_media_catalog SET ${column} = 1 WHERE id = ?`
      )
        .bind(item.id)
        .run();
      await env.DB.prepare(
        "UPDATE shared_media_catalog SET status = 'ready' WHERE id = ? AND media_ready = 1 AND poster_ready = 1"
      )
        .bind(item.id)
        .run();
      return response({ id: item.id, role, verified: true });
    } finally {
      await env.BUCKET.delete(temp);
    }
  }
  return response({ error: "Catalog import route not found." }, 404);
}
export async function handleCatalogPublic(
  request: Request,
  env: CatalogEnvironment,
  url: URL
): Promise<Response> {
  if (!["GET", "HEAD"].includes(request.method))
    return response({ error: "Method not allowed." }, 405);
  await initializeSharedCatalog(env);
  if (url.pathname === "/api/catalog/search")
    return response(
      await searchSharedCatalog(env, {
        query: url.searchParams.get("q") || "",
        kind: url.searchParams.get("kind") || "",
        group: url.searchParams.get("group") || "",
        page: Number(url.searchParams.get("page")),
        pageSize: Number(url.searchParams.get("pageSize")),
      })
    );
  const itemMatch = url.pathname.match(
    /^\/api\/catalog\/items\/(stock-[a-f0-9]{24})$/
  );
  if (itemMatch)
    return response((await readSharedCatalog(env, itemMatch[1])).item);
  const match = url.pathname.match(
    /^\/api\/catalog\/media\/(stock-[a-f0-9]{24})\/(media|poster)$/
  );
  if (!match) return response({ error: "Catalog route not found." }, 404);
  const { item } = await readSharedCatalog(env, match[1]);
  const object = item[match[2] as "media" | "poster"];
  if (!object) return response({ error: "Catalog object not found." }, 404);
  const rangeHeader = request.headers.get("range");
  let start = 0,
    end = object.bytes - 1,
    partial = false;
  if (rangeHeader) {
    const range = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    if (!range || (!range[1] && !range[2]))
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${object.bytes}` },
      });
    start = range[1]
      ? Number(range[1])
      : Math.max(0, object.bytes - Number(range[2]));
    end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start > end ||
      start >= object.bytes
    )
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${object.bytes}` },
      });
    partial = true;
  }
  const headers = new Headers({
    "Content-Type": object.contentType,
    "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: `"${object.sha256}"`,
    "X-Content-Type-Options": "nosniff",
  });
  if (partial)
    headers.set("Content-Range", `bytes ${start}-${end}/${object.bytes}`);
  if (request.method === "HEAD")
    return new Response(null, { status: partial ? 206 : 200, headers });
  const stored = await env.BUCKET.get(
    objectKey(object),
    partial ? { range: { offset: start, length: end - start + 1 } } : undefined
  );
  if (!stored)
    return response(
      { error: "Catalog object is temporarily unavailable." },
      503
    );
  return new Response(stored.body, { status: partial ? 206 : 200, headers });
}
export async function copySharedCatalogMedia(
  env: CatalogEnvironment,
  id: string,
  key: string,
  signal: AbortSignal
) {
  const { item } = await readSharedCatalog(env, id);
  if (item.kind === "lut")
    fail("Apply this color LUT through the color controls.");
  const source = await env.BUCKET.get(objectKey(item.media));
  if (!source || source.customMetadata?.sha256 !== item.media.sha256)
    fail("Catalog object is temporarily unavailable.", 503);
  signal.throwIfAborted();
  await env.BUCKET.put(key, source.body, {
    httpMetadata: { contentType: item.media.contentType },
    customMetadata: { catalogId: item.id, sha256: item.media.sha256 },
  });
  return item as SharedMediaCatalogItem & { kind: "audio" | "video" | "image" };
}
