import {
  createEmptyWorkspace,
  type Asset,
  type CapabilityState,
  type EditOperation,
  type GenerationJob,
  type Platform,
  type PublishingAccount,
  type ScheduledPost,
  type ScriptDraft,
  type WorkspaceDocument,
  type WorkspaceEvent,
} from "../contracts/workspace";

type AssetBinding = {
  fetch(request: Request): Promise<Response>;
};

type D1Result = {
  success: boolean;
  meta?: { last_row_id?: number; changes?: number };
};

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{
    results: T[];
    success: boolean;
  }>;
  run(): Promise<D1Result>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
};

type R2ObjectBody = {
  body: ReadableStream;
  size: number;
  etag: string;
  httpEtag: string;
  httpMetadata?: { contentType?: string };
  arrayBuffer(): Promise<ArrayBuffer>;
};

type R2Bucket = {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | Uint8Array,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    }
  ): Promise<unknown>;
  get(
    key: string,
    options?: { range?: { offset: number; length?: number; suffix?: number } }
  ): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
};

type SitesEnvironment = {
  ASSETS: AssetBinding;
  DB: D1Database;
  BUCKET: R2Bucket;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_TEXT_MODEL?: string;
  OPENROUTER_ANALYSIS_MODEL?: string;
  OPENROUTER_STT_MODEL?: string;
  OPENROUTER_TTS_MODEL?: string;
  OPENROUTER_TTS_VOICE?: string;
  OPENROUTER_VIDEO_MODEL?: string;
  OPENROUTER_WEBHOOK_SECRET?: string;
  ZERNIO_API_KEY?: string;
};

interface AuthenticatedUser {
  email: string;
  name: string;
}

interface AssetRow {
  id: string;
  owner_email: string;
  name: string;
  kind: Asset["kind"];
  content_type: string;
  bytes: number;
  r2_key: string;
  created_at: string;
}

interface JobRow {
  id: string;
  owner_email: string;
  provider_job_id: string | null;
  project_id: string | null;
  prompt: string | null;
  status: GenerationJob["status"];
  progress: number;
  result_asset_id: string | null;
  error: string | null;
  payload: string;
  finalizing_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PublishingIntentRow {
  id: string;
  owner_email: string;
  request_json: string;
  provider_request: string | null;
  provider_response: string | null;
  status: string;
  submitting_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface ReferralCodeRow {
  owner_email: string;
  code: string;
  created_at: string;
}

interface ReferralClaimRow {
  id: string;
  referral_code: string;
  referrer_email: string;
  referred_email: string;
  status: "pending" | "verified";
  credits_awarded: number;
  value_cents: number;
  qualified_at: string | null;
  payment_event_id: string | null;
  plan_id: string | null;
  created_at: string;
}

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const ZERNIO_BASE = "https://zernio.com/api/v1";
const MAX_WORKSPACE_BYTES = 2_000_000;
const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;
const MAX_AI_MEDIA_BYTES = 24 * 1024 * 1024;
const REFERRAL_REWARD_CREDITS = 500;
const REFERRAL_REWARD_CENTS = 500;
const ALLOWED_UPLOAD_PREFIXES = ["video/", "audio/", "image/"];
const ACTIVE_UPLOAD_TYPES = new Set(["image/svg+xml"]);
const ZERNIO_PLATFORMS = new Set([
  "twitter",
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "pinterest",
  "threads",
]);

let schemaInitialization: Promise<void> | undefined;

function json(
  value: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function errorResponse(
  error: string,
  status = 400,
  missing: string[] = []
): Response {
  return json({ error, ...(missing.length ? { missing } : {}) }, status);
}

function decodeUserName(request: Request): string | null {
  const raw = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get(
    "oai-authenticated-user-full-name-encoding"
  );
  if (!raw || encoding !== "percent-encoded-utf-8") return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] || "Creator";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getUser(request: Request): AuthenticatedUser | null {
  const email = request.headers
    .get("oai-authenticated-user-email")
    ?.trim()
    .toLowerCase();

  if (email) {
    return { email, name: decodeUserName(request) || nameFromEmail(email) };
  }

  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return {
      email: "local.creator@reelassati.dev",
      name: "Local Creator",
    };
  }

  return null;
}

function capabilities(env: SitesEnvironment): CapabilityState {
  const missing: string[] = [];
  if (!env.OPENROUTER_API_KEY) missing.push("OPENROUTER_API_KEY");
  if (!env.ZERNIO_API_KEY) missing.push("ZERNIO_API_KEY");

  return {
    persistence: Boolean(env.DB),
    uploads: Boolean(env.BUCKET),
    ai: Boolean(env.OPENROUTER_API_KEY),
    transcription: Boolean(env.OPENROUTER_API_KEY && env.BUCKET),
    speech: Boolean(env.OPENROUTER_API_KEY && env.BUCKET),
    videoGeneration: Boolean(env.OPENROUTER_API_KEY && env.BUCKET),
    publishing: Boolean(env.ZERNIO_API_KEY),
    missing,
  };
}

async function initializeSchema(env: SitesEnvironment): Promise<void> {
  if (!schemaInitialization) {
    schemaInitialization = env.DB.batch([
      env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS workspace_state (
            owner_email TEXT PRIMARY KEY NOT NULL,
            document TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            revision INTEGER NOT NULL DEFAULT 0
          )
        `),
      env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS assets (
            id TEXT PRIMARY KEY NOT NULL,
            owner_email TEXT NOT NULL,
            name TEXT NOT NULL,
            kind TEXT NOT NULL,
            content_type TEXT NOT NULL,
            bytes INTEGER NOT NULL DEFAULT 0,
            r2_key TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
          )
        `),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS assets_owner_created_idx ON assets (owner_email, created_at)"
      ),
      env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS generation_jobs (
            id TEXT PRIMARY KEY NOT NULL,
            owner_email TEXT NOT NULL,
            provider_job_id TEXT,
            project_id TEXT,
            prompt TEXT,
            status TEXT NOT NULL,
            progress INTEGER NOT NULL DEFAULT 0,
            result_asset_id TEXT,
            error TEXT,
            payload TEXT NOT NULL,
            finalizing_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS generation_jobs_owner_created_idx ON generation_jobs (owner_email, created_at)"
      ),
      env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS publishing_intents (
            id TEXT PRIMARY KEY NOT NULL,
            owner_email TEXT NOT NULL,
            request_json TEXT NOT NULL,
            provider_request TEXT,
            provider_response TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            submitting_at TEXT,
            error TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS publishing_intents_owner_created_idx ON publishing_intents (owner_email, created_at)"
      ),
      env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS zernio_profiles (
            owner_email TEXT PRIMARY KEY NOT NULL,
            profile_id TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
          )
        `),
      env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS referral_codes (
            owner_email TEXT PRIMARY KEY NOT NULL,
            code TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
          )
        `),
      env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS referral_claims (
            id TEXT PRIMARY KEY NOT NULL,
            referral_code TEXT NOT NULL,
            referrer_email TEXT NOT NULL,
            referred_email TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'pending',
            credits_awarded INTEGER NOT NULL DEFAULT 0,
            value_cents INTEGER NOT NULL DEFAULT 0,
            qualified_at TEXT,
            payment_event_id TEXT UNIQUE,
            plan_id TEXT,
            created_at TEXT NOT NULL
          )
        `),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS referral_claims_referrer_created_idx ON referral_claims (referrer_email, created_at)"
      ),
    ])
      .then(async () => {
        const columns = await env.DB.prepare(
          "PRAGMA table_info(workspace_state)"
        ).all<{ name: string }>();
        if (!columns.results.some(column => column.name === "revision")) {
          await env.DB.prepare(
            "ALTER TABLE workspace_state ADD COLUMN revision INTEGER NOT NULL DEFAULT 0"
          ).run();
        }
        const jobColumns = await env.DB.prepare(
          "PRAGMA table_info(generation_jobs)"
        ).all<{ name: string }>();
        if (
          !jobColumns.results.some(column => column.name === "finalizing_at")
        ) {
          await env.DB.prepare(
            "ALTER TABLE generation_jobs ADD COLUMN finalizing_at TEXT"
          ).run();
        }
        const publishingColumns = await env.DB.prepare(
          "PRAGMA table_info(publishing_intents)"
        ).all<{ name: string }>();
        if (
          !publishingColumns.results.some(
            column => column.name === "submitting_at"
          )
        ) {
          await env.DB.prepare(
            "ALTER TABLE publishing_intents ADD COLUMN submitting_at TEXT"
          ).run();
        }
        if (
          !publishingColumns.results.some(
            column => column.name === "provider_request"
          )
        ) {
          await env.DB.prepare(
            "ALTER TABLE publishing_intents ADD COLUMN provider_request TEXT"
          ).run();
        }
        const referralColumns = await env.DB.prepare(
          "PRAGMA table_info(referral_claims)"
        ).all<{ name: string }>();
        const referralColumnNames = new Set(
          referralColumns.results.map(column => column.name)
        );
        if (!referralColumnNames.has("status")) {
          await env.DB.prepare(
            "ALTER TABLE referral_claims ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'"
          ).run();
        }
        if (!referralColumnNames.has("qualified_at")) {
          await env.DB.prepare(
            "ALTER TABLE referral_claims ADD COLUMN qualified_at TEXT"
          ).run();
        }
        if (!referralColumnNames.has("payment_event_id")) {
          await env.DB.prepare(
            "ALTER TABLE referral_claims ADD COLUMN payment_event_id TEXT"
          ).run();
        }
        if (!referralColumnNames.has("plan_id")) {
          await env.DB.prepare(
            "ALTER TABLE referral_claims ADD COLUMN plan_id TEXT"
          ).run();
        }
        await env.DB.prepare(
          `
            UPDATE referral_claims
            SET credits_awarded = 0, value_cents = 0
            WHERE status = 'pending'
          `
        ).run();
        await env.DB.prepare(
          "CREATE UNIQUE INDEX IF NOT EXISTS referral_claims_payment_event_id_unique ON referral_claims (payment_event_id)"
        ).run();
      })
      .catch(cause => {
        schemaInitialization = undefined;
        throw cause;
      });
  }
  return schemaInitialization;
}

async function getWorkspace(
  env: SitesEnvironment,
  user: AuthenticatedUser
): Promise<WorkspaceDocument> {
  await initializeSchema(env);
  const row = await env.DB.prepare(
    "SELECT document, revision FROM workspace_state WHERE owner_email = ?"
  )
    .bind(user.email)
    .first<{ document: string; revision: number }>();

  let workspace: WorkspaceDocument | null = null;
  if (row?.document) {
    try {
      workspace = normalizeWorkspace(JSON.parse(row.document), user);
      workspace.revision = Number.isSafeInteger(row.revision)
        ? Math.max(0, row.revision)
        : 0;
    } catch {
      throw new Response(
        JSON.stringify({
          error:
            "Stored workspace data could not be read. No overwrite was attempted.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (!workspace) {
    workspace = createEmptyWorkspace(user.email, user.name);
    workspace = await saveWorkspace(env, user, workspace);
  }
  const savedAssetMetadata = new Map(
    workspace.assets.map(asset => [asset.id, asset])
  );
  workspace.assets = (await listOwnerAssets(env, user)).map(asset => {
    const saved = savedAssetMetadata.get(asset.id);
    if (!saved) return asset;
    return {
      ...asset,
      name: stringValue(saved.name, asset.name).slice(0, 240),
      ...(typeof saved.duration === "number"
        ? { duration: Math.max(0, saved.duration) }
        : {}),
      ...(typeof saved.width === "number"
        ? { width: Math.max(1, Math.round(saved.width)) }
        : {}),
      ...(typeof saved.height === "number"
        ? { height: Math.max(1, Math.round(saved.height)) }
        : {}),
      ...(saved.variantGroupId ? { variantGroupId: saved.variantGroupId } : {}),
      ...(saved.parentAssetId ? { parentAssetId: saved.parentAssetId } : {}),
    };
  });
  workspace.jobs = await listOwnerJobs(env, user);
  return workspace;
}

function normalizeWorkspace(
  value: unknown,
  user: AuthenticatedUser
): WorkspaceDocument {
  if (!value || typeof value !== "object") {
    return createEmptyWorkspace(user.email, user.name);
  }

  const candidate = value as Partial<WorkspaceDocument>;
  const empty = createEmptyWorkspace(user.email, user.name);
  return {
    version: 1,
    revision:
      Number.isSafeInteger(candidate.revision) &&
      Number(candidate.revision) >= 0
        ? Number(candidate.revision)
        : 0,
    profile: {
      ...empty.profile,
      ...(candidate.profile || {}),
      email: user.email,
      name: candidate.profile?.name || user.name,
    },
    brandKit: { ...empty.brandKit, ...(candidate.brandKit || {}) },
    projects: Array.isArray(candidate.projects)
      ? candidate.projects.map(project => ({
          ...project,
          revisions: Array.isArray(project.revisions)
            ? project.revisions.slice(-24)
            : [],
          proposedChanges: Array.isArray(project.proposedChanges)
            ? project.proposedChanges.slice(-120)
            : [],
          qualitySignals: Array.isArray(project.qualitySignals)
            ? project.qualitySignals.slice(-120)
            : [],
        }))
      : [],
    assets: Array.isArray(candidate.assets) ? candidate.assets : [],
    scripts: Array.isArray(candidate.scripts) ? candidate.scripts : [],
    accounts: Array.isArray(candidate.accounts) ? candidate.accounts : [],
    posts: Array.isArray(candidate.posts) ? candidate.posts : [],
    goals: Array.isArray(candidate.goals) ? candidate.goals : [],
    jobs: Array.isArray(candidate.jobs) ? candidate.jobs : [],
    activity: Array.isArray(candidate.activity) ? candidate.activity : [],
    updatedAt:
      typeof candidate.updatedAt === "string"
        ? candidate.updatedAt
        : new Date().toISOString(),
  };
}

async function saveWorkspace(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  workspaceValue: unknown
): Promise<WorkspaceDocument> {
  await initializeSchema(env);
  const workspace = normalizeWorkspace(workspaceValue, user);
  const current = await env.DB.prepare(
    "SELECT revision FROM workspace_state WHERE owner_email = ?"
  )
    .bind(user.email)
    .first<{ revision: number }>();
  const expectedRevision = workspace.revision;

  if (!current) {
    if (expectedRevision !== 0) {
      throw new Response(
        JSON.stringify({
          error:
            "The workspace changed before this save. Reload the latest version.",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }
    workspace.revision = 0;
  } else {
    const currentRevision = Math.max(0, Number(current.revision) || 0);
    if (expectedRevision !== currentRevision) {
      throw new Response(
        JSON.stringify({
          error:
            "The workspace changed in another session. Reload before saving again.",
          currentRevision,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }
    workspace.revision = currentRevision + 1;
  }
  workspace.updatedAt = new Date().toISOString();
  const serialized = JSON.stringify(workspace);
  if (new TextEncoder().encode(serialized).byteLength > MAX_WORKSPACE_BYTES) {
    throw new Response(
      JSON.stringify({ error: "Workspace data exceeds the safe 2 MB limit" }),
      {
        status: 413,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const result = current
    ? await env.DB.prepare(
        `
        UPDATE workspace_state
        SET document = ?, updated_at = ?, revision = ?
        WHERE owner_email = ? AND revision = ?
      `
      )
        .bind(
          serialized,
          workspace.updatedAt,
          workspace.revision,
          user.email,
          expectedRevision
        )
        .run()
    : await env.DB.prepare(
        `
        INSERT INTO workspace_state
          (owner_email, document, updated_at, revision)
        VALUES (?, ?, ?, 0)
        ON CONFLICT(owner_email) DO NOTHING
      `
      )
        .bind(user.email, serialized, workspace.updatedAt)
        .run();
  if ((result.meta?.changes || 0) !== 1) {
    throw new Response(
      JSON.stringify({
        error:
          "The workspace changed during this save. Reload the latest version.",
      }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }
  return workspace;
}

async function readBoundedBody(
  request: Request,
  maximumBytes: number
): Promise<Uint8Array> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > maximumBytes) {
    throw new Response(JSON.stringify({ error: "Request body is too large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }
  const reader = request.body?.getReader();
  if (!reader) {
    throw new Response(
      JSON.stringify({ error: "A request body is required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new Response(
          JSON.stringify({ error: "Request body is too large" }),
          {
            status: 413,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function parseJsonBody<T>(request: Request): Promise<T> {
  const bytes = await readBoundedBody(request, MAX_WORKSPACE_BYTES);
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new Response(
      JSON.stringify({ error: "Request body is not valid JSON" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

function sanitizeFilename(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || "asset"
  );
}

function isPublicHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    const blockedHostname =
      hostname === "localhost" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".home") ||
      hostname.endsWith(".lan") ||
      hostname.endsWith(".test") ||
      hostname.endsWith(".invalid");
    const privateIpv4 =
      /^10\./.test(hostname) ||
      /^127\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      hostname.includes(".") &&
      !hostname.includes(":") &&
      !privateIpv4 &&
      !blockedHostname
    );
  } catch {
    return false;
  }
}

function inferAssetKind(
  contentType: string,
  requested?: string
): Asset["kind"] {
  if (requested === "export") return "export";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  if (contentType.startsWith("image/")) return "image";
  return "script";
}

function rowToAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    contentType: row.content_type,
    size: row.bytes,
    url: `/api/assets/${encodeURIComponent(row.id)}`,
    status: "ready",
    createdAt: row.created_at,
  };
}

async function insertAssetRecord(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  input: {
    name: string;
    kind: Asset["kind"];
    contentType: string;
    size: number;
    r2Key: string;
    id?: string;
  }
): Promise<Asset> {
  const id = input.id || crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await env.DB.prepare(
    `
    INSERT INTO assets
      (id, owner_email, name, kind, content_type, bytes, r2_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  )
    .bind(
      id,
      user.email,
      input.name,
      input.kind,
      input.contentType,
      input.size,
      input.r2Key,
      createdAt
    )
    .run();

  return {
    id,
    name: input.name,
    kind: input.kind,
    contentType: input.contentType,
    size: input.size,
    url: `/api/assets/${encodeURIComponent(id)}`,
    status: "ready",
    createdAt,
  };
}

async function ensureGeneratedAssetRecord(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  input: {
    id: string;
    name: string;
    contentType: string;
    size: number;
    r2Key: string;
  }
): Promise<Asset> {
  await env.DB.prepare(
    `
    INSERT INTO assets
      (id, owner_email, name, kind, content_type, bytes, r2_key, created_at)
    VALUES (?, ?, ?, 'video', ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `
  )
    .bind(
      input.id,
      user.email,
      input.name,
      input.contentType,
      input.size,
      input.r2Key,
      new Date().toISOString()
    )
    .run();
  const row = await getAssetRow(env, user, input.id);
  if (!row || row.r2_key !== input.r2Key) {
    throw new Error("The generated asset id is already bound elsewhere");
  }
  return rowToAsset(row);
}

async function getAssetRow(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  id: string
): Promise<AssetRow | null> {
  await initializeSchema(env);
  return env.DB.prepare(
    `SELECT id, owner_email, name, kind, content_type, bytes, r2_key, created_at
     FROM assets WHERE id = ? AND owner_email = ?`
  )
    .bind(id, user.email)
    .first<AssetRow>();
}

async function listOwnerAssets(
  env: SitesEnvironment,
  user: AuthenticatedUser
): Promise<Asset[]> {
  await initializeSchema(env);
  const result = await env.DB.prepare(
    `SELECT id, owner_email, name, kind, content_type, bytes, r2_key, created_at
     FROM assets WHERE owner_email = ? ORDER BY created_at DESC`
  )
    .bind(user.email)
    .all<AssetRow>();
  return result.results.map(rowToAsset);
}

async function listOwnerJobs(
  env: SitesEnvironment,
  user: AuthenticatedUser
): Promise<GenerationJob[]> {
  await initializeSchema(env);
  const result = await env.DB.prepare(
    `SELECT id, owner_email, provider_job_id, project_id, prompt, status,
            progress, result_asset_id, error, payload, finalizing_at,
            created_at, updated_at
     FROM generation_jobs WHERE owner_email = ? ORDER BY created_at DESC`
  )
    .bind(user.email)
    .all<JobRow>();
  return result.results.map(jobFromRow);
}

function parseRange(
  value: string | null,
  size: number
): { offset: number; length: number } | null {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match) return null;
  const startText = match[1];
  const endText = match[2];
  if (!startText && !endText) return null;
  if (!startText) {
    const suffix = Math.min(Number(endText), size);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    return { offset: size - suffix, length: suffix };
  }
  const start = Number(startText);
  const end = endText ? Math.min(Number(endText), size - 1) : size - 1;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start > end ||
    start >= size
  ) {
    return null;
  }
  return { offset: start, length: end - start + 1 };
}

