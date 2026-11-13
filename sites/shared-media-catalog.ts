import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { EditProject } from "../contracts/workspace";
import { sourceReviewFacts } from "../contracts/source-review";
import { uploadCatalogEvidence } from "./catalog-evidence";
import {
  normalizeSharedCatalogItem,
  CATALOG_CHUNK_BYTES,
  CATALOG_SINGLE_REQUEST_MAX_BYTES,
  catalogChunkLength,
  type SharedMediaCatalogItem,
  type SharedMediaCatalogPage,
  type CatalogObject,
} from "../contracts/shared-media-catalog";

// R2 accepts only streams whose length the Workers runtime can identify.
// A hashing TransformStream loses the request body's fixed-length identity.
declare const FixedLengthStream: new (
  length: number
) => TransformStream<Uint8Array, Uint8Array>;

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
const chunkKey = (object: CatalogObject, index: number) =>
  `shared-catalog-parts/${object.sha256}/${index}`;

/** Read one staged part at a time. Final publication still checks the full
 * object SHA256; neither a part nor its metadata can make an item public. */
export function catalogChunkStream(
  env: CatalogEnvironment,
  object: CatalogObject,
  signal: AbortSignal
): ReadableStream<Uint8Array> {
  let index = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let received = 0;
  let activeController: ReadableStreamDefaultController<Uint8Array>;
  const detach = () => signal.removeEventListener("abort", abort);
  const abort = () => {
    void reader?.cancel(signal.reason).catch(() => undefined);
    detach();
    activeController.error(signal.reason);
  };
  return new ReadableStream<Uint8Array>({
    start(controller) {
      activeController = controller;
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    },
    async pull(controller) {
      try {
        while (true) {
          signal.throwIfAborted();
          if (!reader) {
            if (index >= Math.ceil(object.bytes / CATALOG_CHUNK_BYTES)) {
              detach();
              controller.close();
              return;
            }
            const part = await env.BUCKET.get(chunkKey(object, index));
            if (
              !part ||
              part.size !== catalogChunkLength(object.bytes, index)
            ) {
              await part?.body.cancel();
              fail(
                "A catalog part is missing or incomplete. Resume the import.",
                409
              );
            }
            reader = part.body.getReader();
            received = 0;
          }
          const next = await reader.read();
          signal.throwIfAborted();
          if (next.done) {
            if (received !== catalogChunkLength(object.bytes, index))
              fail("A catalog part is incomplete. Resume the import.", 409);
            reader.releaseLock();
            reader = undefined;
            index++;
          } else {
            received += next.value.byteLength;
            if (received > catalogChunkLength(object.bytes, index))
              fail("Catalog part exceeds its declared size.");
            controller.enqueue(next.value);
            return;
          }
        }
      } catch (error) {
        detach();
        await reader?.cancel(error).catch(() => undefined);
        reader = undefined;
        controller.error(error);
      }
    },
    async cancel(reason) {
      detach();
      await reader?.cancel(reason);
    },
  });
}
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
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS shared_catalog_candidate_scan ON shared_media_catalog(status, kind, id)"
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS shared_catalog_evidence (id TEXT PRIMARY KEY NOT NULL, media_sha TEXT NOT NULL, sample_sha TEXT NOT NULL DEFAULT '', evidence_ready INTEGER NOT NULL DEFAULT 0, sound_reviewed INTEGER NOT NULL DEFAULT 0)"
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS shared_catalog_sound_leases (id TEXT PRIMARY KEY NOT NULL, lease_id TEXT NOT NULL, expires_at INTEGER NOT NULL)"
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS shared_catalog_visual_reviews (id TEXT PRIMARY KEY NOT NULL, media_sha TEXT NOT NULL, sample_sha TEXT NOT NULL)"
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS shared_catalog_visual_leases (id TEXT PRIMARY KEY NOT NULL, lease_id TEXT NOT NULL, expires_at INTEGER NOT NULL)"
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
export interface CatalogCandidateContext {
  sourceText: string[];
  styleText: string[];
  aspectRatio: string;
}

/** Source observations rank candidates; they never establish events inside
 * retrieved material. Editing boilerplate and recommendations are not facts. */
export function catalogCandidateContext(
  project: EditProject
): CatalogCandidateContext {
  return {
    sourceText: [
      ...(project.sourceReviews ?? []).flatMap(review => {
        const facts = sourceReviewFacts(review);
        return (facts.observations ?? []).flatMap(observation => [
          observation.visualEvidence,
          observation.audioEvidence,
        ]);
      }),
      ...project.transcript.map(segment => segment.text),
    ],
    styleText: [
      project.referenceStyleBrief ?? "",
      project.editStyleTemplate?.name ?? "",
      JSON.stringify(project.editStyleTemplate?.profile ?? {}),
    ],
    aspectRatio: project.aspectRatio,
  };
}