function openRouterHeaders(env: SitesEnvironment): HeadersInit {
  return {
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://reelassati.chatgpt.site",
    "X-Title": "REELassati",
  };
}

async function providerError(
  response: Response,
  provider: string
): Promise<never> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string } | string;
    message?: string;
    details?: unknown;
  };
  const nested =
    typeof body.error === "object" ? body.error?.message : body.error;
  const message = nested || body.message || `${provider} request failed`;
  throw new Response(
    JSON.stringify({
      error: message,
      ...(body.details ? { details: body.details } : {}),
    }),
    {
      status:
        response.status >= 400 && response.status < 600 ? response.status : 502,
      headers: { "Content-Type": "application/json" },
    }
  );
}

function extractTextContent(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const choices = (payload as { choices?: unknown[] }).choices;
  const choice = Array.isArray(choices) ? choices[0] : undefined;
  if (!choice || typeof choice !== "object") return "";
  const message = (choice as { message?: unknown }).message;
  if (!message || typeof message !== "object") return "";
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map(part =>
        part && typeof part === "object" && "text" in part
          ? String((part as { text: unknown }).text)
          : ""
      )
      .join("");
  }
  return "";
}

function parseModelJson(payload: unknown): Record<string, unknown> {
  const content = extractTextContent(payload)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  if (!content) throw new Error("The model returned an empty response");
  return JSON.parse(content) as Record<string, unknown>;
}

async function chatJson(
  env: SitesEnvironment,
  system: string,
  userContent: unknown,
  model?: string
): Promise<Record<string, unknown>> {
  if (!env.OPENROUTER_API_KEY) {
    throw new Response(
      JSON.stringify({
        error: "AI is ready but needs a new OpenRouter key",
        missing: ["OPENROUTER_API_KEY"],
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: openRouterHeaders(env),
    body: JSON.stringify({
      model: model || env.OPENROUTER_TEXT_MODEL || "moonshotai/kimi-k2.5",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.45,
    }),
  });
  if (!response.ok) await providerError(response, "OpenRouter");
  return parseModelJson(await response.json());
}

function boundedNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, number))
    : fallback;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nestedData(payload: Record<string, unknown>): Record<string, unknown> {
  return recordValue(payload.data) || payload;
}