// Generic direction must not turn "style" into forty Lifestyle looks.
const retrievalStopWords = new Set(
  "the and for with from this that these those into onto than then when where which what have has had are was were will would should could can not only also all any each every your their its our you they them use using used choose actual complete edit editing editor autonomous automatic style treatment footage source speech audience video image audio media clip clips sound color look looks motion visual visuals graphic graphics stock catalog supporting available existing supplied selected requested reference purpose result scene scenes beat beats timing timeline seconds content evidence observed request instruction parameters preserve keep make add apply build finish finished language name kind type true false null unknown none sourceIn sourceOut inPoint outPoint"
    .toLowerCase()
    .split(/\s+/)
);

function candidateTerms(prompt: string, context?: CatalogCandidateContext) {
  const weights = new Map<string, number>();
  const add = (text: string, weight: number) => {
    for (const term of text
      .normalize("NFKC")
      .toLowerCase()
      .match(/[\p{L}\p{N}]{3,}/gu) ?? [])
      if (
        term.length <= 60 &&
        !retrievalStopWords.has(term) &&
        !/^\d+$/.test(term)
      )
        weights.set(term, Math.max(weight, weights.get(term) ?? 0));
  };
  for (const text of context?.styleText ?? []) add(text, 8);
  for (const text of context?.sourceText ?? []) add(text, 4);
  add(prompt, 1);
  // Keep the SQL ranking payload bounded for long-form sources, after ranking
  // source/style evidence above generic commands rather than truncating a prefix.
  return [...weights]
    .map(([term, weight]) => ({ term, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 96);
}

/** One suitable variant per design, relevant groups first and diverse groups
 * on ties. These are bounded planning candidates, never an edit shot quota. */
async function sharedCatalogKindCandidates(
  env: CatalogEnvironment,
  prompt: string,
  kind: "audio" | "image" | "video" | "lut",
  context?: CatalogCandidateContext,
  signal?: AbortSignal
) {
  const [width, height] = (context?.aspectRatio ?? "16:9")
    .split(":")
    .map(Number);
  const ratio = width > 0 && height > 0 ? width / height : 16 / 9;
  const explicitText = [prompt, ...(context?.styleText ?? [])]
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
  // D1 must not evaluate correlated JSON subqueries for every catalog row
  // through several window functions. At full catalog size that path fails
  // before planning. Read indexed keyset pages and rank compact records once.
  type Candidate = {
    id: string;
    name: string;
    group_name: string;
    design_id: string;
    search_text: string;
    width: number | null;
    height: number | null;
    intent: number;
    relevance: number;
    groupPosition: number;
  };
  const terms = new Map(
    candidateTerms(prompt, context).map(({ term, weight }) => [term, weight])
  );
  const designs = new Map<string, Candidate>();
  const lexical = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const relevanceOrder = (a: Candidate, b: Candidate) =>
    b.intent - a.intent || b.relevance - a.relevance;
  const aspectDistance = (row: Candidate) =>
    Math.abs(
      (row.width && row.height ? row.width / row.height : ratio) - ratio
    );
  const sizeDistance = (row: Candidate) =>
    Math.abs(
      (row.width && row.height ? row.width * row.height : 2073600) - 2073600
    );
  const variantOrder = (a: Candidate, b: Candidate) =>
    relevanceOrder(a, b) ||
    aspectDistance(a) - aspectDistance(b) ||
    sizeDistance(a) - sizeDistance(b) ||
    lexical(a.id, b.id);
  let after = "";
  for (;;) {
    signal?.throwIfAborted();
    const page = await env.DB.prepare(
      `SELECT id,name,group_name,design_id,search_text,
      json_extract(payload, '$.width') AS width, json_extract(payload, '$.height') AS height
      FROM shared_media_catalog WHERE status = 'ready' AND kind = ? AND id > ? ORDER BY id LIMIT 500`
    )
      .bind(kind, after)
      .all<Candidate>();
    for (const row of page.results) {
      let maximum = 0,
        sum = 0;
      for (const token of new Set(
        row.search_text
          .normalize("NFKC")
          .toLowerCase()
          .match(/[\p{L}\p{N}]{3,}/gu) ?? []
      )) {
        const weight = terms.get(token) ?? 0;
        maximum = Math.max(maximum, weight);
        sum += weight;
      }
      const named =
        row.name.length >= 4 && explicitText.includes(row.name.toLowerCase());
      const grouped =
        row.group_name.length >= 4 &&
        explicitText.includes(row.group_name.toLowerCase());
      row.intent = Math.max(maximum, named || grouped ? 16 : 0);
      row.relevance = sum + (named ? 200 : 0) + (grouped ? 100 : 0);
      const existing = designs.get(row.design_id);
      if (!existing || variantOrder(row, existing) < 0)
        designs.set(row.design_id, row);
    }
    if (page.results.length < 500) break;
    after = page.results[page.results.length - 1].id;
  }
  const ranked = [...designs.values()].sort(
    (a, b) =>
      relevanceOrder(a, b) || lexical(a.name, b.name) || lexical(a.id, b.id)
  );
  const positions = new Map<string, number>();
  for (const row of ranked) {
    row.groupPosition = (positions.get(row.group_name) ?? 0) + 1;
    positions.set(row.group_name, row.groupPosition);
  }
  const selected = ranked
    .sort(
      (a, b) =>
        b.intent - a.intent ||
        a.groupPosition - b.groupPosition ||
        b.relevance - a.relevance ||
        lexical(a.group_name, b.group_name) ||
        lexical(a.name, b.name) ||
        lexical(a.id, b.id)
    )
    .slice(0, 60);
  const records = new Map<string, SharedMediaCatalogItem>();
  for (let offset = 0; offset < selected.length; offset += 50) {
    signal?.throwIfAborted();
    const ids = selected.slice(offset, offset + 50).map(row => row.id);
    const batch = await env.DB.prepare(
      `SELECT payload FROM shared_media_catalog WHERE status = 'ready' AND id IN (${ids.map(() => "?").join(",")})`
    )
      .bind(...ids)
      .all<{ payload: string }>();
    for (const row of batch.results) {
      const item = normalizeSharedCatalogItem(JSON.parse(row.payload));
      records.set(item.id, item);
    }
  }
  return selected.flatMap(row =>
    records.has(row.id) ? [records.get(row.id)!] : []
  );
}
export async function sharedCatalogCandidates(
  env: CatalogEnvironment,
  prompt: string,
  appliedLookIds: string[] = [],
  context?: CatalogCandidateContext,
  signal?: AbortSignal
) {
  const [videos, images, sounds, looks] = await Promise.all([
    sharedCatalogKindCandidates(env, prompt, "video", context, signal),
    sharedCatalogKindCandidates(env, prompt, "image", context, signal),
    sharedCatalogKindCandidates(env, prompt, "audio", context, signal),
    sharedCatalogKindCandidates(env, prompt, "lut", context, signal),
  ]);
  // Balance available kinds, then spend spare capacity on nonempty pools.
  const media: SharedMediaCatalogItem[] = [];
  for (let index = 0; media.length < 60 && index < 60; index++)
    for (const pool of [videos, images, sounds])
      if (pool[index] && media.length < 60) media.push(pool[index]);
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
    url.pathname === "/api/catalog/admin/evidence" &&
    request.method === "POST"
  )
    return uploadCatalogEvidence(request, env);
  if (
    url.pathname === "/api/catalog/admin/evidence-status" &&
    request.method === "GET"
  ) {
    const ids = [
      ...new Set(
        (url.searchParams.get("ids") || "").split(",").filter(Boolean)
      ),
    ];
    if (ids.length > 50 || ids.some(id => !/^stock-[a-f0-9]{24}$/.test(id)))
      fail("Choose up to 50 valid catalog IDs.");
    const rows = ids.length
      ? (
          await env.DB.prepare(
            `SELECT e.id,e.evidence_ready,e.sound_reviewed,
              CASE WHEN v.id IS NOT NULL THEN 1 ELSE 0 END AS visual_reviewed
              FROM shared_catalog_evidence e LEFT JOIN shared_catalog_visual_reviews v
              ON v.id=e.id AND v.media_sha=e.media_sha AND v.sample_sha=e.sample_sha
              WHERE e.id IN (${ids.map(() => "?").join(",")})`
          )
            .bind(...ids)
            .all<{
              id: string;
              evidence_ready: number;
              sound_reviewed: number;
              visual_reviewed: number;
            }>()
        ).results
      : [];
    const found = new Map(rows.map(r => [r.id, r]));
    return response({
      items: ids.map(id => ({
        id,
        ready: found.get(id)?.evidence_ready === 1,
        soundReviewed: found.get(id)?.sound_reviewed === 1,
        visualReviewed: found.get(id)?.visual_reviewed === 1,
      })),
    });
  }
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
    const rows = ids.length
      ? (
          await env.DB.prepare(
            `SELECT id, status, media_ready, poster_ready FROM shared_media_catalog WHERE id IN (${ids.map(() => "?").join(",")})`
          )
            .bind(...ids)
            .all<Row>()
        ).results
      : [];
    const byId = new Map(rows.map(row => [row.id, row]));
    const items = ids.map(id => {
      const row = byId.get(id);
      return {
        id,
        status: row?.status || "missing",
        missingObjects: row
          ? [
              ...(row.media_ready ? [] : ["media"]),
              ...(row.poster_ready ? [] : ["poster"]),
            ]
          : ["media", "poster"],
      };
    });
    return response({ items });
  }
  if (
    url.pathname === "/api/catalog/admin/manifest" &&
    request.method === "POST"
  ) {
    const items = await boundedManifest(request);
    if (new Set(items.map(item => item.id)).size !== items.length)
      fail("Catalog IDs must be unique.");
    const storedRows = await env.DB.prepare(
      `SELECT id, payload FROM shared_media_catalog WHERE id IN (${items.map(() => "?").join(",")})`
    )
      .bind(...items.map(item => item.id))
      .all<{ id: string; payload: string }>();
    const storedById = new Map(storedRows.results.map(row => [row.id, row]));
    for (const item of items) {
      const existing = storedById.get(item.id);
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
    // Batch database reads and overlap only three small object checks. A 50-item
    // import must not incur 150 sequential network round trips. Publication is
    // still one atomic DB batch, after all immutable metadata has been checked.
    const readiness = new Map<
      string,
      { mediaReady: boolean; posterReady: boolean }
    >();
    for (let offset = 0; offset < items.length; offset += 3) {
      request.signal.throwIfAborted();
      await Promise.all(
        items.slice(offset, offset + 3).map(async item => {
          const mediaReady = await verifyStoredObject(env, item.media);
          const posterReady =
            !item.poster || (await verifyStoredObject(env, item.poster));
          readiness.set(item.id, { mediaReady, posterReady });
        })
      );
    }
    request.signal.throwIfAborted();
    const statements = [];
    for (const item of items) {
      const { mediaReady, posterReady } = readiness.get(item.id)!;
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
    /^\/api\/catalog\/admin\/object\/(stock-[a-f0-9]{24})\/(media|poster)(?:\/(chunks\/\d+|complete))?$/
  );
  if (
    match &&
    ((request.method === "PUT" && match[3] !== "complete") ||
      (request.method === "POST" && match[3] === "complete"))
  ) {
    const { item } = await readSharedCatalog(env, match[1], false);
    const role = match[2] as "media" | "poster",
      object = item[role];
    if (!object) fail("This catalog object is not expected.");
    if (match[3]?.startsWith("chunks/")) {
      const index = Number(match[3].slice(7));
      let expected: number;
      try {
        expected = catalogChunkLength(object.bytes, index);
      } catch {
        fail("This catalog chunk is not expected.");
      }
      if (
        !request.body ||
        (request.headers.has("content-length") &&
          Number(request.headers.get("content-length")) !== expected)
      )
        fail("Catalog part size does not match its manifest.");
      // FixedLengthStream enforces the exact size while streaming into private
      // staging. Publication requires the full-file hash in /complete.
      await env.BUCKET.put(
        chunkKey(object, index),
        request.body.pipeThrough(new FixedLengthStream(expected))
      );
      request.signal.throwIfAborted();
      return response({ id: item.id, role, part: index, staged: true });
    }
    const chunked = match[3] === "complete";
    if (
      !chunked &&
      (!request.body || object.bytes > CATALOG_SINGLE_REQUEST_MAX_BYTES)
    )
      fail("Use chunked import for this catalog object.", 413);
    if (await verifyStoredObject(env, object)) {
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
    }
    const declared = Number(request.headers.get("content-length"));
    if (
      !chunked &&
      request.headers.has("content-length") &&
      declared !== object.bytes
    )
      fail("Catalog file size does not match its manifest.");
    const temp = `shared-catalog-pending/${crypto.randomUUID()}`;
    const hash = sha256.create();
    let bytes = 0;
    const verified = (
      chunked ? catalogChunkStream(env, object, request.signal) : request.body!
    )
      .pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            bytes += chunk.byteLength;
            if (bytes > object.bytes)
              throw new Error("Catalog upload exceeds declared size.");
            hash.update(chunk);
            controller.enqueue(chunk);
          },
        })
      )
      .pipeThrough(new FixedLengthStream(object.bytes));
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
      if (chunked)
        for (
          let index = 0;
          index < Math.ceil(object.bytes / CATALOG_CHUNK_BYTES);
          index++
        )
          await env.BUCKET.delete(chunkKey(object, index));
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