async function stableRequestUuid(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`reelassati:${value}`)
    )
  ).slice(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest, byte => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

function platformValue(value: unknown): Platform {
  return knownPlatform(value) || "tiktok";
}

function knownPlatform(value: unknown): Platform | null {
  const platform = stringValue(value).toLowerCase();
  const allowed: Platform[] = [
    "tiktok",
    "instagram",
    "youtube",
    "twitter",
    "facebook",
    "linkedin",
    "pinterest",
    "threads",
  ];
  return allowed.includes(platform as Platform) ? (platform as Platform) : null;
}

function mapEditOperations(
  value: unknown,
  duration: number,
  clips: WorkspaceDocument["projects"][number]["clips"] = [],
  selectedClipIds: string[] = []
): EditOperation[] {
  if (!Array.isArray(value)) return [];
  const validSelectedIds = new Set(
    selectedClipIds.filter(id => clips.some(clip => clip.id === id))
  );
  return value.slice(0, 12).map((item, index) => {
    const row = item && typeof item === "object" ? item : {};
    const typed = row as Record<string, unknown>;
    const start = boundedNumber(typed.start, 0, 0, duration);
    const end = boundedNumber(
      typed.end,
      Math.min(duration, start + 2),
      start,
      duration
    );
    const type = stringValue(typed.type, "pacing") as EditOperation["type"];
    const allowedTypes: EditOperation["type"][] = [
      "trim",
      "split",
      "move",
      "delete",
      "caption",
      "silence",
      "pacing",
      "broll",
      "audio",
      "style",
    ];
    const targetClipIds = validSelectedIds.size
      ? Array.from(validSelectedIds)
      : clips
          .filter(
            clip => clip.start < end && clip.start + clip.duration > start
          )
          .map(clip => clip.id);
    return {
      id: crypto.randomUUID(),
      type: allowedTypes.includes(type) ? type : "pacing",
      label: stringValue(typed.label, `Edit ${index + 1}`),
      reason: stringValue(
        typed.reason,
        "Improves clarity for short-form viewing"
      ),
      start,
      end,
      confidence: boundedNumber(typed.confidence, 0.72, 0, 1),
      intensity:
        typed.intensity === "light" || typed.intensity === "aggressive"
          ? typed.intensity
          : "balanced",
      targetClipIds,
      status: "proposed",
    };
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize)
    );
  }
  return btoa(binary);
}

async function videoWebhookToken(apiKey: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`reelassati-video-webhook-v1:${apiKey}`)
  );
  return Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifyOpenRouterWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parts = signatureHeader.split(",").map(part => part.trim());
  const timestamp = parts.find(part => part.startsWith("t="))?.slice(2);
  const signature = parts.find(part => part.startsWith("v1="))?.slice(3);
  if (!timestamp || !signature || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }
  const timestampNumber = Number(timestamp);
  if (
    !Number.isFinite(timestampNumber) ||
    Math.abs(Date.now() / 1000 - timestampNumber) > 5 * 60
  ) {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp},${rawBody}`)
  );
  const expected = Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return constantTimeEqual(signature.toLowerCase(), expected);
}

function audioFormat(contentType: string, filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (
    extension &&
    ["wav", "mp3", "flac", "m4a", "ogg", "webm", "aac"].includes(extension)
  ) {
    return extension;
  }
  const subtype = contentType.split("/")[1]?.split(";")[0];
  return subtype === "mpeg" ? "mp3" : subtype || "webm";
}

async function zernioRequest(
  env: SitesEnvironment,
  path: string,
  init?: RequestInit
): Promise<Record<string, unknown>> {
  if (!env.ZERNIO_API_KEY) {
    throw new Response(
      JSON.stringify({
        error: "Publishing is ready but needs a new Zernio key",
        missing: ["ZERNIO_API_KEY"],
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await fetch(`${ZERNIO_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.ZERNIO_API_KEY}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) await providerError(response, "Zernio");
  if (response.status === 204) return {};
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text.trim() };
  }
}

async function recoverZernioConflict(
  env: SitesEnvironment,
  response: Response
): Promise<Record<string, unknown> | null> {
  if (response.status !== 409) return null;
  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as Record<string, unknown> | null;
  const details = recordValue(body?.details);
  const existingPostId = stringValue(
    details?.existingPostId || body?.existingPostId
  );
  if (!existingPostId) return null;
  try {
    return await zernioRequest(
      env,
      `/posts/${encodeURIComponent(existingPostId)}`
    );
  } catch {
    return null;
  }
}

function isAmbiguousProviderFailure(cause: unknown): boolean {
  return (
    !(cause instanceof Response) ||
    cause.status === 408 ||
    cause.status === 425 ||
    cause.status >= 500
  );
}

async function submitZernioPost(
  env: SitesEnvironment,
  intentId: string,
  providerRequest: string
): Promise<Record<string, unknown>> {
  const requestId = await stableRequestUuid(intentId);
  let lastFailure: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await zernioRequest(env, "/posts", {
        method: "POST",
        headers: { "x-request-id": requestId },
        body: providerRequest,
      });
    } catch (cause) {
      if (cause instanceof Response) {
        const recovered = await recoverZernioConflict(env, cause);
        if (recovered) return recovered;
      }
      lastFailure = cause;
      if (!isAmbiguousProviderFailure(cause) || attempt === 1) throw cause;
    }
  }
  throw lastFailure;
}

async function ensureZernioProfile(
  env: SitesEnvironment,
  user: AuthenticatedUser
): Promise<string> {
  await initializeSchema(env);
  const existing = await env.DB.prepare(
    "SELECT profile_id FROM zernio_profiles WHERE owner_email = ?"
  )
    .bind(user.email)
    .first<{ profile_id: string }>();
  if (existing?.profile_id) return existing.profile_id;

  let payload: Record<string, unknown>;
  try {
    payload = await zernioRequest(env, "/profiles", {
      method: "POST",
      headers: { "Idempotency-Key": `reelassati-${user.email}` },
      body: JSON.stringify({
        name: `REELassati — ${user.name}`,
        description: "Creator profile managed by REELassati",
      }),
    });
  } catch (cause) {
    if (cause instanceof Response && cause.status === 409) {
      const conflict = (await cause.json().catch(() => ({}))) as {
        details?: { existingProfileId?: string };
      };
      if (conflict.details?.existingProfileId) {
        payload = { profile: { _id: conflict.details.existingProfileId } };
      } else {
        throw cause;
      }
    } else {
      throw cause;
    }
  }

  const data = nestedData(payload);
  const profile = recordValue(data.profile) || data;
  const id = stringValue(profile._id || profile.id);
  if (!id) throw new Error("Zernio did not return a profile id");
  await env.DB.prepare(
    `
    INSERT INTO zernio_profiles (owner_email, profile_id, created_at)
    VALUES (?, ?, ?)
    ON CONFLICT(owner_email) DO UPDATE SET profile_id = excluded.profile_id
  `
  )
    .bind(user.email, id, new Date().toISOString())
    .run();
  return id;
}

async function listZernioAccounts(
  env: SitesEnvironment,
  user: AuthenticatedUser
): Promise<PublishingAccount[]> {
  const profileId = await ensureZernioProfile(env, user);
  const payload = await zernioRequest(
    env,
    `/accounts?profileId=${encodeURIComponent(profileId)}`
  );
  const data = nestedData(payload);
  const rows = Array.isArray(payload.accounts)
    ? payload.accounts
    : Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(data.accounts)
        ? data.accounts
        : [];
  return rows.flatMap(row => {
    const account = row as Record<string, unknown>;
    const id = stringValue(account._id || account.id);
    const platform = knownPlatform(account.platform);
    if (!id || !platform) return [];
    const handle = stringValue(account.username || account.handle);
    const mapped: PublishingAccount = {
      id,
      providerId: id,
      platform,
      accountName: stringValue(
        account.displayName || account.name || account.username,
        "Connected account"
      ),
      status: "connected" as const,
    };
    if (handle) mapped.handle = handle;
    return [mapped];
  });
}

function jobFromRow(row: JobRow): GenerationJob {
  return {
    id: row.id,
    type: "video",
    status: row.status,
    providerJobId: row.provider_job_id || undefined,
    projectId: row.project_id || undefined,
    prompt: row.prompt || undefined,
    progress: row.progress,
    resultAssetId: row.result_asset_id || undefined,
    error: row.error || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function handleAssets(
  request: Request,
  env: SitesEnvironment,
  user: AuthenticatedUser,
  url: URL
): Promise<Response> {
  const parts = url.pathname.split("/").filter(Boolean);
  const id = parts[2];

  if (request.method === "POST" && !id) {
    const contentLength = request.headers.get("content-length");
    const requestBytes = Number(contentLength || "0");
    if (!contentLength || !Number.isFinite(requestBytes) || requestBytes <= 0) {
      return errorResponse(
        "Uploads require a known content length for safe streaming",
        411
      );
    }
    if (requestBytes > MAX_UPLOAD_BYTES + 1024 * 1024) {
      return errorResponse(
        "Files are limited to 64 MB in this hosted studio",
        413
      );
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return errorResponse("Choose a file to upload");
    if (file.size <= 0) return errorResponse("The selected file is empty");
    if (file.size > MAX_UPLOAD_BYTES) {
      return errorResponse(
        "Files are limited to 64 MB in this hosted studio",
        413
      );
    }
    const contentType = file.type || "application/octet-stream";
    if (
      ACTIVE_UPLOAD_TYPES.has(contentType.toLowerCase()) ||
      !ALLOWED_UPLOAD_PREFIXES.some(prefix => contentType.startsWith(prefix))
    ) {
      return errorResponse("Upload a video, audio file, or image", 415);
    }
    const leadingText = new TextDecoder()
      .decode(await file.slice(0, 512).arrayBuffer())
      .replace(/\0/g, "")
      .trimStart()
      .toLowerCase();
    if (
      leadingText.startsWith("<svg") ||
      leadingText.startsWith("<script") ||
      leadingText.startsWith("<html") ||
      leadingText.startsWith("<!doctype html")
    ) {
      return errorResponse(
        "Active markup files cannot be stored as media",
        415
      );
    }

    const assetId = crypto.randomUUID();
    const safeName = sanitizeFilename(file.name);
    const r2Key = `users/${encodeURIComponent(user.email)}/assets/${assetId}/${safeName}`;
    await env.BUCKET.put(r2Key, file.stream(), {
      httpMetadata: { contentType },
      customMetadata: { owner: user.email, originalName: file.name },
    });
    let asset: Asset;
    try {
      asset = await insertAssetRecord(env, user, {
        id: assetId,
        name: file.name,
        kind: inferAssetKind(contentType, stringValue(form.get("kind"))),
        contentType,
        size: file.size,
        r2Key,
      });
    } catch (cause) {
      await env.BUCKET.delete(r2Key).catch(() => undefined);
      throw cause;
    }
    return json({ asset }, 201);
  }

  if (!id) return errorResponse("Asset not found", 404);
  const row = await getAssetRow(env, user, id);
  if (!row) return errorResponse("Asset not found", 404);

  if (request.method === "DELETE") {
    await env.BUCKET.delete(row.r2_key);
    await env.DB.prepare("DELETE FROM assets WHERE id = ? AND owner_email = ?")
      .bind(id, user.email)
      .run();
    return json({ ok: true });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return errorResponse("Method not allowed", 405);
  }

  const requestedRange = parseRange(request.headers.get("range"), row.bytes);
  const object = await env.BUCKET.get(
    row.r2_key,
    requestedRange ? { range: requestedRange } : undefined
  );
  if (!object) return errorResponse("Asset bytes are missing", 404);
  const headers = new Headers({
    "Content-Type": row.content_type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    ETag: object.httpEtag || object.etag,
    "Content-Disposition": `inline; filename="${sanitizeFilename(row.name)}"`,
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "X-Content-Type-Options": "nosniff",
  });
  if (requestedRange) {
    const end = requestedRange.offset + requestedRange.length - 1;
    headers.set(
      "Content-Range",
      `bytes ${requestedRange.offset}-${end}/${row.bytes}`
    );
    headers.set("Content-Length", String(requestedRange.length));
  } else {
    headers.set("Content-Length", String(row.bytes));
  }
  return new Response(request.method === "HEAD" ? null : object.body, {
    status: requestedRange ? 206 : 200,
    headers,
  });
}

async function handleAi(
  request: Request,
  env: SitesEnvironment,
  user: AuthenticatedUser,
  url: URL
): Promise<Response> {
  if (request.method !== "POST")
    return errorResponse("Method not allowed", 405);

  if (url.pathname === "/api/ai/script") {
    const input = await parseJsonBody<{
      topic?: string;
      platform?: string;
      tone?: string;
      duration?: number;
      language?: string;
      brandVoice?: string;
    }>(request);
    const topic = stringValue(input.topic);
    if (!topic) return errorResponse("Describe the topic or product first");
    const duration = boundedNumber(input.duration, 30, 8, 180);
    const platform = platformValue(input.platform);
    const output = await chatJson(
      env,
      `You are REELassati's senior short-form script editor. Return JSON only with keys title, hook, body, cta, fullScript. Write a shootable ${duration}-second script for ${platform}; no inflated viral guarantees, no fake statistics, no generic filler. Make the first line immediately specific. Language: ${stringValue(input.language, "en")}. Tone: ${stringValue(input.tone, "energetic")}. Brand voice: ${stringValue(input.brandVoice, "not supplied")}.`,
      topic
    );
    const createdAt = new Date().toISOString();
    const hook = stringValue(output.hook);
    const body = stringValue(output.body);
    const cta = stringValue(output.cta);
    const script: ScriptDraft = {
      id: crypto.randomUUID(),
      title: stringValue(output.title, topic.slice(0, 72)),
      hook,
      body,
      cta,
      fullScript: stringValue(
        output.fullScript,
        [hook, body, cta].filter(Boolean).join("\n\n")
      ),
      platform,
      tone: stringValue(input.tone, "energetic"),
      duration,
      language: stringValue(input.language, "en"),
      createdAt,
    };
    return json({ script });
  }

  if (url.pathname === "/api/ai/edit-plan") {
    const input = await parseJsonBody<{
      project?: WorkspaceDocument["projects"][number];
      command?: string;
      selectedClipIds?: string[];
      range?: { start: number; end: number };
    }>(request);
    if (!input.project || !stringValue(input.command)) {
      return errorResponse("Choose a project and describe the edit");
    }
    const duration = boundedNumber(input.project.duration, 30, 1, 600);
    const projectContext = {
      title: input.project.title,
      duration,
      platform: input.project.platform,
      aspectRatio: input.project.aspectRatio,
      clips: input.project.clips.slice(0, 80),
      transcript: input.project.transcript.slice(0, 180),
      qualitySignals: input.project.qualitySignals.slice(0, 30),
      selectedClipIds: Array.isArray(input.selectedClipIds)
        ? input.selectedClipIds.slice(0, 20)
        : [],
      selectedRange: input.range,
    };
    const output = await chatJson(
      env,
      `You are the accountable AI edit planner inside a professional short-form timeline. Return JSON only: {"summary":"...", "changes":[...]}. Each change must contain type, label, reason, start, end, confidence (0..1), and intensity (light|balanced|aggressive). Allowed types: trim, split, move, delete, caption, silence, pacing, broll, audio, style. Plan only—never claim changes are already applied. Respect locked clips and stay inside 0..${duration}s. Prefer fewer high-impact operations. Explain the audience-retention reason concretely.`,
      JSON.stringify({ command: input.command, project: projectContext })
    );
    return json({
      summary: stringValue(output.summary, "Edit plan ready for review"),
      changes: mapEditOperations(
        output.changes,
        duration,
        input.project.clips,
        Array.isArray(input.selectedClipIds) ? input.selectedClipIds : []
      ),
    });
  }

  if (url.pathname === "/api/ai/analyze") {
    const input = await parseJsonBody<{
      assetId?: string;
      publicUrl?: string;
      platform?: string;
    }>(request);
    let videoUrl = stringValue(input.publicUrl);
    if (videoUrl && !isPublicHttpsUrl(videoUrl)) {
      return errorResponse("Use a public HTTPS video URL");
    }
    if (!videoUrl && input.assetId) {
      const row = await getAssetRow(env, user, input.assetId);
      if (!row) return errorResponse("Video asset not found", 404);
      if (!row.content_type.startsWith("video/")) {
        return errorResponse("Choose a video asset");
      }
      if (row.bytes > MAX_AI_MEDIA_BYTES) {
        return errorResponse(
          "For direct AI analysis, trim or compress this video below 24 MB",
          413
        );
      }
      const object = await env.BUCKET.get(row.r2_key);
      if (!object) return errorResponse("Video bytes are missing", 404);
      videoUrl = `data:${row.content_type};base64,${arrayBufferToBase64(
        await object.arrayBuffer()
      )}`;
    }
    if (!videoUrl)
      return errorResponse("Upload a video or provide a public URL");

    const output = await chatJson(
      env,
      `You are REELassati's evidence-focused short-form video reviewer. Inspect the supplied video. Return JSON only with summary, hook {score 0..100,note}, pacing {score 0..100,note}, retention [{start,end,score,note}], and changes. Scores are editorial rubric estimates, never presented as predicted views. Each change follows the edit-plan schema: type,label,reason,start,end,confidence,intensity. Target platform: ${platformValue(input.platform)}.`,
      [
        {
          type: "text",
          text: "Analyze the video for hook clarity, pacing, dead air, visual proof, captions, audio, and CTA. Produce only reviewable edit suggestions.",
        },
        { type: "video_url", video_url: { url: videoUrl } },
      ],
      env.OPENROUTER_ANALYSIS_MODEL || "google/gemini-2.5-flash"
    );
    const retention = Array.isArray(output.retention)
      ? output.retention.slice(0, 20).map(item => {
          const row = item as Record<string, unknown>;
          return {
            start: boundedNumber(row.start, 0, 0, 600),
            end: boundedNumber(row.end, 1, 0, 600),
            score: boundedNumber(row.score, 50, 0, 100),
            note: stringValue(row.note, "Review this interval"),
          };
        })
      : [];
    const hook =
      output.hook && typeof output.hook === "object"
        ? (output.hook as Record<string, unknown>)
        : {};
    const pacing =
      output.pacing && typeof output.pacing === "object"
        ? (output.pacing as Record<string, unknown>)
        : {};
    return json({
      summary: stringValue(output.summary, "Analysis complete"),
      hook: {
        score: boundedNumber(hook.score, 50, 0, 100),
        note: stringValue(hook.note, "Review the first three seconds"),
      },
      pacing: {
        score: boundedNumber(pacing.score, 50, 0, 100),
        note: stringValue(pacing.note, "Review pauses and shot length"),
      },
      retention,
      changes: mapEditOperations(output.changes, 600),
    });
  }

  if (url.pathname === "/api/ai/transcribe") {
    if (!env.OPENROUTER_API_KEY) {
      return errorResponse("Transcription needs a new OpenRouter key", 503, [
        "OPENROUTER_API_KEY",
      ]);
    }
    const input = await parseJsonBody<{ assetId?: string; language?: string }>(
      request
    );
    const assetId = stringValue(input.assetId);
    const row = await getAssetRow(env, user, assetId);
    if (!row) return errorResponse("Audio asset not found", 404);
    if (
      !row.content_type.startsWith("audio/") &&
      !row.content_type.startsWith("video/")
    ) {
      return errorResponse("Choose an audio or video asset");
    }
    if (row.bytes > MAX_AI_MEDIA_BYTES) {
      return errorResponse(
        "Trim the file below 24 MB before transcription",
        413
      );
    }
    const object = await env.BUCKET.get(row.r2_key);
    if (!object) return errorResponse("Audio bytes are missing", 404);
    const response = await fetch(`${OPENROUTER_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: openRouterHeaders(env),
      body: JSON.stringify({
        model: env.OPENROUTER_STT_MODEL || "openai/whisper-large-v3-turbo",
        input_audio: {
          data: arrayBufferToBase64(await object.arrayBuffer()),
          format: audioFormat(row.content_type, row.name),
        },
        ...(input.language ? { language: input.language } : {}),
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      }),
    });
    if (!response.ok) await providerError(response, "OpenRouter");
    const payload = (await response.json()) as {
      text?: string;
      segments?: Array<{ start?: number; end?: number; text?: string }>;
    };
    const segments = (payload.segments || []).map(segment => ({
      id: crypto.randomUUID(),
      start: boundedNumber(segment.start, 0, 0, 100_000),
      end: boundedNumber(segment.end, 0, 0, 100_000),
      text: stringValue(segment.text),
    }));
    return json({ transcript: payload.text || "", segments });
  }

  if (url.pathname === "/api/ai/speech") {
    if (!env.OPENROUTER_API_KEY) {
      return errorResponse("Voice generation needs a new OpenRouter key", 503, [
        "OPENROUTER_API_KEY",
      ]);
    }
    const input = await parseJsonBody<{
      text?: string;
      voice?: string;
      projectId?: string;
    }>(request);
    const text = stringValue(input.text);
    if (!text) return errorResponse("Add the text you want voiced");
    if (text.length > 5_000) {
      return errorResponse("Voice generation is limited to 5,000 characters");
    }
    const voice = stringValue(
      input.voice,
      env.OPENROUTER_TTS_VOICE || "English_Graceful_Lady"
    );
    const response = await fetch(`${OPENROUTER_BASE}/audio/speech`, {
      method: "POST",
      headers: openRouterHeaders(env),
      body: JSON.stringify({
        model: env.OPENROUTER_TTS_MODEL || "minimax/speech-2.8-turbo",
        input: text,
        voice,
        response_format: "mp3",
      }),
    });
    if (!response.ok) await providerError(response, "OpenRouter");
    const buffer = await response.arrayBuffer();
    const assetId = crypto.randomUUID();
    const r2Key = `users/${encodeURIComponent(user.email)}/generated/${assetId}.mp3`;
    await env.BUCKET.put(r2Key, buffer, {
      httpMetadata: { contentType: "audio/mpeg" },
      customMetadata: { owner: user.email, source: "openrouter-tts" },
    });
    let asset: Asset;
    try {
      asset = await insertAssetRecord(env, user, {
        id: assetId,
        name: `Voice take ${new Date().toLocaleDateString("en-GB")}.mp3`,
        kind: "audio",
        contentType: "audio/mpeg",
        size: buffer.byteLength,
        r2Key,
      });
    } catch (cause) {
      await env.BUCKET.delete(r2Key).catch(() => undefined);
      throw cause;
    }
    return json({ asset }, 201);
  }

  return errorResponse("AI route not found", 404);
}

async function handleVideoJobs(
  request: Request,
  env: SitesEnvironment,
  user: AuthenticatedUser,
  url: URL
): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) {
    return errorResponse("Video generation needs a new OpenRouter key", 503, [
      "OPENROUTER_API_KEY",
    ]);
  }
  await initializeSchema(env);
  const id = url.pathname.split("/").filter(Boolean)[3];

  if (request.method === "POST" && !id) {
    const input = await parseJsonBody<{
      requestId?: string;
      prompt?: string;
      duration?: number;
      aspectRatio?: string;
      resolution?: string;
      generateAudio?: boolean;
      firstFrameUrl?: string;
      lastFrameUrl?: string;
      projectId?: string;
    }>(request);
    const requestId = stringValue(input.requestId);
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) {
      return errorResponse("A stable video request id is required");
    }
    const prompt = stringValue(input.prompt);
    if (!prompt) return errorResponse("Describe the clip to generate");
    const duration = boundedNumber(input.duration, 5, 3, 15);
    const aspectRatio = ["9:16", "16:9", "1:1"].includes(
      stringValue(input.aspectRatio)
    )
      ? stringValue(input.aspectRatio)
      : "9:16";
    const resolution = input.resolution === "1080p" ? "1080p" : "720p";
    const frameImages: Array<{
      type: "image_url";
      frame_type: "first_frame" | "last_frame";
      image_url: { url: string };
    }> = [];
    const firstFrameUrl = stringValue(input.firstFrameUrl);
    const lastFrameUrl = stringValue(input.lastFrameUrl);
    if (firstFrameUrl) {
      if (!isPublicHttpsUrl(firstFrameUrl)) {
        return errorResponse(
          "The first frame must be a stable, public HTTPS image URL"
        );
      }
      frameImages.push({
        type: "image_url",
        frame_type: "first_frame",
        image_url: { url: firstFrameUrl },
      });
    }
    if (lastFrameUrl) {
      if (!isPublicHttpsUrl(lastFrameUrl)) {
        return errorResponse(
          "The last frame must be a stable, public HTTPS image URL"
        );
      }
      frameImages.push({
        type: "image_url",
        frame_type: "last_frame",
        image_url: { url: lastFrameUrl },
      });
    }

    const existing = await env.DB.prepare(
      "SELECT * FROM generation_jobs WHERE id = ?"
    )
      .bind(requestId)
      .first<JobRow>();
    if (existing && existing.owner_email !== user.email) {
      return errorResponse("That video request id is already in use", 409);
    }
    if (existing) {
      return json({ job: jobFromRow(existing) }, 202);
    }

    const now = new Date().toISOString();
    const registration = await env.DB.prepare(
      `
      INSERT INTO generation_jobs
        (id, owner_email, provider_job_id, project_id, prompt, status, progress,
         result_asset_id, error, payload, finalizing_at, created_at, updated_at)
      VALUES (?, ?, NULL, ?, ?, 'pending', 2, NULL, NULL, ?, NULL, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `
    )
      .bind(
        requestId,
        user.email,
        stringValue(input.projectId) || null,
        prompt,
        JSON.stringify({
          duration,
          aspectRatio,
          resolution,
          generateAudio: input.generateAudio !== false,
          firstFrameUrl: firstFrameUrl || undefined,
          lastFrameUrl: lastFrameUrl || undefined,
        }),
        now,
        now
      )
      .run();
    const registered = await env.DB.prepare(
      "SELECT * FROM generation_jobs WHERE id = ? AND owner_email = ?"
    )
      .bind(requestId, user.email)
      .first<JobRow>();
    if (!registered) {
      return errorResponse("The video request could not be registered", 500);
    }
    if ((registration.meta?.changes || 0) !== 1 || registered.provider_job_id) {
      return json({ job: jobFromRow(registered) }, 202);
    }

    const response = await fetch(`${OPENROUTER_BASE}/videos`, {
      method: "POST",
      headers: openRouterHeaders(env),
      body: JSON.stringify({
        model: env.OPENROUTER_VIDEO_MODEL || "kwaivgi/kling-v3.0-std",
        prompt,
        duration,
        resolution,
        aspect_ratio: aspectRatio,
        generate_audio: input.generateAudio !== false,
        callback_url: `${url.origin}/api/video/webhook?token=${encodeURIComponent(
          await videoWebhookToken(env.OPENROUTER_API_KEY)
        )}&requestId=${encodeURIComponent(requestId)}`,
        ...(frameImages.length ? { frame_images: frameImages } : {}),
      }),
    });
    if (!response.ok) {
      await env.DB.prepare(
        `
        UPDATE generation_jobs
        SET status = 'failed', progress = 100,
            error = 'The provider rejected the generation request',
            updated_at = ?
        WHERE id = ? AND owner_email = ? AND provider_job_id IS NULL
      `
      )
        .bind(new Date().toISOString(), requestId, user.email)
        .run();
      await providerError(response, "OpenRouter");
    }
    const payload = (await response.json()) as {
      id?: string;
      status?: string;
      polling_url?: string;
    };
    if (!payload.id) {
      await env.DB.prepare(
        `
        UPDATE generation_jobs
        SET status = 'failed', progress = 100,
            error = 'OpenRouter did not return a job id', updated_at = ?
        WHERE id = ? AND owner_email = ?
      `
      )
        .bind(new Date().toISOString(), requestId, user.email)
        .run();
      return errorResponse("OpenRouter did not return a job id", 502);
    }
    await env.DB.prepare(
      `
      UPDATE generation_jobs
      SET provider_job_id = ?, status = ?, progress = ?, error = NULL,
          payload = ?, updated_at = ?
      WHERE id = ? AND owner_email = ?
    `
    )
      .bind(
        payload.id,
        payload.status === "in_progress" ? "in_progress" : "pending",
        payload.status === "in_progress" ? 35 : 8,
        JSON.stringify({
          duration,
          aspectRatio,
          resolution,
          pollingUrl: payload.polling_url,
        }),
        new Date().toISOString(),
        requestId,
        user.email
      )
      .run();
    const row = await env.DB.prepare(
      "SELECT * FROM generation_jobs WHERE id = ? AND owner_email = ?"
    )
      .bind(requestId, user.email)
      .first<JobRow>();
    return json({ job: jobFromRow(row as JobRow) }, 202);
  }

  if (request.method !== "GET" || !id) {
    return errorResponse("Video job not found", 404);
  }

  let row = await env.DB.prepare(
    "SELECT * FROM generation_jobs WHERE id = ? AND owner_email = ?"
  )
    .bind(id, user.email)
    .first<JobRow>();
  if (!row) return errorResponse("Video job not found", 404);

  if (
    row.status === "pending" &&
    !row.provider_job_id &&
    Date.now() - new Date(row.created_at).getTime() > 10 * 60 * 1000
  ) {
    await env.DB.prepare(
      `
      UPDATE generation_jobs
      SET status = 'failed', progress = 100,
          error = 'The provider did not confirm this registered request',
          updated_at = ?
      WHERE id = ? AND owner_email = ? AND provider_job_id IS NULL
    `
    )
      .bind(new Date().toISOString(), id, user.email)
      .run();
    row = await env.DB.prepare(
      "SELECT * FROM generation_jobs WHERE id = ? AND owner_email = ?"
    )
      .bind(id, user.email)
      .first<JobRow>();
  }
  if (!row) return errorResponse("Video job not found", 404);

  if (
    (row.status === "pending" || row.status === "in_progress") &&
    row.provider_job_id
  ) {
    const statusResponse = await fetch(
      `${OPENROUTER_BASE}/videos/${encodeURIComponent(row.provider_job_id)}`,
      {
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://reelassati.chatgpt.site",
          "X-Title": "REELassati",
        },
      }
    );
    if (!statusResponse.ok) await providerError(statusResponse, "OpenRouter");
    const statusPayload = (await statusResponse.json()) as {
      status?: string;
      error?: string;
    };
    const now = new Date().toISOString();
    if (statusPayload.status === "completed" && !row.result_asset_id) {
      const leaseCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const lease = await env.DB.prepare(
        `
        UPDATE generation_jobs
        SET finalizing_at = ?, status = 'in_progress', progress = 92,
            updated_at = ?
        WHERE id = ? AND owner_email = ? AND result_asset_id IS NULL
          AND (finalizing_at IS NULL OR finalizing_at < ?)
      `
      )
        .bind(now, now, id, user.email, leaseCutoff)
        .run();
      if ((lease.meta?.changes || 0) === 1) {
        try {
          const assetId = `video-${id}`;
          const r2Key = `users/${encodeURIComponent(
            user.email
          )}/generated/${assetId}.mp4`;
          let asset = await getAssetRow(env, user, assetId).then(existing =>
            existing ? rowToAsset(existing) : null
          );
          let storedVideo = await env.BUCKET.get(r2Key);
          if (!storedVideo) {
            const contentResponse = await fetch(
              `${OPENROUTER_BASE}/videos/${encodeURIComponent(
                row.provider_job_id
              )}/content`,
              {
                headers: {
                  Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
                  "HTTP-Referer": "https://reelassati.chatgpt.site",
                  "X-Title": "REELassati",
                },
              }
            );
            if (!contentResponse.ok) {
              await providerError(contentResponse, "OpenRouter");
            }
            if (!contentResponse.body) {
              throw new Error("Generated video download was empty");
            }
            const reportedSize = Number(
              contentResponse.headers.get("content-length") || "0"
            );
            await env.BUCKET.put(r2Key, contentResponse.body, {
              httpMetadata: { contentType: "video/mp4" },
              customMetadata: {
                owner: user.email,
                source: "openrouter-video",
                providerJobId: row.provider_job_id,
              },
            });
            storedVideo = await env.BUCKET.get(r2Key);
            if (!storedVideo && reportedSize <= 0) {
              throw new Error("Generated video storage could not be verified");
            }
          }
          if (!asset) {
            asset = await ensureGeneratedAssetRecord(env, user, {
              id: assetId,
              name: `Generated clip ${new Date().toLocaleDateString("en-GB")}.mp4`,
              contentType: "video/mp4",
              size: storedVideo?.size || 0,
              r2Key,
            });
          }
          if (!asset) throw new Error("Generated video metadata is missing");
          await env.DB.prepare(
            `
            UPDATE generation_jobs
            SET status = 'completed', progress = 100, result_asset_id = ?,
                finalizing_at = NULL, updated_at = ?
            WHERE id = ? AND owner_email = ? AND result_asset_id IS NULL
          `
          )
            .bind(asset.id, now, id, user.email)
            .run();
        } catch (cause) {
          await env.DB.prepare(
            `
            UPDATE generation_jobs
            SET finalizing_at = NULL, status = 'in_progress', progress = 90,
                updated_at = ?
            WHERE id = ? AND owner_email = ? AND result_asset_id IS NULL
          `
          )
            .bind(new Date().toISOString(), id, user.email)
            .run();
          throw cause;
        }
      }
    } else if (
      statusPayload.status === "failed" ||
      statusPayload.status === "cancelled" ||
      statusPayload.status === "expired"
    ) {
      await env.DB.prepare(
        `
        UPDATE generation_jobs
        SET status = 'failed', progress = 100, error = ?, updated_at = ?
        WHERE id = ? AND owner_email = ?
      `
      )
        .bind(
          statusPayload.error || `Generation ${statusPayload.status}`,
          now,
          id,
          user.email
        )
        .run();
    } else {
      await env.DB.prepare(
        `
        UPDATE generation_jobs
        SET status = ?, progress = ?, updated_at = ?
        WHERE id = ? AND owner_email = ?
      `
      )
        .bind(
          statusPayload.status === "in_progress" ? "in_progress" : "pending",
          statusPayload.status === "in_progress" ? 55 : 15,
          now,
          id,
          user.email
        )
        .run();
    }
    row = await env.DB.prepare(
      "SELECT * FROM generation_jobs WHERE id = ? AND owner_email = ?"
    )
      .bind(id, user.email)
      .first<JobRow>();
  }

  const asset = row?.result_asset_id
    ? await getAssetRow(env, user, row.result_asset_id)
    : null;
  return json({
    job: jobFromRow(row as JobRow),
    ...(asset ? { asset: rowToAsset(asset) } : {}),
  });
}

async function handleVideoWebhook(
  request: Request,
  env: SitesEnvironment,
  url: URL
): Promise<Response> {
  if (request.method !== "POST" || !env.OPENROUTER_API_KEY) {
    return errorResponse("Webhook unavailable", 404);
  }
  const token = url.searchParams.get("token") || "";
  const expected = await videoWebhookToken(env.OPENROUTER_API_KEY);
  if (!constantTimeEqual(token, expected)) {
    return errorResponse("Webhook unavailable", 404);
  }
  const rawBody = new TextDecoder().decode(
    await readBoundedBody(request, MAX_WORKSPACE_BYTES)
  );
  if (
    env.OPENROUTER_WEBHOOK_SECRET &&
    !(await verifyOpenRouterWebhook(
      rawBody,
      request.headers.get("x-openrouter-signature"),
      env.OPENROUTER_WEBHOOK_SECRET
    ))
  ) {
    return errorResponse("Webhook signature is invalid", 401);
  }
  let payload: { data?: { id?: string } };
  try {
    payload = JSON.parse(rawBody) as { data?: { id?: string } };
  } catch {
    return errorResponse("Webhook body is invalid");
  }
  const providerJobId = stringValue(payload.data?.id);
  if (!providerJobId) return errorResponse("Webhook job id is missing");
  await initializeSchema(env);
  const requestId = stringValue(url.searchParams.get("requestId"));
  let row = requestId
    ? await env.DB.prepare("SELECT * FROM generation_jobs WHERE id = ?")
        .bind(requestId)
        .first<JobRow>()
    : null;
  if (row && row.provider_job_id && row.provider_job_id !== providerJobId) {
    return errorResponse("Webhook job mismatch", 409);
  }
  if (row && !row.provider_job_id) {
    await env.DB.prepare(
      `
      UPDATE generation_jobs
      SET provider_job_id = ?, status = 'in_progress', progress = 90,
          error = NULL, updated_at = ?
      WHERE id = ? AND provider_job_id IS NULL
    `
    )
      .bind(providerJobId, new Date().toISOString(), row.id)
      .run();
    row = await env.DB.prepare("SELECT * FROM generation_jobs WHERE id = ?")
      .bind(row.id)
      .first<JobRow>();
  }
  if (!row) {
    row = await env.DB.prepare(
      "SELECT * FROM generation_jobs WHERE provider_job_id = ?"
    )
      .bind(providerJobId)
      .first<JobRow>();
  }
  if (!row) return json({ ok: true }, 202);

  const user: AuthenticatedUser = {
    email: row.owner_email,
    name: nameFromEmail(row.owner_email),
  };
  const jobUrl = new URL(
    `/api/video/jobs/${encodeURIComponent(row.id)}`,
    url.origin
  );
  const result = await handleVideoJobs(
    new Request(jobUrl, { method: "GET" }),
    env,
    user,
    jobUrl
  );
  if (!result.ok) {
    return errorResponse("Video finalization will be retried", 503);
  }
  return json({ ok: true });
}

const FAILED_PROVIDER_POST_STATUSES = new Set([
  "failed",
  "error",
  "rejected",
  "cancelled",
  "partial_failure",
  "partially_failed",
  "partial",
]);

function providerPostState(
  current: ScheduledPost,
  providerPost: Record<string, unknown>,
  checkedAt: string
): ScheduledPost {
  const providerStatus = stringValue(providerPost.status).toLowerCase();
  let status = current.status;
  if (FAILED_PROVIDER_POST_STATUSES.has(providerStatus)) status = "failed";
  else if (providerStatus === "published") status = "published";
  else if (providerStatus === "publishing") status = "publishing";
  else if (["scheduled", "queued", "pending"].includes(providerStatus)) {
    status = "scheduled";
  } else if (providerStatus === "draft") status = "draft";

  const platforms = Array.isArray(providerPost.platforms)
    ? providerPost.platforms
        .map(recordValue)
        .filter((value): value is Record<string, unknown> => Boolean(value))
    : [];
  const publishedUrls = Array.from(
    new Set(
      [
        stringValue(providerPost.platformPostUrl),
        ...platforms.map(platform =>
          stringValue(platform.platformPostUrl || platform.url)
        ),
      ].filter(value => value && isPublicHttpsUrl(value))
    )
  );
  const platformErrors = platforms
    .map(platform => {
      const direct = stringValue(platform.error || platform.message);
      const nested = recordValue(platform.error);
      return direct || stringValue(nested?.message);
    })
    .filter(Boolean);
  const failureReason =
    stringValue(providerPost.error || providerPost.message) ||
    platformErrors.join("; ");
  const reportedPublishedAt = stringValue(
    providerPost.publishedAt || providerPost.updatedAt
  );
  const publishedAt =
    status === "published"
      ? Number.isFinite(new Date(reportedPublishedAt).getTime())
        ? new Date(reportedPublishedAt).toISOString()
        : current.publishedAt || checkedAt
      : current.publishedAt;

  return {
    ...current,
    status,
    providerStatus: providerStatus || "unknown",
    statusCheckedAt: checkedAt,
    publishedAt,
    publishedUrls: publishedUrls.length ? publishedUrls : undefined,
    failureReason:
      status === "failed"
        ? failureReason ||
          "The publishing provider reported a delivery failure."
        : undefined,
  };
}

async function reconcilePublishingStatuses(
  env: SitesEnvironment,
  user: AuthenticatedUser
): Promise<{
  workspace: WorkspaceDocument;
  checked: number;
  changed: number;
  warning?: string;
}> {
  const initialWorkspace = await getWorkspace(env, user);
  const candidates = initialWorkspace.posts
    .filter(
      post =>
        post.providerPostId &&
        post.status !== "draft" &&
        post.status !== "published"
    )
    .slice(0, 30);
  if (!candidates.length) {
    return { workspace: initialWorkspace, checked: 0, changed: 0 };
  }

  const updates = new Map<string, ScheduledPost>();
  let failures = 0;
  for (let offset = 0; offset < candidates.length; offset += 5) {
    const batch = candidates.slice(offset, offset + 5);
    const results = await Promise.all(
      batch.map(async post => {
        try {
          const payload = await zernioRequest(
            env,
            `/posts/${encodeURIComponent(post.providerPostId as string)}`
          );
          const data = nestedData(payload);
          const providerPost = recordValue(data.post) || data;
          return providerPostState(
            post,
            providerPost,
            new Date().toISOString()
          );
        } catch {
          return null;
        }
      })
    );
    results.forEach((result, index) => {
      if (result) updates.set(batch[index].id, result);
      else failures += 1;
    });
  }

  if (!updates.size) {
    return {
      workspace: initialWorkspace,
      checked: 0,
      changed: 0,
      warning: "The provider could not refresh publication statuses right now.",
    };
  }

  const changed = Array.from(updates.values()).filter(post => {
    const before = initialWorkspace.posts.find(item => item.id === post.id);
    return (
      before?.status !== post.status ||
      before?.providerStatus !== post.providerStatus ||
      before?.publishedAt !== post.publishedAt
    );
  }).length;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const workspace = await getWorkspace(env, user);
    const transitions: WorkspaceEvent[] = [];
    workspace.posts = workspace.posts.map(current => {
      const update = updates.get(current.id);
      if (!update || update.providerPostId !== current.providerPostId) {
        return current;
      }
      if (current.status !== update.status) {
        transitions.push({
          id: crypto.randomUUID(),
          type: "publish",
          label:
            update.status === "published"
              ? "Publication confirmed live"
              : update.status === "failed"
                ? "Publication delivery failed"
                : "Publication status updated",
          detail:
            update.failureReason || `${current.status} → ${update.status}`,
          createdAt: update.statusCheckedAt || new Date().toISOString(),
        });
      }
      return {
        ...current,
        status: update.status,
        providerStatus: update.providerStatus,
        statusCheckedAt: update.statusCheckedAt,
        publishedAt: update.publishedAt,
        publishedUrls: update.publishedUrls,
        failureReason: update.failureReason,
      };
    });
    if (transitions.length) {
      workspace.activity = [...transitions, ...workspace.activity].slice(
        0,
        100
      );
    }
    try {
      const saved = await saveWorkspace(env, user, workspace);
      return {
        workspace: saved,
        checked: updates.size,
        changed,
        ...(failures
          ? {
              warning: `${failures} publication ${
                failures === 1 ? "status was" : "statuses were"
              } not available from the provider.`,
            }
          : {}),
      };
    } catch (cause) {
      if (cause instanceof Response && cause.status === 409) continue;
      throw cause;
    }
  }
  throw errorResponse(
    "The workspace kept changing while publication statuses were refreshed",
    409
  );
}

async function handlePublishing(
  request: Request,
  env: SitesEnvironment,
  user: AuthenticatedUser,
  url: URL
): Promise<Response> {
  if (url.pathname === "/api/publishing/callback" && request.method === "GET") {
    const platform = url.searchParams.get("platform") || "account";
    return Response.redirect(
      `${url.origin}/#/dashboard/social?connected=${encodeURIComponent(platform)}`,
      302
    );
  }

  await initializeSchema(env);

  if (
    url.pathname === "/api/publishing/posts/reconcile" &&
    request.method === "POST"
  ) {
    return json(await reconcilePublishingStatuses(env, user));
  }

  if (url.pathname === "/api/publishing/accounts" && request.method === "GET") {
    return json({
      accounts: await listZernioAccounts(env, user),
      configured: true,
    });
  }

  if (url.pathname === "/api/publishing/connect" && request.method === "POST") {
    const input = await parseJsonBody<{ platform?: string }>(request);
    const platform =
      stringValue(input.platform).toLowerCase() === "x"
        ? "twitter"
        : stringValue(input.platform).toLowerCase();
    if (!ZERNIO_PLATFORMS.has(platform)) {
      return errorResponse("That publishing platform is not supported yet");
    }
    const profileId = await ensureZernioProfile(env, user);
    const redirectUrl = `${url.origin}/api/publishing/callback?platform=${encodeURIComponent(
      platform
    )}`;
    const payload = await zernioRequest(
      env,
      `/connect/${encodeURIComponent(platform)}?profileId=${encodeURIComponent(
        profileId
      )}&redirect_url=${encodeURIComponent(redirectUrl)}`
    );
    const data = nestedData(payload);
    const authUrl = stringValue(data.authUrl || data.url);
    if (!authUrl || !isPublicHttpsUrl(authUrl)) {
      return errorResponse("Zernio did not return a safe connection URL", 502);
    }
    return json({ authUrl });
  }

  const accountMatch = /^\/api\/publishing\/accounts\/([^/]+)$/.exec(
    url.pathname
  );
  if (accountMatch && request.method === "DELETE") {
    const accountId = decodeURIComponent(accountMatch[1]);
    const accounts = await listZernioAccounts(env, user);
    if (!accounts.some(account => account.id === accountId)) {
      return errorResponse("Connected account not found", 404);
    }
    await zernioRequest(env, `/accounts/${encodeURIComponent(accountId)}`, {
      method: "DELETE",
    });
    return json({ ok: true });
  }

  if (url.pathname === "/api/publishing/posts" && request.method === "POST") {
    const input = await parseJsonBody<{
      post?: ScheduledPost;
      publishNow?: boolean;
    }>(request);
    if (!input.post || !stringValue(input.post.caption)) {
      return errorResponse("Write a caption before publishing");
    }
    const publishNow = input.publishNow === true;
    const intentId = stringValue(input.post.id);
    if (!/^[A-Za-z0-9_-]{8,140}$/.test(intentId)) {
      return errorResponse("A stable publication id is required");
    }
    const intentRequest = JSON.stringify({
      caption: input.post.caption.trim(),
      hashtags: input.post.hashtags,
      mediaAssetId: input.post.mediaAssetId || null,
      accountIds: input.post.accountIds,
      scheduledAt: input.post.scheduledAt || null,
      publishNow,
    });
    const intentCreatedAt = new Date().toISOString();
    let intent = await env.DB.prepare(
      "SELECT * FROM publishing_intents WHERE id = ?"
    )
      .bind(intentId)
      .first<PublishingIntentRow>();
    if (intent && intent.owner_email !== user.email) {
      return errorResponse("That publication id is already in use", 409);
    }
    if (intent && intent.request_json !== intentRequest) {
      return errorResponse(
        "This publication id is bound to different content",
        409
      );
    }
    const ambiguousIntent =
      intent &&
      !intent.provider_response &&
      ["provider_calling", "confirmation_pending"].includes(intent.status);
    const ambiguousUpdatedAt = intent
      ? new Date(intent.updated_at).getTime()
      : Number.NaN;
    const canSafelyRetryAmbiguousIntent = Boolean(
      ambiguousIntent &&
      Number.isFinite(ambiguousUpdatedAt) &&
      Date.now() - ambiguousUpdatedAt >= 0 &&
      Date.now() - ambiguousUpdatedAt < 4 * 60 * 1000
    );
    if (ambiguousIntent && !canSafelyRetryAmbiguousIntent) {
      return json(
        {
          post: {
            ...input.post,
            status: "publishing" as const,
          },
          warning:
            "The provider outcome is still unconfirmed, so this durable intent is locked to prevent a duplicate publication. Verify the post in Zernio before replacing it.",
        },
        202
      );
    }

    let selected: PublishingAccount[];
    let content = "";
    if (
      intent?.provider_response ||
      (canSafelyRetryAmbiguousIntent && intent?.provider_request)
    ) {
      const fallbackPlatform =
        input.post.platforms
          .map(platform => knownPlatform(platform))
          .find((platform): platform is Platform => Boolean(platform)) ||
        "tiktok";
      selected = input.post.accountIds.map((id, index) => ({
        id,
        providerId: id,
        platform: fallbackPlatform,
        accountName: `Destination ${index + 1}`,
        status: "connected",
      }));
    } else {
      if (!publishNow && !input.post.scheduledAt) {
        return errorResponse("Choose a schedule date and time");
      }
      if (!publishNow && input.post.scheduledAt) {
        const scheduleTime = new Date(input.post.scheduledAt).getTime();
        if (
          !Number.isFinite(scheduleTime) ||
          (scheduleTime <= Date.now() && !canSafelyRetryAmbiguousIntent)
        ) {
          return errorResponse("Choose a valid future schedule date and time");
        }
      }
      const accounts = await listZernioAccounts(env, user);
      const byId = new Map(accounts.map(account => [account.id, account]));
      selected = input.post.accountIds
        .map(id => byId.get(id))
        .filter((account): account is PublishingAccount => Boolean(account));
      if (!selected.length) return errorResponse("Choose a connected account");
      if (selected.length !== input.post.accountIds.length) {
        return errorResponse(
          "One or more publishing accounts no longer belong to this profile"
        );
      }
      const hashtagText = input.post.hashtags
        .map(tag => `#${tag.replace(/^#/, "")}`)
        .join(" ");
      content = [input.post.caption.trim(), hashtagText]
        .filter(Boolean)
        .join("\n\n");
    }

    if (!intent) {
      await env.DB.prepare(
        `
        INSERT INTO publishing_intents
          (id, owner_email, request_json, provider_request, provider_response,
           status, submitting_at, error, created_at, updated_at)
        VALUES (?, ?, ?, NULL, NULL, 'pending', NULL, NULL, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `
      )
        .bind(
          intentId,
          user.email,
          intentRequest,
          intentCreatedAt,
          intentCreatedAt
        )
        .run();
      intent = await env.DB.prepare(
        "SELECT * FROM publishing_intents WHERE id = ?"
      )
        .bind(intentId)
        .first<PublishingIntentRow>();
      if (!intent || intent.owner_email !== user.email) {
        return errorResponse("That publication id is already in use", 409);
      }
      if (intent.request_json !== intentRequest) {
        return errorResponse(
          "This publication id is bound to different content",
          409
        );
      }
    }

    let payload: Record<string, unknown>;
    if (intent.provider_response) {
      payload = JSON.parse(intent.provider_response) as Record<string, unknown>;
    } else {
      const submissionCutoff = new Date(
        Date.now() - 2 * 60 * 1000
      ).toISOString();
      const providerRetryCutoff = new Date(
        Date.now() - 4 * 60 * 1000
      ).toISOString();
      const submission = await env.DB.prepare(
        `
        UPDATE publishing_intents
        SET submitting_at = ?, status = 'preparing', error = NULL,
            updated_at = ?
        WHERE id = ? AND owner_email = ? AND provider_response IS NULL
          AND (
            (
              status IN ('pending', 'preparing', 'submitting')
              AND (submitting_at IS NULL OR submitting_at < ?)
            )
            OR (
              status IN ('provider_calling', 'confirmation_pending')
              AND updated_at > ?
            )
          )
      `
      )
        .bind(
          intentCreatedAt,
          intentCreatedAt,
          intentId,
          user.email,
          submissionCutoff,
          providerRetryCutoff
        )
        .run();
      if ((submission.meta?.changes || 0) !== 1) {
        return errorResponse(
          "This publication is already being submitted. Wait for its result before retrying.",
          409
        );
      }

      let providerCallStarted = false;
      try {
        let providerRequest = intent.provider_request;
        if (!providerRequest) {
          const mediaItems: Array<{ type: "image" | "video"; url: string }> =
            [];
          if (input.post.mediaAssetId) {
            const media = await getAssetRow(env, user, input.post.mediaAssetId);
            if (!media) {
              throw errorResponse(
                "The selected media asset was not found",
                404
              );
            }
            const mediaType = media.content_type.startsWith("image/")
              ? "image"
              : media.content_type.startsWith("video/")
                ? "video"
                : null;
            if (!mediaType) {
              throw errorResponse(
                "Zernio publishing accepts an image or video asset"
              );
            }
            if (
              !publishNow &&
              input.post.scheduledAt &&
              new Date(input.post.scheduledAt).getTime() - Date.now() >
                6 * 24 * 60 * 60 * 1000
            ) {
              throw errorResponse(
                "Media uploads are temporary until publication; schedule this media post within 6 days"
              );
            }
            const presign = await zernioRequest(env, "/media/presign", {
              method: "POST",
              body: JSON.stringify({
                filename: sanitizeFilename(media.name),
                contentType: media.content_type,
              }),
            });
            const presignData = nestedData(presign);
            const uploadUrl = stringValue(presignData.uploadUrl);
            const publicUrl = stringValue(presignData.publicUrl);
            if (!isPublicHttpsUrl(uploadUrl) || !isPublicHttpsUrl(publicUrl)) {
              throw errorResponse(
                "Zernio returned an invalid media upload URL",
                502
              );
            }
            const object = await env.BUCKET.get(media.r2_key);
            if (!object) {
              throw errorResponse("The selected media bytes are missing", 404);
            }
            const uploadResponse = await fetch(uploadUrl, {
              method: "PUT",
              redirect: "error",
              headers: {
                "Content-Type": media.content_type,
                "Content-Length": String(media.bytes),
              },
              body: object.body,
            });
            if (!uploadResponse.ok) {
              throw errorResponse(
                "Zernio could not receive the selected media",
                502
              );
            }
            mediaItems.push({ type: mediaType, url: publicUrl });
          }
          providerRequest = JSON.stringify({
            content,
            platforms: selected.map(account => ({
              platform: account.platform,
              accountId: account.providerId,
            })),
            ...(mediaItems.length ? { mediaItems } : {}),
            ...(publishNow
              ? { publishNow: true }
              : {
                  scheduledFor: input.post.scheduledAt,
                  timezone: (await getWorkspace(env, user)).profile.timezone,
                }),
          });
        }
        await env.DB.prepare(
          `
          UPDATE publishing_intents
          SET provider_request = ?, status = 'provider_calling', updated_at = ?
          WHERE id = ? AND owner_email = ? AND provider_response IS NULL
        `
        )
          .bind(providerRequest, new Date().toISOString(), intentId, user.email)
          .run();
        providerCallStarted = true;
        payload = await submitZernioPost(env, intentId, providerRequest);
        await env.DB.prepare(
          `
          UPDATE publishing_intents
          SET provider_response = ?, status = 'accepted',
              submitting_at = NULL, error = NULL, updated_at = ?
          WHERE id = ? AND owner_email = ?
        `
        )
          .bind(
            JSON.stringify(payload),
            new Date().toISOString(),
            intentId,
            user.email
          )
          .run();
      } catch (cause) {
        const ambiguousFailure =
          providerCallStarted && isAmbiguousProviderFailure(cause);
        if (!providerCallStarted || !ambiguousFailure) {
          await env.DB.prepare(
            `
            UPDATE publishing_intents
            SET status = 'pending', submitting_at = NULL, error = ?,
                updated_at = ?
            WHERE id = ? AND owner_email = ? AND provider_response IS NULL
          `
          )
            .bind(
              cause instanceof Error ? cause.message : "Submission failed",
              new Date().toISOString(),
              intentId,
              user.email
            )
            .run();
        }
        if (ambiguousFailure) {
          await env.DB.prepare(
            `
            UPDATE publishing_intents
            SET status = 'confirmation_pending', submitting_at = NULL,
                error = ?, updated_at = ?
            WHERE id = ? AND owner_email = ? AND provider_response IS NULL
          `
          )
            .bind(
              cause instanceof Error
                ? cause.message
                : "The provider outcome is unconfirmed",
              new Date().toISOString(),
              intentId,
              user.email
            )
            .run()
            .catch(() => undefined);
          return json(
            {
              post: {
                ...input.post,
                status: "publishing" as const,
              },
              warning:
                "The provider outcome is unconfirmed. Retry this unchanged composer now: the same request identifier will recover the accepted post without duplicating it.",
            },
            202
          );
        }
        throw cause;
      }
      intent = await env.DB.prepare(
        "SELECT * FROM publishing_intents WHERE id = ?"
      )
        .bind(intentId)
        .first<PublishingIntentRow>();
      if (!intent?.provider_response) {
        return errorResponse(
          "The provider accepted the request, but its result is still being reconciled",
          503
        );
      }
    }
    const postData = nestedData(payload);
    const providerPost =
      recordValue(postData.post) ||
      recordValue(postData.existingPost) ||
      postData;
    const now = new Date().toISOString();
    const providerStatus = stringValue(providerPost.status).toLowerCase();
    const providerFailed = FAILED_PROVIDER_POST_STATUSES.has(providerStatus);
    const acceptedStatus: ScheduledPost["status"] = providerFailed
      ? "failed"
      : providerStatus === "published"
        ? "published"
        : !publishNow &&
            ["scheduled", "queued", "pending"].includes(providerStatus)
          ? "scheduled"
          : "publishing";
    const post = providerPostState(
      {
        ...input.post,
        providerPostId:
          stringValue(providerPost._id || providerPost.id) || undefined,
        status: acceptedStatus,
        ...(acceptedStatus === "published" ? { publishedAt: now } : {}),
      },
      providerPost,
      now
    );
    const publishEvent: WorkspaceEvent = {
      id: crypto.randomUUID(),
      type: "publish",
      label:
        acceptedStatus === "failed"
          ? "Publication failed or partially delivered"
          : publishNow
            ? "Publication submitted"
            : acceptedStatus === "scheduled"
              ? "Publication scheduled"
              : "Schedule request submitted",
      detail:
        acceptedStatus === "failed"
          ? `Provider status: ${providerStatus || "failed"}`
          : selected.map(account => account.accountName).join(", "),
      createdAt: now,
    };
    let savedWorkspace: WorkspaceDocument | undefined;
    let synchronizationError: string | undefined;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const workspace = await getWorkspace(env, user);
      workspace.posts = [
        post,
        ...workspace.posts.filter(existing => existing.id !== post.id),
      ];
      workspace.activity = [
        publishEvent,
        ...workspace.activity.filter(event => event.id !== publishEvent.id),
      ].slice(0, 100);
      try {
        savedWorkspace = await saveWorkspace(env, user, workspace);
        break;
      } catch (cause) {
        if (cause instanceof Response && cause.status === 409) continue;
        synchronizationError =
          cause instanceof Error
            ? cause.message
            : "The accepted publication could not be added to the workspace queue";
        break;
      }
    }
    if (!savedWorkspace) {
      await env.DB.prepare(
        `
        UPDATE publishing_intents
        SET status = 'accepted_sync_pending', error = ?, updated_at = ?
        WHERE id = ? AND owner_email = ?
      `
      )
        .bind(
          synchronizationError ||
            "Workspace changed repeatedly while recording the accepted publication",
          new Date().toISOString(),
          intentId,
          user.email
        )
        .run()
        .catch(() => undefined);
      return json(
        {
          post,
          warning:
            "The provider accepted the publication. Its durable delivery intent is saved, while the workspace queue waits to synchronize.",
        },
        202
      );
    }
    await env.DB.prepare(
      `
      UPDATE publishing_intents
      SET status = 'completed', error = NULL, updated_at = ?
      WHERE id = ? AND owner_email = ?
    `
    )
      .bind(new Date().toISOString(), intentId, user.email)
      .run()
      .catch(() => undefined);
    return json({ post, workspace: savedWorkspace }, 201);
  }

  return errorResponse("Publishing route not found", 404);
}

function referralDollarValue(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

function referralCodeCandidate(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `REEL-${Array.from(bytes, byte => byte.toString(36).padStart(2, "0"))
    .join("")
    .toUpperCase()
    .slice(0, 9)}`;
}

function maskReferralEmail(email: string): string {
  const [local = "creator", domain = "private"] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${local.length > 2 ? "•••" : "•"}@${domain}`;
}

async function ensureReferralCode(
  env: SitesEnvironment,
  user: AuthenticatedUser
): Promise<ReferralCodeRow> {
  await initializeSchema(env);
  const existing = await env.DB.prepare(
    "SELECT owner_email, code, created_at FROM referral_codes WHERE owner_email = ?"
  )
    .bind(user.email)
    .first<ReferralCodeRow>();
  if (existing) return existing;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = referralCodeCandidate();
    const createdAt = new Date().toISOString();
    const inserted = await env.DB.prepare(
      "INSERT OR IGNORE INTO referral_codes (owner_email, code, created_at) VALUES (?, ?, ?)"
    )
      .bind(user.email, code, createdAt)
      .run();
    if ((inserted.meta?.changes || 0) > 0) {
      return { owner_email: user.email, code, created_at: createdAt };
    }
    const raced = await env.DB.prepare(
      "SELECT owner_email, code, created_at FROM referral_codes WHERE owner_email = ?"
    )
      .bind(user.email)
      .first<ReferralCodeRow>();
    if (raced) return raced;
  }
  throw new Error("A unique referral code could not be created");
}

async function referralStats(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  url: URL
): Promise<Response> {
  const referralCode = await ensureReferralCode(env, user);
  const result = await env.DB.prepare(
    `
      SELECT id, referral_code, referrer_email, referred_email,
             status, credits_awarded, value_cents, qualified_at,
             payment_event_id, plan_id, created_at
      FROM referral_claims
      WHERE referrer_email = ?
      ORDER BY created_at DESC
      LIMIT 100
    `
  )
    .bind(user.email)
    .all<ReferralClaimRow>();
  const verifiedClaims = result.results.filter(
    claim => claim.status === "verified"
  );
  const creditsEarned = verifiedClaims.reduce(
    (sum, claim) => sum + Math.max(0, claim.credits_awarded),
    0
  );
  const valueCents = verifiedClaims.reduce(
    (sum, claim) => sum + Math.max(0, claim.value_cents),
    0
  );
  const shareUrl = new URL("/", url.origin);
  shareUrl.searchParams.set("ref", referralCode.code);
  return json({
    code: referralCode.code,
    shareUrl: shareUrl.toString(),
    completedReferrals: verifiedClaims.length,
    pendingReferrals: result.results.length - verifiedClaims.length,
    creditsEarned,
    dollarValue: referralDollarValue(valueCents),
    rewardCredits: REFERRAL_REWARD_CREDITS,
    rewardDollarValue: referralDollarValue(REFERRAL_REWARD_CENTS),
    referrals: result.results.map(claim => ({
      id: claim.id,
      referredDisplay: maskReferralEmail(claim.referred_email),
      status: claim.status,
      creditsAwarded: claim.credits_awarded,
      dollarValue: referralDollarValue(claim.value_cents),
      qualifiedAt: claim.qualified_at,
      planId: claim.plan_id,
      createdAt: claim.created_at,
    })),
  });
}

async function claimReferral(
  request: Request,
  env: SitesEnvironment,
  user: AuthenticatedUser
): Promise<Response> {
  await initializeSchema(env);
  const input = await parseJsonBody<{ code?: string }>(request);
  const code = stringValue(input.code).trim().toUpperCase();
  if (!/^REEL-[A-Z0-9]{6,12}$/.test(code)) {
    return errorResponse("Enter a valid REELassati referral code");
  }
  const referral = await env.DB.prepare(
    "SELECT owner_email, code, created_at FROM referral_codes WHERE code = ?"
  )
    .bind(code)
    .first<ReferralCodeRow>();
  if (!referral) return errorResponse("Referral code not found", 404);
  if (referral.owner_email === user.email) {
    return errorResponse("You cannot use your own referral link", 409);
  }

  const existing = await env.DB.prepare(
    `
      SELECT id, referral_code, referrer_email, referred_email,
             status, credits_awarded, value_cents, qualified_at,
             payment_event_id, plan_id, created_at
      FROM referral_claims
      WHERE referred_email = ?
    `
  )
    .bind(user.email)
    .first<ReferralClaimRow>();
  if (existing) {
    if (existing.referral_code !== code) {
      return errorResponse(
        "This account has already joined through another creator",
        409
      );
    }
    return json({
      success: true,
      alreadyClaimed: true,
      status: existing.status,
      creditsAwarded: existing.credits_awarded,
      dollarValue: referralDollarValue(existing.value_cents),
    });
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  try {
    await env.DB.prepare(
      `
        INSERT INTO referral_claims (
          id, referral_code, referrer_email, referred_email,
          status, credits_awarded, value_cents, created_at
        ) VALUES (?, ?, ?, ?, 'pending', 0, 0, ?)
      `
    )
      .bind(
        id,
        code,
        referral.owner_email,
        user.email,
        createdAt
      )
      .run();
  } catch {
    const raced = await env.DB.prepare(
      `
        SELECT id, referral_code, referrer_email, referred_email,
               status, credits_awarded, value_cents, qualified_at,
               payment_event_id, plan_id, created_at
        FROM referral_claims
        WHERE referred_email = ?
      `
    )
      .bind(user.email)
      .first<ReferralClaimRow>();
    if (!raced || raced.referral_code !== code) {
      return errorResponse(
        "This account has already joined through another creator",
        409
      );
    }
    return json({
      success: true,
      alreadyClaimed: true,
      status: raced.status,
      creditsAwarded: raced.credits_awarded,
      dollarValue: referralDollarValue(raced.value_cents),
    });
  }

  return json(
    {
      success: true,
      alreadyClaimed: false,
      status: "pending",
      creditsAwarded: 0,
      dollarValue: referralDollarValue(0),
    },
    201
  );
}

async function handleApi(
  request: Request,
  env: SitesEnvironment,
  url: URL
): Promise<Response> {
  if (url.pathname === "/api/health") {
    return json({
      ok: true,
      storage: { d1: Boolean(env.DB), r2: Boolean(env.BUCKET) },
    });
  }

  if (url.pathname === "/api/video/webhook") {
    return handleVideoWebhook(request, env, url);
  }

  const user = getUser(request);
  if (!user) {
    return errorResponse(
      "Open this private studio from your authenticated ChatGPT workspace",
      401
    );
  }

  if (
    (url.pathname === "/api/session" || url.pathname === "/api/auth/me") &&
    request.method === "GET"
  ) {
    return json({
      user: { email: user.email, name: user.name, role: "owner" },
      capabilities: capabilities(env),
    });
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    return json({ ok: true });
  }

  if (url.pathname === "/api/capabilities" && request.method === "GET") {
    return json({ capabilities: capabilities(env) });
  }

  if (url.pathname === "/api/referrals" && request.method === "GET") {
    return referralStats(env, user, url);
  }

  if (url.pathname === "/api/referrals/claim" && request.method === "POST") {
    return claimReferral(request, env, user);
  }

  if (url.pathname === "/api/workspace") {
    if (request.method === "GET") {
      return json({
        workspace: await getWorkspace(env, user),
        capabilities: capabilities(env),
      });
    }
    if (request.method === "PUT") {
      const body = await parseJsonBody<{ workspace?: unknown }>(request);
      if (!recordValue(body.workspace)) {
        return errorResponse("A complete workspace document is required");
      }
      return json({
        workspace: await saveWorkspace(env, user, body.workspace),
      });
    }
    return errorResponse("Method not allowed", 405);
  }

  if (
    url.pathname === "/api/assets" ||
    url.pathname.startsWith("/api/assets/")
  ) {
    return handleAssets(request, env, user, url);
  }

  if (url.pathname.startsWith("/api/ai/")) {
    return handleAi(request, env, user, url);
  }

  if (
    url.pathname === "/api/video/jobs" ||
    url.pathname.startsWith("/api/video/jobs/")
  ) {
    return handleVideoJobs(request, env, user, url);
  }

  if (url.pathname.startsWith("/api/publishing/")) {
    return handlePublishing(request, env, user, url);
  }

  return errorResponse("API route not found", 404);
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), geolocation=(), payment=()");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: SitesEnvironment): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      try {
        return withSecurityHeaders(await handleApi(request, env, url));
      } catch (cause) {
        if (cause instanceof Response) return withSecurityHeaders(cause);
        const message =
          cause instanceof Error ? cause.message : "Unexpected server error";
        return withSecurityHeaders(errorResponse(message, 500));
      }
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404 || request.method !== "GET") {
      return withSecurityHeaders(assetResponse);
    }

    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (!acceptsHtml) {
      return withSecurityHeaders(assetResponse);
    }

    const indexUrl = new URL("/index.html", url);
    return withSecurityHeaders(
      await env.ASSETS.fetch(new Request(indexUrl, request))
    );
  },
};
