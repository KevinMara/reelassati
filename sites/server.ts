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
  type TranscriptSegment,
  type WorkspaceDocument,
  type WorkspaceEvent,
} from "../contracts/workspace";
import {
  AI_COMPLIANCE_POLICY_VERSION,
  AI_PROVENANCE_SCHEME,
  appendTextProvenanceMarker,
  extractTextProvenanceToken,
  requiredDisclosureText,
  withoutTextProvenanceMarker,
  type AiOperation,
  type ComplianceStatus,
  type ContentOrigin,
  type ContentProvenance,
  type MarkingStatus,
  type PublicationComplianceReview,
  type ProvenanceDetectionResult,
} from "../contracts/compliance";
import {
  embedMediaProvenanceMarker,
  inspectMediaProvenanceMarker,
} from "./media-provenance";

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
  customMetadata?: Record<string, string>;
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
  KIMI_TEST_MODE?: string;
  KIMI_TEST_OWNER_EMAIL?: string;
  KIMI_CODE_API_KEY?: string;
  KIMI_CODE_MODEL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_TEXT_MODEL?: string;
  OPENROUTER_ANALYSIS_MODEL?: string;
  OPENROUTER_STT_MODEL?: string;
  OPENROUTER_TTS_MODEL?: string;
  OPENROUTER_TTS_VOICE?: string;
  OPENROUTER_VIDEO_MODEL?: string;
  OPENROUTER_WEBHOOK_SECRET?: string;
  ZERNIO_API_KEY?: string;
  AI_PROVENANCE_SIGNING_KEY?: string;
  AI_PROVENANCE_SIGNING_KEY_ID?: string;
  AI_PROVENANCE_VERIFICATION_KEYS_JSON?: string;
  AI_MARKING_VALIDATION_STATUS?: string;
  AI_PROVIDER_EVIDENCE_STATUS?: string;
  AI_LEGAL_REVIEW_STATUS?: string;
  AI_INCIDENT_OPERATIONS_STATUS?: string;
  AI_PROVENANCE_LIFECYCLE_STATUS?: string;
  COMPLIANCE_OPERATOR_OWNER_EMAIL?: string;
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

interface ProvenanceRow {
  id: string;
  public_token: string;
  owner_email: string;
  entity_type: string;
  entity_id: string;
  origin: ContentOrigin;
  operation: AiOperation;
  provider: string;
  model: string;
  policy_version: string;
  signing_key_id: string;
  marking_method: ContentProvenance["marking"]["method"];
  marking_status: MarkingStatus;
  content_sha256: string | null;
  metadata_json: string;
  created_at: string;
  deleted_at: string | null;
}

interface OperatorComplianceRow {
  owner_email: string;
  legal_name: string | null;
  entity_type: string | null;
  release_status: "private-testing" | "closed-beta" | "public" | null;
  first_eu_availability_date: string | null;
  creative_scope_confirmed_at: string | null;
  ai_literacy_acknowledged_at: string | null;
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
const KIMI_CODE_BASE = "https://api.kimi.com/coding/v1";
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
const PROVENANCE_ENTITY_TYPES = new Set([
  "asset",
  "script",
  "edit-plan",
  "analysis",
  "transcript",
  "publication",
]);

let schemaInitialization: Promise<void> | undefined;

const GENERATED_ASSET_VERIFICATION_CACHE_TTL_MS = 5 * 60 * 1000;
const GENERATED_ASSET_VERIFICATION_CACHE_LIMIT = 256;
const generatedAssetVerificationCache = new Map<string, number>();

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

function normalizedConfiguredEmail(value?: string): string {
  return stringValue(value).trim().toLowerCase();
}

function isKimiTestOwner(
  env: SitesEnvironment,
  user: AuthenticatedUser
): boolean {
  const configuredOwner = normalizedConfiguredEmail(env.KIMI_TEST_OWNER_EMAIL);
  return Boolean(
    env.KIMI_TEST_MODE === "enabled" &&
    configuredOwner &&
    configuredOwner === user.email
  );
}

function operatorOwnerEmail(env: SitesEnvironment): string | null {
  return normalizedConfiguredEmail(env.COMPLIANCE_OPERATOR_OWNER_EMAIL) || null;
}

function capabilities(
  env: SitesEnvironment,
  user: AuthenticatedUser
): CapabilityState {
  const missing: string[] = [];
  const useKimiSubscription = isKimiTestOwner(env, user);
  const provenanceReady = Boolean(
    env.AI_PROVENANCE_SIGNING_KEY && env.AI_PROVENANCE_SIGNING_KEY.length >= 24
  );
  if (useKimiSubscription && !env.KIMI_CODE_API_KEY) {
    missing.push("KIMI_CODE_API_KEY");
  }
  if (!env.OPENROUTER_API_KEY) missing.push("OPENROUTER_API_KEY");
  if (!env.ZERNIO_API_KEY) missing.push("ZERNIO_API_KEY");
  if (!provenanceReady) missing.push("AI_PROVENANCE_SIGNING_KEY");

  return {
    persistence: Boolean(env.DB),
    uploads: Boolean(env.BUCKET),
    ai:
      provenanceReady &&
      (useKimiSubscription
        ? Boolean(env.KIMI_CODE_API_KEY)
        : Boolean(env.OPENROUTER_API_KEY)),
    analysis: Boolean(env.OPENROUTER_API_KEY && provenanceReady),
    transcription: Boolean(
      env.OPENROUTER_API_KEY && env.BUCKET && provenanceReady
    ),
    speech: Boolean(env.OPENROUTER_API_KEY && env.BUCKET && provenanceReady),
    videoGeneration: Boolean(
      env.OPENROUTER_API_KEY && env.BUCKET && provenanceReady
    ),
    publishing: Boolean(env.ZERNIO_API_KEY),
    missing,
    modelRoutes: [
      {
        purpose: "Text",
        provider: useKimiSubscription ? "Kimi Code" : "OpenRouter",
        model: useKimiSubscription
          ? env.KIMI_CODE_MODEL || "k3-256k"
          : env.OPENROUTER_TEXT_MODEL || "moonshotai/kimi-k2.5",
        mode: useKimiSubscription ? "owner-test" : "official",
      },
      {
        purpose: "Analysis",
        provider: "OpenRouter",
        model: env.OPENROUTER_ANALYSIS_MODEL || "google/gemini-2.5-flash",
        mode: "official",
      },
      {
        purpose: "Transcription",
        provider: "OpenRouter",
        model: env.OPENROUTER_STT_MODEL || "openai/whisper-large-v3-turbo",
        mode: "official",
      },
      {
        purpose: "Speech",
        provider: "OpenRouter",
        model: env.OPENROUTER_TTS_MODEL || "minimax/minimax-speech-02-hd",
        mode: "official",
      },
      {
        purpose: "Video",
        provider: "OpenRouter",
        model: env.OPENROUTER_VIDEO_MODEL || "kwaivgi/kling-v3.0-standard",
        mode: "official",
      },
    ],
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
          CREATE TABLE IF NOT EXISTS ai_provenance_records (
            id TEXT PRIMARY KEY NOT NULL,
            public_token TEXT NOT NULL UNIQUE,
            owner_email TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            origin TEXT NOT NULL,
            operation TEXT NOT NULL,
            provider TEXT NOT NULL,
            model TEXT NOT NULL,
            policy_version TEXT NOT NULL,
            signing_key_id TEXT NOT NULL,
            marking_method TEXT NOT NULL,
            marking_status TEXT NOT NULL,
            content_sha256 TEXT,
            metadata_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL,
            deleted_at TEXT
          )
        `),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS ai_provenance_owner_created_idx ON ai_provenance_records (owner_email, created_at)"
      ),
      env.DB.prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS ai_provenance_owner_entity_unique ON ai_provenance_records (owner_email, entity_type, entity_id)"
      ),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS ai_provenance_sha256_idx ON ai_provenance_records (content_sha256)"
      ),
      env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS ai_invocations (
            id TEXT PRIMARY KEY NOT NULL,
            owner_email TEXT NOT NULL,
            purpose TEXT NOT NULL,
            provider TEXT NOT NULL,
            model TEXT NOT NULL,
            policy_version TEXT NOT NULL,
            input_sha256 TEXT NOT NULL,
            output_sha256 TEXT,
            status TEXT NOT NULL,
            error_code TEXT,
            created_at TEXT NOT NULL,
            completed_at TEXT
          )
        `),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS ai_invocations_owner_created_idx ON ai_invocations (owner_email, created_at)"
      ),
      env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS compliance_events (
            id TEXT PRIMARY KEY NOT NULL,
            owner_email TEXT,
            event_type TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            policy_version TEXT NOT NULL,
            details_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL
          )
        `),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS compliance_events_owner_created_idx ON compliance_events (owner_email, created_at)"
      ),
      env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS operator_compliance (
            owner_email TEXT PRIMARY KEY NOT NULL,
            legal_name TEXT,
            entity_type TEXT,
            release_status TEXT,
            first_eu_availability_date TEXT,
            creative_scope_confirmed_at TEXT,
            ai_literacy_acknowledged_at TEXT,
            updated_at TEXT NOT NULL
          )
        `),
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
        const provenanceColumns = await env.DB.prepare(
          "PRAGMA table_info(ai_provenance_records)"
        ).all<{ name: string }>();
        if (
          !provenanceColumns.results.some(
            column => column.name === "signing_key_id"
          )
        ) {
          await env.DB.prepare(
            "ALTER TABLE ai_provenance_records ADD COLUMN signing_key_id TEXT NOT NULL DEFAULT 'legacy-v1'"
          ).run();
        }
        const operatorColumns = await env.DB.prepare(
          "PRAGMA table_info(operator_compliance)"
        ).all<{ name: string }>();
        if (
          !operatorColumns.results.some(
            column => column.name === "first_eu_availability_date"
          )
        ) {
          await env.DB.prepare(
            "ALTER TABLE operator_compliance ADD COLUMN first_eu_availability_date TEXT"
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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sha256Hex(
  value: string | ArrayBuffer | Uint8Array
): Promise<string> {
  const bytes =
    typeof value === "string"
      ? new TextEncoder().encode(value)
      : value instanceof Uint8Array
        ? value
        : new Uint8Array(value);
  const stableBytes = new Uint8Array(bytes.byteLength);
  stableBytes.set(bytes);
  return bytesToHex(
    new Uint8Array(await crypto.subtle.digest("SHA-256", stableBytes.buffer))
  );
}

function activeSigningKeyId(env: SitesEnvironment): string {
  const configured = (env.AI_PROVENANCE_SIGNING_KEY_ID || "primary-v1").trim();
  return /^[A-Za-z0-9._-]{2,48}$/.test(configured) ? configured : "primary-v1";
}

function verificationKey(
  env: SitesEnvironment,
  signingKeyId: string
): string | null {
  if (signingKeyId === activeSigningKeyId(env)) {
    return env.AI_PROVENANCE_SIGNING_KEY || null;
  }
  if (!env.AI_PROVENANCE_VERIFICATION_KEYS_JSON) return null;
  try {
    const keyring = JSON.parse(
      env.AI_PROVENANCE_VERIFICATION_KEYS_JSON
    ) as Record<string, unknown>;
    const key = keyring[signingKeyId];
    return typeof key === "string" && key.length >= 24 ? key : null;
  } catch {
    return null;
  }
}

async function signProvenanceMessage(
  signingKey: string,
  message: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

async function provenanceSignature(
  env: SitesEnvironment,
  message: string,
  signingKeyId = activeSigningKeyId(env)
): Promise<string> {
  const signingKey = verificationKey(env, signingKeyId);
  if (!signingKey) {
    throw new Response(
      JSON.stringify({
        error:
          signingKeyId === activeSigningKeyId(env)
            ? "AI output marking is not configured, so generation is blocked rather than returning an unmarked output."
            : "This historical provenance record cannot currently be authenticated because its verification key is unavailable.",
        missing:
          signingKeyId === activeSigningKeyId(env)
            ? ["AI_PROVENANCE_SIGNING_KEY"]
            : ["AI_PROVENANCE_VERIFICATION_KEYS_JSON"],
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
  return signProvenanceMessage(signingKey, message);
}

function assertProvenanceConfigured(env: SitesEnvironment): void {
  if (
    !env.AI_PROVENANCE_SIGNING_KEY ||
    env.AI_PROVENANCE_SIGNING_KEY.length < 24
  ) {
    throw new Response(
      JSON.stringify({
        error:
          "AI output marking is not configured, so generation is blocked rather than returning an unmarked output.",
        missing: ["AI_PROVENANCE_SIGNING_KEY"],
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function recordComplianceEvent(
  env: SitesEnvironment,
  input: {
    ownerEmail?: string | null;
    eventType: string;
    entityType: string;
    entityId: string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  await initializeSchema(env);
  await env.DB.prepare(
    `
      INSERT INTO compliance_events
        (id, owner_email, event_type, entity_type, entity_id,
         policy_version, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      crypto.randomUUID(),
      input.ownerEmail || null,
      input.eventType,
      input.entityType,
      input.entityId,
      AI_COMPLIANCE_POLICY_VERSION,
      JSON.stringify(input.details || {}),
      new Date().toISOString()
    )
    .run();
}

interface AiInvocationContext {
  id: string;
  provider: string;
  model: string;
  purpose: AiOperation;
}

async function beginAiInvocation(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  purpose: AiOperation,
  provider: string,
  model: string,
  input: unknown
): Promise<AiInvocationContext> {
  await initializeSchema(env);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `
      INSERT INTO ai_invocations
        (id, owner_email, purpose, provider, model, policy_version,
         input_sha256, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress', ?)
    `
  )
    .bind(
      id,
      user.email,
      purpose,
      provider,
      model,
      AI_COMPLIANCE_POLICY_VERSION,
      await sha256Hex(JSON.stringify(input)),
      new Date().toISOString()
    )
    .run();
  return { id, provider, model, purpose };
}

async function completeAiInvocation(
  env: SitesEnvironment,
  invocation: AiInvocationContext,
  output: unknown
): Promise<void> {
  await env.DB.prepare(
    `
      UPDATE ai_invocations
      SET output_sha256 = ?, status = 'completed', completed_at = ?
      WHERE id = ? AND status = 'in_progress'
    `
  )
    .bind(
      await sha256Hex(
        typeof output === "string" ? output : JSON.stringify(output)
      ),
      new Date().toISOString(),
      invocation.id
    )
    .run();
}

async function failAiInvocation(
  env: SitesEnvironment,
  invocation: AiInvocationContext,
  errorCode: string
): Promise<void> {
  await env.DB.prepare(
    `
      UPDATE ai_invocations
      SET status = 'failed', error_code = ?, completed_at = ?
      WHERE id = ? AND status = 'in_progress'
    `
  )
    .bind(errorCode.slice(0, 80), new Date().toISOString(), invocation.id)
    .run()
    .catch(() => undefined);
}

function provenanceFromRow(row: ProvenanceRow): ContentProvenance {
  return {
    recordId: row.id,
    origin: row.origin,
    operation: row.operation,
    provider: row.provider,
    model: row.model,
    generatedAt: row.created_at,
    policyVersion: row.policy_version,
    marking: {
      scheme: AI_PROVENANCE_SCHEME,
      method: row.marking_method,
      status: row.marking_status,
      publicToken: row.public_token,
      detectPath: `/#/provenance?token=${encodeURIComponent(row.public_token)}`,
    },
  };
}

async function provenanceSigningMessage(
  input: Pick<
    ProvenanceRow,
    | "id"
    | "owner_email"
    | "entity_type"
    | "entity_id"
    | "origin"
    | "operation"
    | "provider"
    | "model"
    | "policy_version"
    | "signing_key_id"
    | "marking_method"
    | "content_sha256"
    | "metadata_json"
    | "created_at"
  > & { nonce: string; marking_status: MarkingStatus }
): Promise<string> {
  return JSON.stringify({
    scheme: AI_PROVENANCE_SCHEME,
    nonce: input.nonce,
    id: input.id,
    ownerEmail: input.owner_email,
    entityType: input.entity_type,
    entityId: input.entity_id,
    origin: input.origin,
    operation: input.operation,
    provider: input.provider,
    model: input.model,
    policyVersion: input.policy_version,
    signingKeyId: input.signing_key_id,
    markingMethod: input.marking_method,
    markingStatus: input.marking_status,
    contentSha256: input.content_sha256,
    metadataSha256: await sha256Hex(input.metadata_json),
    createdAt: input.created_at,
  });
}

async function createProvenanceRecord(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  input: {
    entityType: string;
    entityId: string;
    origin: ContentOrigin;
    operation: AiOperation;
    provider: string;
    model: string;
    content: string | ArrayBuffer | Uint8Array;
    textToken?: boolean;
    embeddedMediaMarker?: boolean;
    metadata?: Record<string, unknown>;
    /** Save transactions use this to roll back provisional derivative rows. */
    createdRecordIds?: string[];
  }
): Promise<ContentProvenance> {
  if (!PROVENANCE_ENTITY_TYPES.has(input.entityType)) {
    throw new Error("Unsupported provenance entity type");
  }
  await initializeSchema(env);
  const contentSha256 = await sha256Hex(input.content);
  const metadataJson = JSON.stringify(input.metadata || {});
  const markingMethod = input.textToken
    ? "signed-record+sha256-fingerprint+text-token"
    : input.embeddedMediaMarker
      ? "signed-record+sha256-fingerprint+embedded-media-marker"
      : "signed-record+sha256-fingerprint";
  const initialMarkingStatus: MarkingStatus = input.embeddedMediaMarker
    ? "pending"
    : "verified";
  const existing = await env.DB.prepare(
    `
      SELECT * FROM ai_provenance_records
      WHERE owner_email = ? AND entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC LIMIT 1
    `
  )
    .bind(user.email, input.entityType, input.entityId)
    .first<ProvenanceRow>();
  if (existing) {
    const exactMatch =
      existing.content_sha256 === contentSha256 &&
      existing.origin === input.origin &&
      existing.operation === input.operation &&
      existing.provider === input.provider &&
      existing.model === input.model &&
      existing.policy_version === AI_COMPLIANCE_POLICY_VERSION &&
      existing.marking_method === markingMethod &&
      existing.metadata_json === metadataJson;
    if (!exactMatch) {
      await recordComplianceEvent(env, {
        ownerEmail: user.email,
        eventType: "provenance.entity-mismatch-blocked",
        entityType: input.entityType,
        entityId: input.entityId,
        details: { existingRecordId: existing.id },
      });
      throw new Response(
        JSON.stringify({
          error:
            "The output identity is already bound to different content or provenance. The conflicting result was blocked.",
          code: "PROVENANCE_ENTITY_MISMATCH",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }
    return provenanceFromRow(existing);
  }

  const id = crypto.randomUUID();
  const nonceBytes = new Uint8Array(18);
  crypto.getRandomValues(nonceBytes);
  const nonce = bytesToBase64Url(nonceBytes);
  const signingKeyId = activeSigningKeyId(env);
  const createdAt = new Date().toISOString();
  const unsignedRow: ProvenanceRow = {
    id,
    public_token: "",
    owner_email: user.email,
    entity_type: input.entityType,
    entity_id: input.entityId,
    origin: input.origin,
    operation: input.operation,
    provider: input.provider,
    model: input.model,
    policy_version: AI_COMPLIANCE_POLICY_VERSION,
    signing_key_id: signingKeyId,
    marking_method: markingMethod,
    marking_status: initialMarkingStatus,
    content_sha256: contentSha256,
    metadata_json: metadataJson,
    created_at: createdAt,
    deleted_at: null,
  };
  const signature = await provenanceSignature(
    env,
    await provenanceSigningMessage({
      ...unsignedRow,
      nonce,
      marking_status: "verified",
    }),
    signingKeyId
  );
  const publicToken = `${nonce}_${signature.slice(0, 32)}`;
  await env.DB.prepare(
    `
      INSERT INTO ai_provenance_records
        (id, public_token, owner_email, entity_type, entity_id, origin,
         operation, provider, model, policy_version, signing_key_id,
         marking_method, marking_status, content_sha256, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      id,
      publicToken,
      user.email,
      input.entityType,
      input.entityId,
      input.origin,
      input.operation,
      input.provider,
      input.model,
      AI_COMPLIANCE_POLICY_VERSION,
      signingKeyId,
      markingMethod,
      initialMarkingStatus,
      contentSha256,
      metadataJson,
      createdAt
    )
    .run();
  input.createdRecordIds?.push(id);
  await recordComplianceEvent(env, {
    ownerEmail: user.email,
    eventType: "provenance.created",
    entityType: input.entityType,
    entityId: input.entityId,
    details: {
      recordId: id,
      operation: input.operation,
      markingMethod,
      markingStatus: initialMarkingStatus,
      signingKeyId,
    },
  });
  return {
    recordId: id,
    origin: input.origin,
    operation: input.operation,
    provider: input.provider,
    model: input.model,
    generatedAt: createdAt,
    policyVersion: AI_COMPLIANCE_POLICY_VERSION,
    marking: {
      scheme: AI_PROVENANCE_SCHEME,
      method: markingMethod,
      status: initialMarkingStatus,
      publicToken,
      detectPath: `/#/provenance?token=${encodeURIComponent(publicToken)}`,
    },
  };
}

async function failProvenanceRecord(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  recordId: string,
  entityType: string,
  entityId: string,
  reason: string
): Promise<void> {
  await env.DB.prepare(
    `
      UPDATE ai_provenance_records
      SET marking_status = 'failed'
      WHERE id = ? AND owner_email = ?
        AND marking_status IN ('pending', 'verified')
    `
  )
    .bind(recordId, user.email)
    .run();
  await recordComplianceEvent(env, {
    ownerEmail: user.email,
    eventType: "provenance.marking-failed",
    entityType,
    entityId,
    details: { recordId, reason },
  });
}

type SpeechOutputRollbackReason =
  | "audio-storage-write-failure"
  | "audio-marking-readback-failure"
  | "asset-persistence-failure"
  | "invocation-finalization-failure";

/**
 * Compensating transaction for generated speech. R2 and D1 cannot share one
 * physical transaction, so the object is made unreachable first and all D1
 * integrity state is then failed/deleted in one D1 batch. If the batch itself
 * is unavailable, the same fail-closed mutations are retried individually.
 */
async function rollbackGeneratedSpeech(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  invocation: AiInvocationContext,
  provenance: ContentProvenance,
  assetId: string,
  r2Key: string,
  reason: SpeechOutputRollbackReason
): Promise<void> {
  let objectCleanupSucceeded = true;
  try {
    await env.BUCKET.delete(r2Key);
  } catch {
    objectCleanupSucceeded = false;
  }

  const now = new Date().toISOString();
  const rollbackEventId = crypto.randomUUID();
  const provenanceEventId = crypto.randomUUID();
  const sanitizedDetails = JSON.stringify({
    reason,
    provenanceRecordId: provenance.recordId,
    objectCleanupSucceeded,
  });
  try {
    await env.DB.batch([
      env.DB.prepare(
        `
          UPDATE ai_provenance_records
          SET marking_status = 'failed'
          WHERE id = ? AND owner_email = ?
            AND marking_status IN ('pending', 'verified')
        `
      ).bind(provenance.recordId, user.email),
      env.DB.prepare(
        `
          UPDATE ai_invocations
          SET status = 'failed', error_code = ?, completed_at = ?
          WHERE id = ? AND status = 'in_progress'
        `
      ).bind(reason.slice(0, 80), now, invocation.id),
      env.DB.prepare(
        "DELETE FROM assets WHERE id = ? AND owner_email = ?"
      ).bind(assetId, user.email),
      env.DB.prepare(
        `
          INSERT INTO compliance_events
            (id, owner_email, event_type, entity_type, entity_id,
             policy_version, details_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).bind(
        provenanceEventId,
        user.email,
        "provenance.marking-failed",
        "asset",
        assetId,
        AI_COMPLIANCE_POLICY_VERSION,
        JSON.stringify({ recordId: provenance.recordId, reason }),
        now
      ),
      env.DB.prepare(
        `
          INSERT INTO compliance_events
            (id, owner_email, event_type, entity_type, entity_id,
             policy_version, details_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).bind(
        rollbackEventId,
        user.email,
        "speech.output-rollback",
        "asset",
        assetId,
        AI_COMPLIANCE_POLICY_VERSION,
        sanitizedDetails,
        now
      ),
    ]);
  } catch {
    await Promise.allSettled([
      failProvenanceRecord(
        env,
        user,
        provenance.recordId,
        "asset",
        assetId,
        reason
      ),
      failAiInvocation(env, invocation, reason),
      env.DB.prepare("DELETE FROM assets WHERE id = ? AND owner_email = ?")
        .bind(assetId, user.email)
        .run(),
      recordComplianceEvent(env, {
        ownerEmail: user.email,
        eventType: "speech.output-rollback",
        entityType: "asset",
        entityId: assetId,
        details: JSON.parse(sanitizedDetails) as Record<string, unknown>,
      }),
    ]);
  }
}

async function finalizeEmbeddedProvenance(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  provenance: ContentProvenance,
  storedBytes: ArrayBuffer
): Promise<ContentProvenance> {
  const row = await env.DB.prepare(
    "SELECT * FROM ai_provenance_records WHERE id = ? AND owner_email = ? LIMIT 1"
  )
    .bind(provenance.recordId, user.email)
    .first<ProvenanceRow>();
  if (!row) throw new Error("Stored provenance record is missing");
  const inspected = inspectMediaProvenanceMarker(storedBytes);
  const fingerprint = inspected ? await sha256Hex(inspected.unmarkedBytes) : "";
  const authenticAsVerified = await tokenIsAuthentic(env, {
    ...row,
    marking_status: "verified",
  });
  if (
    !inspected ||
    inspected.token !== row.public_token ||
    fingerprint !== row.content_sha256 ||
    !authenticAsVerified ||
    row.marking_status === "failed"
  ) {
    await failProvenanceRecord(
      env,
      user,
      row.id,
      row.entity_type,
      row.entity_id,
      "embedded-marker-readback-mismatch"
    );
    throw new Response(
      JSON.stringify({
        error:
          "The generated media could not be verified after marking, so it was not released.",
        code: "OUTPUT_MARKING_FAILED",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  if (row.marking_status === "pending") {
    await env.DB.prepare(
      `
        UPDATE ai_provenance_records
        SET marking_status = 'verified'
        WHERE id = ? AND owner_email = ? AND marking_status = 'pending'
      `
    )
      .bind(row.id, user.email)
      .run();
    await recordComplianceEvent(env, {
      ownerEmail: user.email,
      eventType: "provenance.marking-verified",
      entityType: row.entity_type,
      entityId: row.entity_id,
      details: { recordId: row.id, method: inspected.method },
    });
  }
  return provenanceFromRow({ ...row, marking_status: "verified" });
}

async function provenanceByEntity(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  entityType: string,
  entityId: string
): Promise<ProvenanceRow | null> {
  await initializeSchema(env);
  return env.DB.prepare(
    `
      SELECT * FROM ai_provenance_records
      WHERE owner_email = ? AND entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC LIMIT 1
    `
  )
    .bind(user.email, entityType, entityId)
    .first<ProvenanceRow>();
}

async function tokenIsAuthentic(
  env: SitesEnvironment,
  row: ProvenanceRow
): Promise<boolean> {
  // Nonces are exactly 18 random bytes encoded as 24 base64url characters.
  // Do not search for the separator: `_` is itself valid base64url and may
  // occur inside either component.
  const separator = 24;
  if (
    row.public_token.length !== 57 ||
    row.public_token[separator] !== "_" ||
    !row.content_sha256
  ) {
    return false;
  }
  const nonce = row.public_token.slice(0, separator);
  const supplied = row.public_token.slice(separator + 1);
  const key = verificationKey(env, row.signing_key_id);
  if (!key) return false;
  const expected = (
    await signProvenanceMessage(
      key,
      await provenanceSigningMessage({
        ...row,
        nonce,
        marking_status: row.marking_status,
      })
    )
  ).slice(0, 32);
  return constantTimeEqual(supplied, expected);
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
  workspace = await reconcileWorkspaceProvenance(env, user, workspace, {
    resealScriptEdits: false,
  });
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

type EditOperationProvenanceProjection = Pick<
  EditOperation,
  | "id"
  | "type"
  | "label"
  | "reason"
  | "start"
  | "end"
  | "confidence"
  | "intensity"
  | "targetClipIds"
>;

interface EditPlanProvenanceMetadata {
  schema: "edit-plan-bindings-v1";
  projectId: string;
  invocationId: string;
  projectionContentSha256: string;
  operationBindings: Array<{
    operationId: string;
    contentSha256: string;
  }>;
}

type ScriptProvenanceProjection = Pick<
  ScriptDraft,
  | "title"
  | "hook"
  | "body"
  | "cta"
  | "fullScript"
  | "platform"
  | "tone"
  | "duration"
  | "language"
>;

interface ScriptProvenanceMetadata {
  schema: "script-bindings-v1";
  invocationId: string;
  sourceScriptId: string;
  projection: ScriptProvenanceProjection;
  projectionContentSha256: string;
  parentRecordId?: string;
  change?: "human-edited" | "metadata-upgrade";
}

interface TranscriptProvenanceMetadata {
  schema: "transcript-bindings-v1";
  projectId: string;
  invocationId: string;
  sourceAssetId: string;
  segments: TranscriptSegment[];
  projectionContentSha256: string;
  parentRecordId?: string;
  change?: "human-edited";
}

function scriptProvenanceProjection(
  script: ScriptDraft,
  cleanFullScript = withoutTextProvenanceMarker(script.fullScript || "")
): ScriptProvenanceProjection {
  return {
    title: stringValue(script.title),
    hook: stringValue(script.hook),
    body: stringValue(script.body),
    cta: stringValue(script.cta),
    fullScript: cleanFullScript,
    platform: platformValue(script.platform),
    tone: stringValue(script.tone),
    duration: boundedNumber(script.duration, 30, 1, 10_000),
    language: stringValue(script.language, "en"),
  };
}

async function scriptProvenanceMetadata(
  script: ScriptDraft,
  invocationId: string,
  options: {
    parentRecordId?: string;
    change?: ScriptProvenanceMetadata["change"];
  } = {}
): Promise<ScriptProvenanceMetadata> {
  const projection = scriptProvenanceProjection(script);
  return {
    schema: "script-bindings-v1",
    invocationId,
    sourceScriptId: script.id,
    projection,
    projectionContentSha256: await sha256Hex(JSON.stringify(projection)),
    ...options,
  };
}

function parseScriptProvenanceMetadata(
  row: ProvenanceRow
): ScriptProvenanceMetadata | null {
  if (row.entity_type !== "script") return null;
  try {
    const candidate = JSON.parse(
      row.metadata_json
    ) as Partial<ScriptProvenanceMetadata>;
    const projection = candidate.projection as
      Partial<ScriptProvenanceProjection> | undefined;
    if (
      candidate.schema !== "script-bindings-v1" ||
      typeof candidate.invocationId !== "string" ||
      !candidate.invocationId ||
      typeof candidate.sourceScriptId !== "string" ||
      !candidate.sourceScriptId ||
      typeof candidate.projectionContentSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(candidate.projectionContentSha256) ||
      !projection ||
      typeof projection.title !== "string" ||
      typeof projection.hook !== "string" ||
      typeof projection.body !== "string" ||
      typeof projection.cta !== "string" ||
      typeof projection.fullScript !== "string" ||
      !knownPlatform(projection.platform) ||
      typeof projection.tone !== "string" ||
      typeof projection.duration !== "number" ||
      !Number.isFinite(projection.duration) ||
      typeof projection.language !== "string"
    ) {
      return null;
    }
    return candidate as ScriptProvenanceMetadata;
  } catch {
    return null;
  }
}

function normalizeTranscriptSegments(value: unknown): TranscriptSegment[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((candidate): candidate is Record<string, unknown> =>
      Boolean(candidate && typeof candidate === "object")
    )
    .map((candidate, index) => {
      const start = boundedNumber(candidate.start, 0, 0, 100_000);
      const end = Math.max(
        start + 0.1,
        boundedNumber(candidate.end, start + 0.1, 0, 100_000)
      );
      const speaker = stringValue(candidate.speaker);
      return {
        id: stringValue(candidate.id, `segment-${index + 1}`),
        start,
        end,
        text: stringValue(candidate.text),
        ...(speaker ? { speaker } : {}),
        ...(candidate.emphasis === true ? { emphasis: true } : {}),
      };
    })
    .filter(segment => segment.text);
}

function canonicalTranscriptText(segments: TranscriptSegment[]): string {
  return segments.map(segment => segment.text).join("\n");
}

async function transcriptProjectionSha256(
  segments: TranscriptSegment[]
): Promise<string> {
  return sha256Hex(JSON.stringify(normalizeTranscriptSegments(segments)));
}

async function transcriptProvenanceMetadata(
  projectId: string,
  invocationId: string,
  sourceAssetId: string,
  segments: TranscriptSegment[],
  options: {
    parentRecordId?: string;
    change?: TranscriptProvenanceMetadata["change"];
  } = {}
): Promise<TranscriptProvenanceMetadata> {
  const canonicalSegments = normalizeTranscriptSegments(segments);
  return {
    schema: "transcript-bindings-v1",
    projectId,
    invocationId,
    sourceAssetId,
    segments: canonicalSegments,
    projectionContentSha256:
      await transcriptProjectionSha256(canonicalSegments),
    ...options,
  };
}

function parseTranscriptProvenanceMetadata(
  row: ProvenanceRow
): TranscriptProvenanceMetadata | null {
  if (row.entity_type !== "transcript" || row.operation !== "transcription") {
    return null;
  }
  try {
    const candidate = JSON.parse(
      row.metadata_json
    ) as Partial<TranscriptProvenanceMetadata>;
    if (
      candidate.schema !== "transcript-bindings-v1" ||
      typeof candidate.projectId !== "string" ||
      !candidate.projectId ||
      typeof candidate.invocationId !== "string" ||
      !candidate.invocationId ||
      typeof candidate.sourceAssetId !== "string" ||
      !candidate.sourceAssetId ||
      typeof candidate.projectionContentSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(candidate.projectionContentSha256) ||
      !Array.isArray(candidate.segments)
    ) {
      return null;
    }
    return {
      ...candidate,
      schema: "transcript-bindings-v1",
      projectId: candidate.projectId,
      invocationId: candidate.invocationId,
      sourceAssetId: candidate.sourceAssetId,
      segments: normalizeTranscriptSegments(candidate.segments),
      projectionContentSha256: candidate.projectionContentSha256,
    };
  } catch {
    return null;
  }
}

/**
 * The immutable AI recommendation fields covered by an edit-plan record.
 * Human review state is deliberately excluded so accepting or rejecting a
 * suggestion does not erase its AI origin.
 */
function editOperationProvenanceProjection(
  operation: EditOperation
): EditOperationProvenanceProjection {
  return {
    id: operation.id,
    type: operation.type,
    label: operation.label,
    reason: operation.reason,
    start: operation.start,
    end: operation.end,
    confidence: operation.confidence,
    intensity: operation.intensity,
    targetClipIds: Array.isArray(operation.targetClipIds)
      ? operation.targetClipIds.filter(
          (clipId): clipId is string => typeof clipId === "string"
        )
      : [],
  };
}

async function editOperationContentSha256(
  operation: EditOperation
): Promise<string> {
  return sha256Hex(
    JSON.stringify(editOperationProvenanceProjection(operation))
  );
}

function parseEditPlanProvenanceMetadata(
  row: ProvenanceRow
): EditPlanProvenanceMetadata | null {
  if (
    row.entity_type !== "edit-plan" ||
    row.operation !== "edit-planning" ||
    !row.content_sha256
  ) {
    return null;
  }
  try {
    const candidate = JSON.parse(
      row.metadata_json
    ) as Partial<EditPlanProvenanceMetadata>;
    if (
      candidate.schema !== "edit-plan-bindings-v1" ||
      typeof candidate.projectId !== "string" ||
      !candidate.projectId ||
      typeof candidate.invocationId !== "string" ||
      !candidate.invocationId ||
      candidate.invocationId !== row.entity_id ||
      candidate.projectionContentSha256 !== row.content_sha256 ||
      !Array.isArray(candidate.operationBindings)
    ) {
      return null;
    }
    const operationBindings = candidate.operationBindings.filter(
      (
        binding
      ): binding is EditPlanProvenanceMetadata["operationBindings"][number] =>
        Boolean(
          binding &&
          typeof binding.operationId === "string" &&
          binding.operationId &&
          typeof binding.contentSha256 === "string" &&
          /^[a-f0-9]{64}$/.test(binding.contentSha256)
        )
    );
    if (operationBindings.length !== candidate.operationBindings.length) {
      return null;
    }
    return {
      schema: "edit-plan-bindings-v1",
      projectId: candidate.projectId,
      invocationId: candidate.invocationId,
      projectionContentSha256: candidate.projectionContentSha256,
      operationBindings,
    };
  } catch {
    return null;
  }
}

/**
 * EU-AI-02 / INV-COMP-002 — browser workspace JSON is never authoritative for
 * provenance. Rebuild every projection from owner-scoped, signed D1 rows. A
 * material script edit receives a derivative record on save; copied/forged or
 * cross-entity tokens are stripped instead of being trusted.
 */
async function reconcileWorkspaceProvenance(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  workspace: WorkspaceDocument,
  options: {
    resealScriptEdits: boolean;
    createdProvenanceRecordIds?: string[];
  }
): Promise<WorkspaceDocument> {
  const { results } = await env.DB.prepare(
    `
      SELECT * FROM ai_provenance_records
      WHERE owner_email = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
    `
  )
    .bind(user.email)
    .all<ProvenanceRow>();
  const authenticRows: ProvenanceRow[] = [];
  for (const row of results) {
    if (
      row.marking_status === "verified" &&
      (await tokenIsAuthentic(env, row))
    ) {
      authenticRows.push(row);
    }
  }
  const byId = new Map(authenticRows.map(row => [row.id, row]));
  const byToken = new Map(authenticRows.map(row => [row.public_token, row]));
  const scriptBindings = new Map<string, ScriptProvenanceMetadata>();
  const transcriptBindings = new Map<string, TranscriptProvenanceMetadata>();
  const transcriptBindingsByProject = new Map<
    string,
    Array<{ row: ProvenanceRow; metadata: TranscriptProvenanceMetadata }>
  >();
  for (const row of authenticRows) {
    const scriptMetadata = parseScriptProvenanceMetadata(row);
    if (
      scriptMetadata &&
      (row.entity_id === scriptMetadata.sourceScriptId ||
        row.entity_id.startsWith(
          `${scriptMetadata.sourceScriptId}:revision:`
        )) &&
      (await sha256Hex(JSON.stringify(scriptMetadata.projection))) ===
        scriptMetadata.projectionContentSha256 &&
      (await sha256Hex(scriptMetadata.projection.fullScript)) ===
        row.content_sha256
    ) {
      scriptBindings.set(row.id, scriptMetadata);
    }

    const transcriptMetadata = parseTranscriptProvenanceMetadata(row);
    if (
      transcriptMetadata &&
      (await transcriptProjectionSha256(transcriptMetadata.segments)) ===
        transcriptMetadata.projectionContentSha256 &&
      (await sha256Hex(
        canonicalTranscriptText(transcriptMetadata.segments)
      )) === row.content_sha256
    ) {
      transcriptBindings.set(row.id, transcriptMetadata);
      const projectBindings =
        transcriptBindingsByProject.get(transcriptMetadata.projectId) || [];
      projectBindings.push({ row, metadata: transcriptMetadata });
      transcriptBindingsByProject.set(
        transcriptMetadata.projectId,
        projectBindings
      );
    }
  }
  const editPlanBindings = new Map<
    string,
    { row: ProvenanceRow; contentSha256: string }
  >();
  for (const row of authenticRows) {
    const metadata = parseEditPlanProvenanceMetadata(row);
    if (!metadata) continue;
    for (const binding of metadata.operationBindings) {
      const bindingKey = JSON.stringify([
        metadata.projectId,
        binding.operationId,
      ]);
      if (!editPlanBindings.has(bindingKey)) {
        editPlanBindings.set(bindingKey, {
          row,
          contentSha256: binding.contentSha256,
        });
      }
    }
  }
  let rejectedClientProjections = 0;

  const scripts: ScriptDraft[] = [];
  for (const script of workspace.scripts) {
    const suppliedText =
      typeof script.fullScript === "string" ? script.fullScript : "";
    const cleanText = withoutTextProvenanceMarker(suppliedText);
    const contentHash = await sha256Hex(cleanText);
    const suppliedProjection = scriptProvenanceProjection(script, cleanText);
    const suppliedProjectionHash = await sha256Hex(
      JSON.stringify(suppliedProjection)
    );
    const suppliedToken = extractTextProvenanceToken(suppliedText);
    const recordId = script.provenance?.recordId;
    const candidates = [
      recordId ? byId.get(recordId) : undefined,
      suppliedToken ? byToken.get(suppliedToken) : undefined,
      authenticRows.find(
        row =>
          row.entity_type === "script" &&
          row.entity_id === script.id &&
          row.content_sha256 === contentHash
      ),
      authenticRows.find(
        row =>
          row.entity_type === "script" &&
          row.entity_id.startsWith(`${script.id}:revision:`) &&
          row.content_sha256 === contentHash
      ),
    ].filter((row): row is ProvenanceRow => Boolean(row));
    let exact = candidates.find(row => {
      const metadata = scriptBindings.get(row.id);
      return (
        row.entity_type === "script" &&
        (row.entity_id === script.id ||
          row.entity_id.startsWith(`${script.id}:revision:`)) &&
        row.content_sha256 === contentHash &&
        metadata?.sourceScriptId === script.id &&
        metadata.projectionContentSha256 === suppliedProjectionHash
      );
    });
    let exactMetadata = exact ? scriptBindings.get(exact.id) : undefined;
    const parent =
      candidates.find(
        row =>
          row.entity_type === "script" &&
          (row.entity_id === script.id ||
            row.entity_id.startsWith(`${script.id}:revision:`))
      ) ||
      authenticRows.find(
        row => row.entity_type === "script" && row.entity_id === script.id
      );

    if (!exact && parent && options.resealScriptEdits) {
      const parentMetadata = parseScriptProvenanceMetadata(parent);
      let invocationId = parentMetadata?.invocationId || "legacy-record";
      if (!parentMetadata) {
        try {
          const legacy = JSON.parse(parent.metadata_json) as {
            invocationId?: unknown;
          };
          if (typeof legacy.invocationId === "string" && legacy.invocationId) {
            invocationId = legacy.invocationId;
          }
        } catch {
          // The authentic parent still provides lineage; use a stable label.
        }
      }
      const metadata = await scriptProvenanceMetadata(script, invocationId, {
        parentRecordId: parent.id,
        change: parentMetadata ? "human-edited" : "metadata-upgrade",
      });
      const derivativeEntityId = `${script.id}:revision:${metadata.projectionContentSha256.slice(0, 20)}`;
      const derivative = await createProvenanceRecord(env, user, {
        entityType: "script",
        entityId: derivativeEntityId,
        origin: "ai-manipulated",
        operation: parent.operation,
        provider: parent.provider,
        model: parent.model,
        content: cleanText,
        textToken: true,
        metadata: { ...metadata },
        createdRecordIds: options.createdProvenanceRecordIds,
      });
      exact =
        (await env.DB.prepare(
          "SELECT * FROM ai_provenance_records WHERE id = ? AND owner_email = ?"
        )
          .bind(derivative.recordId, user.email)
          .first<ProvenanceRow>()) || undefined;
      exactMetadata = metadata;
    }

    if (exact && exactMetadata) {
      scripts.push({
        ...script,
        ...exactMetadata.projection,
        fullScript: appendTextProvenanceMarker(cleanText, exact.public_token),
        provenance: provenanceFromRow(exact),
      });
    } else {
      if (script.provenance || suppliedToken) rejectedClientProjections += 1;
      const withoutProjection = { ...script };
      delete withoutProjection.provenance;
      scripts.push({ ...withoutProjection, fullScript: cleanText });
    }
  }

  const reconcileTranscript = async (
    projectId: string,
    transcriptValue: unknown,
    suppliedProvenance: ContentProvenance | undefined,
    allowDerivativeReseal: boolean
  ): Promise<{
    transcript: TranscriptSegment[];
    transcriptProvenance?: ContentProvenance;
  }> => {
    const suppliedSegments = normalizeTranscriptSegments(transcriptValue);
    const projectionHash = await transcriptProjectionSha256(suppliedSegments);
    const projectBindings = transcriptBindingsByProject.get(projectId) || [];
    const suppliedRow = suppliedProvenance?.recordId
      ? byId.get(suppliedProvenance.recordId)
      : undefined;
    const suppliedMetadata = suppliedRow
      ? transcriptBindings.get(suppliedRow.id)
      : undefined;
    const suppliedIsExact = Boolean(
      suppliedRow &&
      suppliedMetadata?.projectId === projectId &&
      suppliedMetadata.projectionContentSha256 === projectionHash
    );
    const recovered = projectBindings.find(
      binding => binding.metadata.projectionContentSha256 === projectionHash
    );
    let exactRow = suppliedIsExact ? suppliedRow : recovered?.row;
    let exactMetadata = suppliedIsExact
      ? suppliedMetadata
      : recovered?.metadata;
    const parent =
      suppliedRow && suppliedMetadata?.projectId === projectId
        ? { row: suppliedRow, metadata: suppliedMetadata }
        : undefined;

    if (
      !exactRow &&
      parent &&
      suppliedSegments.length > 0 &&
      options.resealScriptEdits &&
      allowDerivativeReseal
    ) {
      const metadata = await transcriptProvenanceMetadata(
        projectId,
        parent.metadata.invocationId,
        parent.metadata.sourceAssetId,
        suppliedSegments,
        { parentRecordId: parent.row.id, change: "human-edited" }
      );
      const derivative = await createProvenanceRecord(env, user, {
        entityType: "transcript",
        entityId: `${projectId}:revision:${metadata.projectionContentSha256.slice(0, 20)}`,
        origin: "ai-manipulated",
        operation: "transcription",
        provider: parent.row.provider,
        model: parent.row.model,
        content: canonicalTranscriptText(metadata.segments),
        textToken: true,
        metadata: { ...metadata },
        createdRecordIds: options.createdProvenanceRecordIds,
      });
      exactRow =
        (await env.DB.prepare(
          "SELECT * FROM ai_provenance_records WHERE id = ? AND owner_email = ?"
        )
          .bind(derivative.recordId, user.email)
          .first<ProvenanceRow>()) || undefined;
      exactMetadata = metadata;
    }

    if (exactRow && exactMetadata) {
      return {
        transcript: exactMetadata.segments,
        transcriptProvenance: provenanceFromRow(exactRow),
      };
    }
    if (suppliedProvenance) rejectedClientProjections += 1;
    return { transcript: suppliedSegments };
  };

  const projects: WorkspaceDocument["projects"] = [];
  for (const project of workspace.projects) {
    const proposedChanges: EditOperation[] = [];
    for (const operation of project.proposedChanges) {
      const operationHash = await editOperationContentSha256(operation);
      const bindingKey = JSON.stringify([project.id, operation.id]);
      const canonicalBinding = editPlanBindings.get(bindingKey);
      const suppliedRow = operation.provenance?.recordId
        ? byId.get(operation.provenance.recordId)
        : undefined;
      const suppliedMetadata = suppliedRow
        ? parseEditPlanProvenanceMetadata(suppliedRow)
        : null;
      const suppliedBinding = suppliedMetadata?.operationBindings.find(
        binding => binding.operationId === operation.id
      );
      const suppliedIsExact = Boolean(
        suppliedRow &&
        suppliedMetadata &&
        suppliedMetadata.projectId === project.id &&
        suppliedBinding?.contentSha256 === operationHash
      );
      const recoveredIsExact = Boolean(
        canonicalBinding && canonicalBinding.contentSha256 === operationHash
      );
      const exactRow = suppliedIsExact
        ? suppliedRow
        : recoveredIsExact
          ? canonicalBinding?.row
          : undefined;

      if (exactRow) {
        proposedChanges.push({
          ...operation,
          provenance: provenanceFromRow(exactRow),
        });
      } else {
        if (operation.provenance) rejectedClientProjections += 1;
        const withoutProjection = { ...operation };
        delete withoutProjection.provenance;
        proposedChanges.push(withoutProjection);
      }
    }
    const currentTranscript = await reconcileTranscript(
      project.id,
      project.transcript,
      project.transcriptProvenance,
      true
    );
    const revisions = [];
    for (const revision of project.revisions) {
      const revisionTranscript = await reconcileTranscript(
        project.id,
        revision.transcript,
        revision.transcriptProvenance,
        false
      );
      revisions.push({ ...revision, ...revisionTranscript });
    }
    const withoutTranscriptProjection = { ...project };
    delete withoutTranscriptProjection.transcriptProvenance;
    projects.push({
      ...withoutTranscriptProjection,
      ...currentTranscript,
      proposedChanges,
      revisions,
    });
  }

  if (
    options.resealScriptEdits &&
    !options.createdProvenanceRecordIds &&
    rejectedClientProjections > 0
  ) {
    await recordComplianceEvent(env, {
      ownerEmail: user.email,
      eventType: "provenance.client-projection-rejected",
      entityType: "workspace",
      entityId: user.email,
      details: { count: rejectedClientProjections },
    });
  }
  return { ...workspace, scripts, projects };
}

async function rollbackProvisionalWorkspaceProvenance(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  recordIds: string[]
): Promise<void> {
  const uniqueRecordIds = Array.from(new Set(recordIds));
  if (uniqueRecordIds.length === 0) return;
  try {
    await env.DB.batch(
      uniqueRecordIds.flatMap(recordId => [
        env.DB.prepare(
          `DELETE FROM compliance_events
           WHERE owner_email = ? AND event_type = 'provenance.created'
             AND json_extract(details_json, '$.recordId') = ?`
        ).bind(user.email, recordId),
        env.DB.prepare(
          "DELETE FROM ai_provenance_records WHERE id = ? AND owner_email = ?"
        ).bind(recordId, user.email),
      ])
    );
  } catch {
    await Promise.allSettled(
      uniqueRecordIds.map(recordId =>
        env.DB.prepare(
          `UPDATE ai_provenance_records SET marking_status = 'failed'
           WHERE id = ? AND owner_email = ?`
        )
          .bind(recordId, user.email)
          .run()
      )
    );
  }
}

async function saveWorkspace(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  workspaceValue: unknown
): Promise<WorkspaceDocument> {
  await initializeSchema(env);
  let workspace = normalizeWorkspace(workspaceValue, user);
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
  const unsealedBytes = new TextEncoder().encode(
    JSON.stringify(workspace)
  ).byteLength;
  if (unsealedBytes > MAX_WORKSPACE_BYTES) {
    throw new Response(
      JSON.stringify({ error: "Workspace data exceeds the safe 2 MB limit" }),
      {
        status: 413,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const provisionalRecordIds: string[] = [];
  try {
    workspace = await reconcileWorkspaceProvenance(env, user, workspace, {
      resealScriptEdits: true,
      createdProvenanceRecordIds: provisionalRecordIds,
    });
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
  } catch (cause) {
    await rollbackProvisionalWorkspaceProvenance(
      env,
      user,
      provisionalRecordIds
    );
    throw cause;
  }
}

async function createAuthoritativeEditBrief(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  projectId: string
): Promise<{ filename: string; brief: Record<string, unknown> }> {
  const workspace = await getWorkspace(env, user);
  const project = workspace.projects.find(
    candidate => candidate.id === projectId
  );
  if (!project) {
    throw new Response(JSON.stringify({ error: "Edit project not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const transcriptText = canonicalTranscriptText(project.transcript);
  const markedTranscriptText = project.transcriptProvenance
    ? appendTextProvenanceMarker(
        transcriptText,
        project.transcriptProvenance.marking.publicToken
      )
    : transcriptText;
  const filenameBase =
    project.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "edit";
  return {
    filename: `${filenameBase.toLowerCase()}-edit-brief.json`,
    brief: {
      schema: "reelassati-edit-brief/v3",
      compliancePolicyVersion: AI_COMPLIANCE_POLICY_VERSION,
      generatedAt: new Date().toISOString(),
      note: "This is an edit decision list, not a rendered video.",
      project: {
        id: project.id,
        title: project.title,
        platform: project.platform,
        aspectRatio: project.aspectRatio,
        duration: project.duration,
        clips: project.clips,
        transcript: project.transcript,
        transcriptText: markedTranscriptText,
        transcriptProvenance: project.transcriptProvenance,
        acceptedChanges: project.proposedChanges.filter(
          change => change.status === "accepted"
        ),
      },
      assets: workspace.assets
        .filter(asset => project.clips.some(clip => clip.assetId === asset.id))
        .map(asset => ({
          id: asset.id,
          name: asset.name,
          kind: asset.kind,
          duration: asset.duration,
          provenance: asset.provenance,
        })),
    },
  };
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

function rowToAsset(row: AssetRow, provenance?: ProvenanceRow | null): Asset {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    contentType: row.content_type,
    size: row.bytes,
    url: `/api/assets/${encodeURIComponent(row.id)}`,
    status: "ready",
    createdAt: row.created_at,
    ...(provenance ? { provenance: provenanceFromRow(provenance) } : {}),
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
  const provenanceRows = await env.DB.prepare(
    `
      SELECT * FROM ai_provenance_records
      WHERE owner_email = ? AND entity_type = 'asset'
      ORDER BY created_at DESC
    `
  )
    .bind(user.email)
    .all<ProvenanceRow>();
  const provenanceByAsset = new Map<string, ProvenanceRow>();
  for (const provenance of provenanceRows.results) {
    if (
      provenance.marking_status === "verified" &&
      !provenanceByAsset.has(provenance.entity_id) &&
      (await tokenIsAuthentic(env, provenance))
    ) {
      provenanceByAsset.set(provenance.entity_id, provenance);
    }
  }
  return result.results.map(row =>
    rowToAsset(row, provenanceByAsset.get(row.id))
  );
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

type GeneratedAssetVerificationFailure =
  | "missing-provenance-record"
  | "provenance-record-not-verified"
  | "provenance-signature-invalid"
  | "object-owner-mismatch"
  | "object-token-mismatch"
  | "object-policy-mismatch"
  | "object-version-mismatch"
  | "object-size-mismatch"
  | "embedded-marker-mismatch"
  | "content-fingerprint-mismatch";

function generatedAssetVerificationCacheKey(
  user: AuthenticatedUser,
  row: AssetRow,
  provenance: ProvenanceRow,
  object: R2ObjectBody
): string {
  return JSON.stringify([
    user.email,
    row.id,
    row.bytes,
    provenance.public_token,
    object.etag,
  ]);
}

function hasFreshGeneratedAssetVerification(cacheKey: string): boolean {
  const expiry = generatedAssetVerificationCache.get(cacheKey);
  if (!expiry) return false;
  if (expiry <= Date.now()) {
    generatedAssetVerificationCache.delete(cacheKey);
    return false;
  }
  return true;
}

function rememberGeneratedAssetVerification(cacheKey: string): void {
  const now = Date.now();
  for (const [key, expiry] of generatedAssetVerificationCache) {
    if (expiry <= now) generatedAssetVerificationCache.delete(key);
  }
  generatedAssetVerificationCache.set(
    cacheKey,
    now + GENERATED_ASSET_VERIFICATION_CACHE_TTL_MS
  );
  while (
    generatedAssetVerificationCache.size >
    GENERATED_ASSET_VERIFICATION_CACHE_LIMIT
  ) {
    const oldest = generatedAssetVerificationCache.keys().next().value;
    if (typeof oldest !== "string") break;
    generatedAssetVerificationCache.delete(oldest);
  }
}

async function generatedAssetStructuralFailure(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  provenance: ProvenanceRow | null,
  object: R2ObjectBody
): Promise<GeneratedAssetVerificationFailure | null> {
  if (!provenance) return "missing-provenance-record";
  if (provenance.marking_status !== "verified") {
    return "provenance-record-not-verified";
  }
  if (!(await tokenIsAuthentic(env, provenance))) {
    return "provenance-signature-invalid";
  }
  if (object.customMetadata?.owner !== user.email) {
    return "object-owner-mismatch";
  }
  if (object.customMetadata?.provenanceToken !== provenance.public_token) {
    return "object-token-mismatch";
  }
  if (object.customMetadata?.policyVersion !== provenance.policy_version) {
    return "object-policy-mismatch";
  }
  return null;
}

async function generatedAssetByteFailure(
  row: AssetRow,
  provenance: ProvenanceRow,
  object: R2ObjectBody,
  bytes: ArrayBuffer
): Promise<GeneratedAssetVerificationFailure | null> {
  if (object.size !== row.bytes || bytes.byteLength !== row.bytes) {
    return "object-size-mismatch";
  }
  const inspected = inspectMediaProvenanceMarker(bytes);
  if (
    !inspected ||
    inspected.token !== provenance.public_token ||
    object.customMetadata?.embeddedMarking !== inspected.method
  ) {
    return "embedded-marker-mismatch";
  }
  if (
    (await sha256Hex(inspected.unmarkedBytes)) !== provenance.content_sha256
  ) {
    return "content-fingerprint-mismatch";
  }
  return null;
}

async function recordGeneratedAssetDeliveryBlock(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  row: AssetRow,
  provenance: ProvenanceRow | null,
  reason: GeneratedAssetVerificationFailure
): Promise<void> {
  for (const key of generatedAssetVerificationCache.keys()) {
    if (key.includes(`"${row.id}"`)) {
      generatedAssetVerificationCache.delete(key);
    }
  }
  if (provenance && provenance.marking_status !== "failed") {
    await failProvenanceRecord(
      env,
      user,
      provenance.id,
      "asset",
      row.id,
      reason
    ).catch(() => undefined);
  }
  await recordComplianceEvent(env, {
    ownerEmail: user.email,
    eventType: "asset.generated-delivery-blocked",
    entityType: "asset",
    entityId: row.id,
    details: {
      reason,
      provenanceRecordId: provenance?.id || null,
    },
  }).catch(() => undefined);
}

function openRouterHeaders(env: SitesEnvironment): HeadersInit {
  return {
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://reelassati.chatgpt.site",
    "X-Title": "REELassati",
  };
}

function kimiCodeHeaders(env: SitesEnvironment): HeadersInit {
  return {
    Authorization: `Bearer ${env.KIMI_CODE_API_KEY}`,
    "Content-Type": "application/json",
  };
}

interface ProviderFailureMetadata {
  provider: string;
  status: number;
  reference: string;
  existingPostId?: string;
}

const providerFailureMetadata = new WeakMap<
  Response,
  ProviderFailureMetadata
>();
const MAX_PROVIDER_ERROR_BYTES = 64 * 1024;

async function readProviderErrorPayload(
  response: Response
): Promise<Record<string, unknown> | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PROVIDER_ERROR_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
  if (!total) return null;
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return recordValue(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

function zernioExistingPostId(payload: Record<string, unknown> | null): string {
  const details = recordValue(payload?.details);
  const id = stringValue(details?.existingPostId || payload?.existingPostId);
  return id.slice(0, 240);
}

function logProviderFailure(
  provider: string,
  operation: string,
  details: { status?: number | string; providerCode?: string } = {}
): string {
  const reference = crypto.randomUUID();
  console.error("REELassati provider operation failed", {
    reference,
    provider,
    operation,
    ...(details.status !== undefined ? { status: details.status } : {}),
    ...(details.providerCode ? { providerCode: details.providerCode } : {}),
  });
  return reference;
}

function clientProviderFailureMessage(
  message: string,
  reference: string
): string {
  return `${message} Reference: ${reference}.`;
}

async function providerError(
  response: Response,
  provider: string
): Promise<never> {
  const status =
    response.status >= 400 && response.status < 600 ? response.status : 502;
  const payload = await readProviderErrorPayload(response);
  const reference = logProviderFailure(provider, "provider-request", {
    status,
  });
  const failure = json(
    {
      error: `${provider} could not complete this request. Retry once; if it continues, contact support.`,
      reference,
    },
    status
  );
  providerFailureMetadata.set(failure, {
    provider,
    status,
    reference,
    ...(provider === "Zernio" && status === 409
      ? { existingPostId: zernioExistingPostId(payload) || undefined }
      : {}),
  });
  throw failure;
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
  user: AuthenticatedUser,
  purpose: AiOperation,
  system: string,
  userContent: unknown,
  model?: string
): Promise<{
  output: Record<string, unknown>;
  invocation: AiInvocationContext;
}> {
  // EU-AI-INV-COMP-005 — the subscription experiment is an owner entitlement,
  // not a global deployment switch. Explicit model routes always stay on
  // OpenRouter, and non-owner requests fall back to the official text route.
  const useKimiSubscription = !model && isKimiTestOwner(env, user);
  const credential = useKimiSubscription
    ? env.KIMI_CODE_API_KEY
    : env.OPENROUTER_API_KEY;
  if (!credential) {
    const missingKey = useKimiSubscription
      ? "KIMI_CODE_API_KEY"
      : "OPENROUTER_API_KEY";
    throw new Response(
      JSON.stringify({
        error: useKimiSubscription
          ? "Kimi subscription test mode needs a Kimi Code API key"
          : "AI is ready but needs a new OpenRouter key",
        missing: [missingKey],
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const providerName = useKimiSubscription ? "Kimi Code" : "OpenRouter";
  const selectedModel = useKimiSubscription
    ? env.KIMI_CODE_MODEL || "k3-256k"
    : model || env.OPENROUTER_TEXT_MODEL || "moonshotai/kimi-k2.5";
  const invocation = await beginAiInvocation(
    env,
    user,
    purpose,
    providerName,
    selectedModel,
    userContent
  );
  try {
    const response = await fetch(
      `${useKimiSubscription ? KIMI_CODE_BASE : OPENROUTER_BASE}/chat/completions`,
      {
        method: "POST",
        headers: useKimiSubscription
          ? kimiCodeHeaders(env)
          : openRouterHeaders(env),
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: "system",
              content: `${system}\n\nREELassati policy ${AI_COMPLIANCE_POLICY_VERSION}: work only on creative and marketing production. Do not perform biometric identification or categorisation, emotion inference, social scoring, or decisions/recommendations determining access to employment, education, credit, insurance, medical care, legal services, law enforcement, migration or public benefits. Do not generate child sexual abuse material, sexual exploitation, or non-consensual intimate content. Do not target or manipulate voters or democratic participation. Do not fabricate a real person's endorsement, consent, credentials, evidence or results. Never use manipulative or exploitative techniques likely to cause significant harm.`,
            },
            { role: "user", content: userContent },
          ],
          response_format: { type: "json_object" },
          temperature: 0.45,
        }),
      }
    );
    if (!response.ok) {
      await failAiInvocation(env, invocation, `provider_${response.status}`);
      await providerError(response, providerName);
    }
    const output = parseModelJson(await response.json());
    await completeAiInvocation(env, invocation, output);
    return { output, invocation };
  } catch (cause) {
    await failAiInvocation(env, invocation, "provider_or_parse_failure");
    throw cause;
  }
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

const DISALLOWED_SCOPE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /\b(?:infer|detect|recogni[sz]e|classif(?:y|ication))\b.{0,50}\b(?:emotion|ethnicity|race|religion|sexual orientation|disability|health status|biometric)\b/i,
    reason: "emotion or sensitive biometric inference",
  },
  {
    pattern:
      /\b(?:rank|score|screen|select|reject|approve|deny|decide|assess|evaluate)\b.{0,70}\b(?:candidates?|applicants?|employees?|students?|admissions?|borrowers?|credit|loans?|insurance|patients?|benefits?|asylum|migrants?|resumes?|cvs?)\b/i,
    reason: "a high-impact decision about a person",
  },
  {
    pattern:
      /\b(?:candidates?|applicants?|employees?|students?|borrowers?|patients?|asylum|migrants?|resumes?|cvs?)\b.{0,70}\b(?:rank|score|screen|select|reject|approve|deny|eligib|risk rating|evaluate)\b/i,
    reason: "a high-impact decision about a person",
  },
  {
    pattern:
      /\b(?:social scoring|predictive policing|facial recognition|remote biometric identification)\b/i,
    reason: "social scoring, policing or biometric identification",
  },
  {
    pattern:
      /\b(?:diagnose|prescribe|medical advice|legal advice|determine (?:legal )?liability|healthcare triage|emergency prioritisation|insurance underwriting|credit decision|loan approval|benefit eligibility)\b/i,
    reason: "medical, legal, credit, insurance or essential-service decisions",
  },
  {
    pattern:
      /\b(?:microtarget|manipulate|persuade|suppress|discourage)\b.{0,60}\b(?:voters?|voting|elections?|referendums?|ballots?)\b/i,
    reason: "targeted influence over voting or democratic participation",
  },
  {
    pattern:
      /\b(?:child sexual abuse|csam|sexuali[sz]e (?:a )?(?:child|minor)|underage (?:nude|sexual|explicit)|revenge porn|non-consensual intimate|deepfake nude|undress (?:a )?(?:real )?person)\b/i,
    reason: "sexual exploitation or non-consensual intimate content",
  },
  {
    pattern:
      /\b(?:inferisc[ei]|rileva|riconosci|classifica)\b.{0,60}\b(?:emozion[ei]|etnia|razza|religione|orientamento sessuale|disabilit[aà]|stato di salute|biometric[oa])\b/i,
    reason: "emotion or sensitive biometric inference",
  },
  {
    pattern:
      /\b(?:classifica|seleziona|scarta|approva|nega|valuta|assegna un punteggio)\b.{0,80}\b(?:candidat[oi]|dipendent[ei]|student[ei]|ammission[ei]|mutuatari|credito|prestiti|assicurazione|pazient[ei]|benefici|asilo|migrant[ei]|curriculum)\b/i,
    reason: "a high-impact decision about a person",
  },
  {
    pattern:
      /\b(?:diagnostica|prescrivi|consiglio medico|consulenza medica|consiglio legale|consulenza legale|riconoscimento facciale|identificazione biometrica|punteggio sociale|polizia predittiva|valutazione del credito|approvazione del prestito)\b/i,
    reason: "medical, legal, credit, insurance or biometric decisions",
  },
  {
    pattern:
      /\b(?:manipola|microtarget|persuadi|scoraggia|sopprimi)\b.{0,70}\b(?:elettor[ei]|voto|votare|elezion[ei]|referendum)\b/i,
    reason: "targeted influence over voting or democratic participation",
  },
  {
    pattern:
      /\b(?:materiale pedopornografico|abuso sessuale su minori|minore (?:nudo|sessualizzato|esplicito)|intimo non consensuale|porno di vendetta|deepfake nudo|spoglia (?:una )?persona reale)\b/i,
    reason: "sexual exploitation or non-consensual intimate content",
  },
];

async function assertAllowedCreativeUse(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  value: string,
  entityId = "request"
): Promise<void> {
  const match = DISALLOWED_SCOPE_PATTERNS.find(item =>
    item.pattern.test(value)
  );
  if (!match) return;
  await recordComplianceEvent(env, {
    ownerEmail: user.email,
    eventType: "scope.blocked",
    entityType: "request",
    entityId,
    details: { reason: match.reason },
  });
  throw new Response(
    JSON.stringify({
      error: `REELassati is limited to creative and marketing production and cannot be used for ${match.reason}.`,
      code: "INTENDED_USE_BLOCKED",
    }),
    { status: 422, headers: { "Content-Type": "application/json" } }
  );
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
  const metadata = providerFailureMetadata.get(response);
  const existingPostId =
    metadata?.provider === "Zernio" ? metadata.existingPostId : undefined;
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

export async function submitZernioPost(
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

const SAFE_VIDEO_JOB_ERRORS = new Set([
  "The provider rejected the generation request",
  "OpenRouter did not return a job id",
  "The provider did not confirm this registered request",
  "The generated output could not be marked and verified",
]);

function safeVideoJobError(value: string | null): string | undefined {
  const error = stringValue(value);
  if (!error) return undefined;
  if (SAFE_VIDEO_JOB_ERRORS.has(error)) return error;
  if (
    /^The video provider reported a generation failure\. Reference: [0-9a-f-]{36}\.$/i.test(
      error
    )
  ) {
    return error;
  }
  // Older rows may contain a provider-supplied message. Never return that
  // historical text to a client; new failures receive a correlation reference.
  return "The video job could not be completed. Retry once; if it continues, contact support.";
}

export function jobFromRow(row: JobRow): GenerationJob {
  return {
    id: row.id,
    type: "video",
    status: row.status,
    providerJobId: row.provider_job_id || undefined,
    projectId: row.project_id || undefined,
    prompt: row.prompt || undefined,
    progress: row.progress,
    resultAssetId: row.result_asset_id || undefined,
    error: safeVideoJobError(row.error),
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
    await env.BUCKET.delete(`${row.r2_key}.provenance.json`).catch(
      () => undefined
    );
    await env.DB.prepare("DELETE FROM assets WHERE id = ? AND owner_email = ?")
      .bind(id, user.email)
      .run();
    await recordComplianceEvent(env, {
      ownerEmail: user.email,
      eventType: "asset.deleted",
      entityType: "asset",
      entityId: id,
      details: { provenanceRetained: true },
    });
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
  const provenance = await provenanceByEntity(env, user, "asset", row.id);
  const generatedAsset = row.r2_key.includes("/generated/");
  let verifiedFullBytes: ArrayBuffer | null = null;
  if (generatedAsset) {
    let verificationFailure = await generatedAssetStructuralFailure(
      env,
      user,
      provenance,
      object
    );
    if (!verificationFailure && provenance) {
      const cacheKey = generatedAssetVerificationCacheKey(
        user,
        row,
        provenance,
        object
      );
      const mayUseRangeCache = Boolean(
        requestedRange && hasFreshGeneratedAssetVerification(cacheKey)
      );
      if (!mayUseRangeCache) {
        const fullObject = requestedRange
          ? await env.BUCKET.get(row.r2_key)
          : object;
        if (!fullObject || fullObject.etag !== object.etag) {
          verificationFailure = "object-version-mismatch";
        } else {
          verificationFailure = await generatedAssetStructuralFailure(
            env,
            user,
            provenance,
            fullObject
          );
          if (!verificationFailure) {
            const fullBytes = await fullObject.arrayBuffer();
            verificationFailure = await generatedAssetByteFailure(
              row,
              provenance,
              fullObject,
              fullBytes
            );
            if (!verificationFailure) {
              rememberGeneratedAssetVerification(cacheKey);
              if (!requestedRange) verifiedFullBytes = fullBytes;
            }
          }
        }
      }
    }
    if (verificationFailure) {
      await recordGeneratedAssetDeliveryBlock(
        env,
        user,
        row,
        provenance,
        verificationFailure
      );
      return errorResponse(
        "This generated asset is not available because its output mark could not be verified",
        423
      );
    }
  }
  const headers = new Headers({
    "Content-Type": row.content_type,
    "Accept-Ranges": "bytes",
    "Cache-Control": generatedAsset
      ? "private, max-age=0, must-revalidate"
      : "private, max-age=3600",
    ETag: object.httpEtag || object.etag,
    "Content-Disposition": `inline; filename="${sanitizeFilename(row.name)}"`,
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "X-Content-Type-Options": "nosniff",
  });
  if (provenance?.content_sha256) {
    headers.set("X-REELassati-AI-Origin", provenance.origin);
    headers.set("X-REELassati-Provenance", provenance.public_token);
    headers.set("X-Content-SHA256", provenance.content_sha256);
    headers.append(
      "Link",
      `</#/provenance?token=${encodeURIComponent(
        provenance.public_token
      )}>; rel="describedby"`
    );
  }
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
  return new Response(
    request.method === "HEAD" ? null : verifiedFullBytes || object.body,
    {
      status: requestedRange ? 206 : 200,
      headers,
    }
  );
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
    assertProvenanceConfigured(env);
    await assertAllowedCreativeUse(env, user, topic);
    const duration = boundedNumber(input.duration, 30, 8, 180);
    const platform = platformValue(input.platform);
    const { output, invocation } = await chatJson(
      env,
      user,
      "script-generation",
      `You are REELassati's senior short-form script editor. Return JSON only with keys title, hook, body, cta, fullScript. Write a shootable ${duration}-second script for ${platform}; no inflated viral guarantees, no fake statistics, no generic filler. Make the first line immediately specific. Language: ${stringValue(input.language, "en")}. Tone: ${stringValue(input.tone, "energetic")}. Brand voice: ${stringValue(input.brandVoice, "not supplied")}.`,
      topic
    );
    const createdAt = new Date().toISOString();
    const hook = stringValue(output.hook);
    const body = stringValue(output.body);
    const cta = stringValue(output.cta);
    const fullScript = stringValue(
      output.fullScript,
      [hook, body, cta].filter(Boolean).join("\n\n")
    );
    const scriptId = crypto.randomUUID();
    const canonicalScript: ScriptDraft = {
      id: scriptId,
      title: stringValue(output.title, topic.slice(0, 72)),
      hook,
      body,
      cta,
      fullScript,
      platform,
      tone: stringValue(input.tone, "energetic"),
      duration,
      language: stringValue(input.language, "en"),
      createdAt,
    };
    const metadata = await scriptProvenanceMetadata(
      canonicalScript,
      invocation.id
    );
    const provenance = await createProvenanceRecord(env, user, {
      entityType: "script",
      entityId: scriptId,
      origin: "ai-generated",
      operation: "script-generation",
      provider: invocation.provider,
      model: invocation.model,
      content: fullScript,
      textToken: true,
      metadata: { ...metadata },
    });
    const script: ScriptDraft = {
      ...canonicalScript,
      fullScript: appendTextProvenanceMarker(
        fullScript,
        provenance.marking.publicToken
      ),
      provenance,
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
    const projectId = stringValue(input.project.id);
    if (!projectId) {
      return errorResponse(
        "Save the project before requesting an AI edit plan"
      );
    }
    assertProvenanceConfigured(env);
    await assertAllowedCreativeUse(
      env,
      user,
      stringValue(input.command),
      projectId
    );
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
    const { output, invocation } = await chatJson(
      env,
      user,
      "edit-planning",
      `You are the accountable AI edit planner inside a professional short-form timeline. Return JSON only: {"summary":"...", "changes":[...]}. Each change must contain type, label, reason, start, end, confidence (0..1), and intensity (light|balanced|aggressive). Allowed types: trim, split, move, delete, caption, silence, pacing, broll, audio, style. Plan only—never claim changes are already applied. Respect locked clips and stay inside 0..${duration}s. Prefer fewer high-impact operations. Explain the audience-retention reason concretely.`,
      JSON.stringify({ command: input.command, project: projectContext })
    );
    const summary = stringValue(output.summary, "Edit plan ready for review");
    const changes = mapEditOperations(
      output.changes,
      duration,
      input.project.clips,
      Array.isArray(input.selectedClipIds) ? input.selectedClipIds : []
    );
    const normalizedProjection = {
      summary,
      changes: changes.map(editOperationProvenanceProjection),
    };
    const normalizedProjectionJson = JSON.stringify(normalizedProjection);
    const operationBindings = await Promise.all(
      changes.map(async change => ({
        operationId: change.id,
        contentSha256: await editOperationContentSha256(change),
      }))
    );
    const provenance = await createProvenanceRecord(env, user, {
      entityType: "edit-plan",
      entityId: invocation.id,
      origin: "ai-assisted",
      operation: "edit-planning",
      provider: invocation.provider,
      model: invocation.model,
      content: normalizedProjectionJson,
      textToken: true,
      metadata: {
        schema: "edit-plan-bindings-v1",
        projectId,
        invocationId: invocation.id,
        projectionContentSha256: await sha256Hex(normalizedProjectionJson),
        operationBindings,
      } satisfies EditPlanProvenanceMetadata,
    });
    return json({
      summary,
      changes: changes.map(change => ({ ...change, provenance })),
      provenance,
    });
  }

  if (url.pathname === "/api/ai/analyze") {
    const input = await parseJsonBody<{
      assetId?: string;
      publicUrl?: string;
      platform?: string;
      sourceRightsConfirmed?: boolean;
    }>(request);
    assertProvenanceConfigured(env);
    if (input.sourceRightsConfirmed !== true) {
      return errorResponse(
        "Confirm that you may submit this video to the analysis provider",
        422
      );
    }
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

    await recordComplianceEvent(env, {
      ownerEmail: user.email,
      eventType: "rights.video-analysis-confirmed",
      entityType: input.assetId ? "asset" : "external-url",
      entityId: stringValue(input.assetId) || "public-video",
      details: {
        source: input.assetId ? "workspace-asset" : "public-https-url",
      },
    });

    const { output, invocation } = await chatJson(
      env,
      user,
      "video-analysis",
      `You are REELassati's evidence-focused short-form video reviewer. Inspect the supplied video. Return JSON only with summary, hook {score 0..100,note}, pacing {score 0..100,note}, retention [{start,end,score,note}], and changes. Scores are editorial rubric estimates, never presented as predicted views. Never infer emotions, sensitive traits, health, identity, biometric categories or a person's suitability. Each change follows the edit-plan schema: type,label,reason,start,end,confidence,intensity. Target platform: ${platformValue(input.platform)}.`,
      [
        {
          type: "text",
          text: "Analyze the video for hook clarity, pacing, dead air, visual proof, captions, audio, and CTA. Produce only reviewable edit suggestions.",
        },
        { type: "video_url", video_url: { url: videoUrl } },
      ],
      env.OPENROUTER_ANALYSIS_MODEL || "google/gemini-2.5-flash"
    );
    const provenance = await createProvenanceRecord(env, user, {
      entityType: "analysis",
      entityId: invocation.id,
      origin: "ai-assisted",
      operation: "video-analysis",
      provider: invocation.provider,
      model: invocation.model,
      content: JSON.stringify(output),
      textToken: true,
      metadata: {
        invocationId: invocation.id,
        assetId: input.assetId || null,
        sourceRightsConfirmed: true,
      },
    });
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
      changes: mapEditOperations(output.changes, 600).map(change => ({
        ...change,
        provenance,
      })),
      provenance,
    });
  }

  if (url.pathname === "/api/ai/transcribe") {
    if (!env.OPENROUTER_API_KEY) {
      return errorResponse("Transcription needs a new OpenRouter key", 503, [
        "OPENROUTER_API_KEY",
      ]);
    }
    const input = await parseJsonBody<{
      assetId?: string;
      projectId?: string;
      language?: string;
    }>(request);
    assertProvenanceConfigured(env);
    const assetId = stringValue(input.assetId);
    const projectId = stringValue(input.projectId);
    if (projectId) {
      const authoritativeWorkspace = await getWorkspace(env, user);
      if (
        !authoritativeWorkspace.projects.some(
          project => project.id === projectId
        )
      ) {
        return errorResponse("Edit project not found", 404);
      }
    }
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
    const model = env.OPENROUTER_STT_MODEL || "openai/whisper-large-v3-turbo";
    const invocation = await beginAiInvocation(
      env,
      user,
      "transcription",
      "OpenRouter",
      model,
      { assetId, projectId, language: input.language || null }
    );
    let payload: {
      text?: string;
      segments?: Array<{ start?: number; end?: number; text?: string }>;
    };
    try {
      const response = await fetch(`${OPENROUTER_BASE}/audio/transcriptions`, {
        method: "POST",
        headers: openRouterHeaders(env),
        body: JSON.stringify({
          model,
          input_audio: {
            data: arrayBufferToBase64(await object.arrayBuffer()),
            format: audioFormat(row.content_type, row.name),
          },
          ...(input.language ? { language: input.language } : {}),
          response_format: "verbose_json",
          timestamp_granularities: ["segment"],
        }),
      });
      if (!response.ok) {
        await failAiInvocation(env, invocation, `provider_${response.status}`);
        await providerError(response, "OpenRouter");
      }
      payload = (await response.json()) as typeof payload;
      await completeAiInvocation(env, invocation, payload);
    } catch (cause) {
      await failAiInvocation(env, invocation, "provider_or_parse_failure");
      throw cause;
    }
    const providerTranscript = stringValue(payload.text);
    const segments = normalizeTranscriptSegments(
      (payload.segments || []).length > 0
        ? (payload.segments || []).map(segment => ({
            id: crypto.randomUUID(),
            start: boundedNumber(segment.start, 0, 0, 100_000),
            end: boundedNumber(segment.end, 0.1, 0, 100_000),
            text: stringValue(segment.text),
          }))
        : providerTranscript
          ? [
              {
                id: crypto.randomUUID(),
                start: 0,
                end: 0.1,
                text: providerTranscript,
              },
            ]
          : []
    );
    const transcript = canonicalTranscriptText(segments);
    const metadata = projectId
      ? await transcriptProvenanceMetadata(
          projectId,
          invocation.id,
          assetId,
          segments
        )
      : { invocationId: invocation.id, sourceAssetId: assetId };
    const provenance = await createProvenanceRecord(env, user, {
      entityType: "transcript",
      entityId: projectId
        ? `${projectId}:source:${invocation.id}`
        : invocation.id,
      origin: "ai-assisted",
      operation: "transcription",
      provider: invocation.provider,
      model: invocation.model,
      content: transcript,
      textToken: true,
      metadata: { ...metadata },
    });
    return json({
      transcript: appendTextProvenanceMarker(
        transcript,
        provenance.marking.publicToken
      ),
      segments,
      provenance,
    });
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
      rightsConfirmed?: boolean;
    }>(request);
    assertProvenanceConfigured(env);
    const text = stringValue(input.text);
    if (!text) return errorResponse("Add the text you want voiced");
    if (text.length > 5_000) {
      return errorResponse("Voice generation is limited to 5,000 characters");
    }
    if (input.rightsConfirmed !== true) {
      return errorResponse(
        "Confirm that you may use the text and selected voice before generating speech",
        422
      );
    }
    await assertAllowedCreativeUse(env, user, text);
    const voice = stringValue(
      input.voice,
      env.OPENROUTER_TTS_VOICE || "English_Graceful_Lady"
    );
    const model = env.OPENROUTER_TTS_MODEL || "minimax/speech-2.8-turbo";
    const invocation = await beginAiInvocation(
      env,
      user,
      "speech-synthesis",
      "OpenRouter",
      model,
      { text, voice, rightsConfirmed: true }
    );
    let buffer: ArrayBuffer;
    try {
      const response = await fetch(`${OPENROUTER_BASE}/audio/speech`, {
        method: "POST",
        headers: openRouterHeaders(env),
        body: JSON.stringify({
          model,
          input: text,
          voice,
          response_format: "mp3",
        }),
      });
      if (!response.ok) {
        await failAiInvocation(env, invocation, `provider_${response.status}`);
        await providerError(response, "OpenRouter");
      }
      buffer = await response.arrayBuffer();
    } catch (cause) {
      await failAiInvocation(env, invocation, "provider_failure");
      throw cause;
    }
    const assetId = crypto.randomUUID();
    const r2Key = `users/${encodeURIComponent(user.email)}/generated/${assetId}.mp3`;
    const pendingProvenance = await createProvenanceRecord(env, user, {
      entityType: "asset",
      entityId: assetId,
      origin: "ai-generated",
      operation: "speech-synthesis",
      provider: invocation.provider,
      model: invocation.model,
      content: buffer,
      embeddedMediaMarker: true,
      metadata: {
        invocationId: invocation.id,
        voice,
        rightsAttested: true,
      },
    });
    const markedSpeech = embedMediaProvenanceMarker(
      buffer,
      "audio/mpeg",
      pendingProvenance.marking.publicToken || ""
    );
    if (!markedSpeech) {
      await failProvenanceRecord(
        env,
        user,
        pendingProvenance.recordId,
        "asset",
        assetId,
        "unsupported-or-invalid-audio-marker"
      );
      await failAiInvocation(env, invocation, "output_marking_failure");
      throw new Response(
        JSON.stringify({
          error:
            "The generated audio could not be machine-marked, so it was not saved or returned.",
          code: "OUTPUT_MARKING_FAILED",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    try {
      await env.BUCKET.put(r2Key, markedSpeech.bytes, {
        httpMetadata: { contentType: "audio/mpeg" },
        customMetadata: {
          owner: user.email,
          source: "openrouter-tts",
          provenanceToken: pendingProvenance.marking.publicToken || "",
          policyVersion: AI_COMPLIANCE_POLICY_VERSION,
          embeddedMarking: markedSpeech.method,
        },
      });
    } catch {
      await rollbackGeneratedSpeech(
        env,
        user,
        invocation,
        pendingProvenance,
        assetId,
        r2Key,
        "audio-storage-write-failure"
      );
      throw new Response(
        JSON.stringify({
          error:
            "The generated audio could not be stored safely, so it was not saved or returned.",
          code: "OUTPUT_STORAGE_FAILED",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    let provenance: ContentProvenance;
    try {
      const storedSpeech = await env.BUCKET.get(r2Key);
      if (!storedSpeech) throw new Error("Marked audio storage is missing");
      provenance = await finalizeEmbeddedProvenance(
        env,
        user,
        pendingProvenance,
        await storedSpeech.arrayBuffer()
      );
    } catch (cause) {
      await rollbackGeneratedSpeech(
        env,
        user,
        invocation,
        pendingProvenance,
        assetId,
        r2Key,
        "audio-marking-readback-failure"
      );
      throw cause;
    }
    let asset: Asset;
    try {
      asset = await insertAssetRecord(env, user, {
        id: assetId,
        name: `Voice take ${new Date().toLocaleDateString("en-GB")}.mp3`,
        kind: "audio",
        contentType: "audio/mpeg",
        size: markedSpeech.bytes.byteLength,
        r2Key,
      });
    } catch (cause) {
      await rollbackGeneratedSpeech(
        env,
        user,
        invocation,
        pendingProvenance,
        assetId,
        r2Key,
        "asset-persistence-failure"
      );
      throw cause;
    }
    try {
      await completeAiInvocation(env, invocation, await sha256Hex(buffer));
    } catch {
      await rollbackGeneratedSpeech(
        env,
        user,
        invocation,
        pendingProvenance,
        assetId,
        r2Key,
        "invocation-finalization-failure"
      );
      throw new Response(
        JSON.stringify({
          error:
            "The generated audio audit trail could not be finalized, so the output was not released.",
          code: "OUTPUT_AUDIT_FAILED",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return json({ asset: { ...asset, provenance } }, 201);
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
      rightsConfirmed?: boolean;
      referenceContainsRealPerson?: boolean;
      realPersonConsentConfirmed?: boolean;
    }>(request);
    const requestId = stringValue(input.requestId);
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) {
      return errorResponse("A stable video request id is required");
    }
    const prompt = stringValue(input.prompt);
    if (!prompt) return errorResponse("Describe the clip to generate");
    assertProvenanceConfigured(env);
    if (input.rightsConfirmed !== true) {
      return errorResponse(
        "Confirm that you may use the prompt, references, brands and likenesses before generating video",
        422
      );
    }
    if (
      input.referenceContainsRealPerson === true &&
      input.realPersonConsentConfirmed !== true
    ) {
      return errorResponse(
        "A prompt or reference depicting a real person or imitating their voice requires documented consent or another verified legal basis",
        422
      );
    }
    await assertAllowedCreativeUse(env, user, prompt, requestId);
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

    const selectedVideoModel =
      env.OPENROUTER_VIDEO_MODEL || "kwaivgi/kling-v3.0-std";
    const invocation = await beginAiInvocation(
      env,
      user,
      "video-generation",
      "OpenRouter",
      selectedVideoModel,
      {
        prompt,
        duration,
        aspectRatio,
        resolution,
        generateAudio: input.generateAudio !== false,
        firstFrameUrl: firstFrameUrl || null,
        lastFrameUrl: lastFrameUrl || null,
        rightsConfirmed: true,
        referenceContainsRealPerson: input.referenceContainsRealPerson === true,
        realPersonConsentConfirmed: input.realPersonConsentConfirmed === true,
      }
    );
    const response = await fetch(`${OPENROUTER_BASE}/videos`, {
      method: "POST",
      headers: openRouterHeaders(env),
      body: JSON.stringify({
        model: selectedVideoModel,
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
      await failAiInvocation(env, invocation, `provider_${response.status}`);
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
      await failAiInvocation(env, invocation, "missing_provider_job_id");
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
          invocationId: invocation.id,
          model: selectedVideoModel,
          rightsConfirmed: true,
          referenceContainsRealPerson:
            input.referenceContainsRealPerson === true,
          realPersonConsentConfirmed: input.realPersonConsentConfirmed === true,
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
    let jobPayload: Record<string, unknown> = {};
    try {
      jobPayload = recordValue(JSON.parse(row.payload)) || {};
    } catch {
      jobPayload = {};
    }
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
          const videoObject = storedVideo || (await env.BUCKET.get(r2Key));
          if (!videoObject)
            throw new Error("Generated video bytes are missing");
          const videoBytes = await videoObject.arrayBuffer();
          const existingEmbeddedMark = inspectMediaProvenanceMarker(videoBytes);
          const unmarkedVideoBytes =
            existingEmbeddedMark?.unmarkedBytes || videoBytes;
          const pendingProvenance = await createProvenanceRecord(env, user, {
            entityType: "asset",
            entityId: assetId,
            origin: "ai-generated",
            operation: "video-generation",
            provider: "OpenRouter",
            model: stringValue(
              jobPayload.model,
              env.OPENROUTER_VIDEO_MODEL || "kwaivgi/kling-v3.0-std"
            ),
            content: unmarkedVideoBytes,
            embeddedMediaMarker: true,
            metadata: {
              invocationId: stringValue(jobPayload.invocationId) || null,
              providerJobId: row.provider_job_id,
              rightsAttested: jobPayload.rightsConfirmed === true,
              referenceContainsRealPerson:
                jobPayload.referenceContainsRealPerson === true,
              realPersonConsentAttested:
                jobPayload.realPersonConsentConfirmed === true,
            },
          });
          const markedVideo = embedMediaProvenanceMarker(
            videoBytes,
            "video/mp4",
            pendingProvenance.marking.publicToken || ""
          );
          if (!markedVideo) {
            await failProvenanceRecord(
              env,
              user,
              pendingProvenance.recordId,
              "asset",
              assetId,
              "unsupported-or-invalid-video-marker"
            );
            throw new Error("Generated video output marking failed");
          }
          await env.BUCKET.put(r2Key, markedVideo.bytes, {
            httpMetadata: { contentType: "video/mp4" },
            customMetadata: {
              owner: user.email,
              source: "openrouter-video",
              providerJobId: row.provider_job_id,
              provenanceToken: pendingProvenance.marking.publicToken || "",
              policyVersion: AI_COMPLIANCE_POLICY_VERSION,
              embeddedMarking: markedVideo.method,
            },
          });
          const markedVideoObject = await env.BUCKET.get(r2Key);
          if (!markedVideoObject) {
            throw new Error("Marked video storage is missing");
          }
          const provenance = await finalizeEmbeddedProvenance(
            env,
            user,
            pendingProvenance,
            await markedVideoObject.arrayBuffer()
          );
          let asset = await getAssetRow(env, user, assetId).then(existing =>
            existing ? rowToAsset(existing) : null
          );
          if (!asset) {
            asset = await ensureGeneratedAssetRecord(env, user, {
              id: assetId,
              name: `Generated clip ${new Date().toLocaleDateString("en-GB")}.mp4`,
              contentType: "video/mp4",
              size: markedVideo.bytes.byteLength,
              r2Key,
            });
          } else {
            await env.DB.prepare(
              "UPDATE assets SET bytes = ? WHERE id = ? AND owner_email = ?"
            )
              .bind(markedVideo.bytes.byteLength, asset.id, user.email)
              .run();
          }
          if (!asset) throw new Error("Generated video metadata is missing");
          await env.BUCKET.put(
            `${r2Key}.provenance.json`,
            new TextEncoder().encode(
              JSON.stringify({
                scheme: AI_PROVENANCE_SCHEME,
                policyVersion: AI_COMPLIANCE_POLICY_VERSION,
                publicToken: provenance.marking.publicToken,
                contentSha256: await sha256Hex(unmarkedVideoBytes),
              })
            ),
            { httpMetadata: { contentType: "application/json" } }
          );
          const invocationId = stringValue(jobPayload.invocationId);
          if (invocationId) {
            await completeAiInvocation(
              env,
              {
                id: invocationId,
                provider: "OpenRouter",
                model: provenance.model,
                purpose: "video-generation",
              },
              await sha256Hex(unmarkedVideoBytes)
            );
          }
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
          const failedAssetId = `video-${id}`;
          const failedR2Key = `users/${encodeURIComponent(
            user.email
          )}/generated/${failedAssetId}.mp4`;
          await env.BUCKET.delete(failedR2Key).catch(() => undefined);
          await env.BUCKET.delete(`${failedR2Key}.provenance.json`).catch(
            () => undefined
          );
          await env.DB.prepare(
            "DELETE FROM assets WHERE id = ? AND owner_email = ?"
          )
            .bind(failedAssetId, user.email)
            .run()
            .catch(() => undefined);
          const failedProvenance = await provenanceByEntity(
            env,
            user,
            "asset",
            failedAssetId
          ).catch(() => null);
          if (failedProvenance) {
            await failProvenanceRecord(
              env,
              user,
              failedProvenance.id,
              "asset",
              failedAssetId,
              "video-finalization-rollback"
            ).catch(() => undefined);
          }
          const invocationId = stringValue(jobPayload.invocationId);
          if (invocationId) {
            await failAiInvocation(
              env,
              {
                id: invocationId,
                provider: "OpenRouter",
                model: stringValue(jobPayload.model, "unknown"),
                purpose: "video-generation",
              },
              "output_marking_or_storage_failure"
            );
          }
          await env.DB.prepare(
            `
            UPDATE generation_jobs
            SET finalizing_at = NULL, status = 'failed', progress = 100,
                error = 'The generated output could not be marked and verified',
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
      const failureReference = logProviderFailure(
        "OpenRouter",
        "video-generation-status",
        { status: statusPayload.status }
      );
      const invocationId = stringValue(jobPayload.invocationId);
      if (invocationId) {
        await failAiInvocation(
          env,
          {
            id: invocationId,
            provider: "OpenRouter",
            model: stringValue(jobPayload.model, "unknown"),
            purpose: "video-generation",
          },
          `provider_${statusPayload.status}`
        );
      }
      await env.DB.prepare(
        `
        UPDATE generation_jobs
        SET status = 'failed', progress = 100, error = ?, updated_at = ?
        WHERE id = ? AND owner_email = ?
      `
      )
        .bind(
          clientProviderFailureMessage(
            "The video provider reported a generation failure.",
            failureReference
          ),
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
  const assetProvenance = asset
    ? await provenanceByEntity(env, user, "asset", asset.id)
    : null;
  return json({
    job: jobFromRow(row as JobRow),
    ...(asset ? { asset: rowToAsset(asset, assetProvenance) } : {}),
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

export function publicationReviewFromInput(
  value: unknown,
  facts: { authenticatedAiText?: boolean; hasMedia?: boolean } = {}
): PublicationComplianceReview {
  const row = recordValue(value);
  if (!row || row.policyVersion !== AI_COMPLIANCE_POLICY_VERSION) {
    throw new Response(
      JSON.stringify({
        error: "Complete the current release check before publishing",
        code: "RELEASE_REVIEW_REQUIRED",
      }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }
  const answers = recordValue(row.classificationAnswers);
  const aiGeneratedTextAnswer = stringValue(answers?.aiGeneratedText);
  const realisticSyntheticMediaAnswer = stringValue(
    answers?.realisticSyntheticMedia
  );
  const depictsRealPersonOrVoiceAnswer = stringValue(
    answers?.depictsRealPersonOrVoice
  );
  const creativeOrFictionalWorkAnswer = stringValue(
    answers?.creativeOrFictionalWork
  );
  const publicInterestTextAnswer = stringValue(answers?.publicInterestText);
  const yesOrNo = (answer: string) => answer === "yes" || answer === "no";
  const classificationComplete =
    yesOrNo(aiGeneratedTextAnswer) &&
    yesOrNo(publicInterestTextAnswer) &&
    (facts.hasMedia
      ? yesOrNo(realisticSyntheticMediaAnswer) &&
        yesOrNo(depictsRealPersonOrVoiceAnswer) &&
        (realisticSyntheticMediaAnswer === "yes"
          ? yesOrNo(creativeOrFictionalWorkAnswer)
          : creativeOrFictionalWorkAnswer === "not-applicable")
      : realisticSyntheticMediaAnswer === "not-applicable" &&
        depictsRealPersonOrVoiceAnswer === "not-applicable" &&
        creativeOrFictionalWorkAnswer === "not-applicable");
  if (!classificationComplete) {
    throw new Response(
      JSON.stringify({
        error:
          "Answer every applicable release-classification question with Yes or No",
        code: "RELEASE_CLASSIFICATION_INCOMPLETE",
      }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }
  if (facts.authenticatedAiText && aiGeneratedTextAnswer !== "yes") {
    throw new Response(
      JSON.stringify({
        error:
          "The caption carries an authenticated AI-origin record. Classify the final text as AI-generated or materially AI-edited before release.",
        code: "AI_TEXT_CLASSIFICATION_CONFLICT",
      }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }
  if (row.intendedUseConfirmed !== true) {
    throw new Response(
      JSON.stringify({
        error: "Confirm this is a creative or marketing publication",
        code: "INTENDED_USE_CONFIRMATION_REQUIRED",
      }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }
  if (row.rightsConfirmed !== true) {
    throw new Response(
      JSON.stringify({
        error: "Confirm the rights, licences and permissions for this release",
        code: "RIGHTS_CONFIRMATION_REQUIRED",
      }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }
  const rightsBasis = stringValue(row.rightsBasis);
  if (
    !["owned-or-licensed", "documented-consent", "not-applicable"].includes(
      rightsBasis
    )
  ) {
    throw new Response(
      JSON.stringify({ error: "Choose the rights basis for this release" }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }
  const reviewedAt = stringValue(row.reviewedAt);
  const reviewedTime = new Date(reviewedAt).getTime();
  if (
    !reviewedAt ||
    !Number.isFinite(reviewedTime) ||
    reviewedTime > Date.now() + 5 * 60 * 1000 ||
    reviewedTime < Date.now() - 24 * 60 * 60 * 1000
  ) {
    throw new Response(
      JSON.stringify({ error: "Refresh the release check before publishing" }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  const containsAiGeneratedText = aiGeneratedTextAnswer === "yes";
  const containsRealisticSyntheticMedia =
    realisticSyntheticMediaAnswer === "yes";
  const depictsRealPersonOrVoice = depictsRealPersonOrVoiceAnswer === "yes";
  const publicInterestText = publicInterestTextAnswer === "yes";
  const substantiveHumanReview = row.substantiveHumanReview === true;
  const materialAiEditsAfterReview = row.materialAiEditsAfterReview === true;
  const editorialResponsibilityName = stringValue(
    row.editorialResponsibilityName
  ).slice(0, 180);
  const disclosureLanguageInput = stringValue(row.disclosureLanguage);
  if (disclosureLanguageInput !== "en" && disclosureLanguageInput !== "it") {
    throw new Response(
      JSON.stringify({
        error:
          "Choose English or Italian as the audience-facing disclosure language for this release",
        code: "DISCLOSURE_LANGUAGE_REQUIRED",
      }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }
  const disclosureLanguage = disclosureLanguageInput;

  if (depictsRealPersonOrVoice && rightsBasis !== "documented-consent") {
    throw new Response(
      JSON.stringify({
        error:
          "A real person's image or voice requires a documented-consent basis in this release workflow",
        code: "PERSON_CONSENT_REQUIRED",
      }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }
  if (materialAiEditsAfterReview) {
    throw new Response(
      JSON.stringify({
        error: "Review the final version again after the latest AI edits",
        code: "HUMAN_REVIEW_STALE",
      }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  const publicInterestException = Boolean(
    containsAiGeneratedText &&
    publicInterestText &&
    substantiveHumanReview &&
    editorialResponsibilityName
  );
  const disclosureRequired =
    containsRealisticSyntheticMedia ||
    (containsAiGeneratedText && publicInterestText && !publicInterestException);
  const reasons: Array<
    Exclude<
      PublicationComplianceReview["visibleDisclosure"]["reason"],
      "not-required"
    >
  > = [];
  if (containsRealisticSyntheticMedia)
    reasons.push("realistic-synthetic-media");
  if (
    containsAiGeneratedText &&
    publicInterestText &&
    !publicInterestException
  ) {
    reasons.push("public-interest-text");
  }
  const reason = reasons[0] || "not-required";
  const canonicalDisclosure = disclosureRequired
    ? requiredDisclosureText(
        {
          containsRealisticSyntheticMedia,
          publicInterestText: reasons.includes("public-interest-text"),
        },
        disclosureLanguage
      ) || undefined
    : undefined;

  return {
    policyVersion: AI_COMPLIANCE_POLICY_VERSION,
    reviewedAt,
    disclosureLanguage,
    intendedUseConfirmed: true,
    rightsConfirmed: true,
    rightsBasis: rightsBasis as PublicationComplianceReview["rightsBasis"],
    containsAiGeneratedText,
    containsRealisticSyntheticMedia,
    depictsRealPersonOrVoice,
    classificationAnswers: {
      aiGeneratedText: containsAiGeneratedText ? "yes" : "no",
      realisticSyntheticMedia: facts.hasMedia
        ? containsRealisticSyntheticMedia
          ? "yes"
          : "no"
        : "not-applicable",
      depictsRealPersonOrVoice: facts.hasMedia
        ? depictsRealPersonOrVoice
          ? "yes"
          : "no"
        : "not-applicable",
      creativeOrFictionalWork: containsRealisticSyntheticMedia
        ? creativeOrFictionalWorkAnswer === "yes"
          ? "yes"
          : "no"
        : "not-applicable",
      publicInterestText: publicInterestText ? "yes" : "no",
    },
    creativeOrFictionalWork: creativeOrFictionalWorkAnswer === "yes",
    publicInterestText,
    substantiveHumanReview,
    materialAiEditsAfterReview: false,
    ...(editorialResponsibilityName ? { editorialResponsibilityName } : {}),
    visibleDisclosure: {
      required: disclosureRequired,
      reason,
      ...(reasons.length ? { reasons } : {}),
      method: disclosureRequired ? "caption" : "not-required",
      ...(canonicalDisclosure ? { text: canonicalDisclosure } : {}),
      language: disclosureLanguage,
    },
  };
}

export function appendReleaseDisclosure(
  content: string,
  review: PublicationComplianceReview
): string {
  const disclosure = review.visibleDisclosure.text;
  if (!review.visibleDisclosure.required || !disclosure) return content;

  // The canonical cue belongs at first exposure. A matching phrase later in
  // the caption does not satisfy that placement requirement. If an exact cue
  // is already leading, normalize its separator instead of adding a duplicate.
  const leadingCandidate = content.trimStart();
  const lowerCandidate = leadingCandidate.toLocaleLowerCase();
  const lowerDisclosure = disclosure.toLocaleLowerCase();
  if (lowerCandidate.startsWith(lowerDisclosure)) {
    const boundary = leadingCandidate.slice(
      disclosure.length,
      disclosure.length + 1
    );
    if (!boundary || /\s/.test(boundary)) {
      const remainder = leadingCandidate.slice(disclosure.length).trimStart();
      return remainder ? `${disclosure}\n\n${remainder}` : disclosure;
    }
  }
  // Article 50 visible cues must survive first-exposure truncation. Put the
  // compact canonical cue before the caption/hashtags, never behind “more”.
  return `${disclosure}\n\n${content}`;
}

export function providerPostState(
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
  const existingSafeFailure =
    current.status === "failed" &&
    Boolean(current.statusCheckedAt) &&
    (/^The publishing provider reported a delivery failure\. Reference: [0-9a-f-]{36}\.$/i.test(
      stringValue(current.failureReason)
    ) ||
      current.failureReason ===
        "The publishing provider reported a delivery failure.")
      ? current.failureReason
      : undefined;
  const safeProviderStatus = /^[a-z0-9_-]{1,64}$/i.test(providerStatus)
    ? providerStatus
    : "unknown";
  const failureReason =
    status === "failed"
      ? existingSafeFailure ||
        clientProviderFailureMessage(
          "The publishing provider reported a delivery failure.",
          logProviderFailure("Zernio", "publication-delivery-status", {
            status: safeProviderStatus,
          })
        )
      : undefined;
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
    providerStatus: safeProviderStatus,
    statusCheckedAt: checkedAt,
    publishedAt,
    publishedUrls: publishedUrls.length ? publishedUrls : undefined,
    failureReason,
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
    const suppliedCaption = input.post.caption.trim();
    const canonicalCaption =
      withoutTextProvenanceMarker(suppliedCaption).trim();
    const sourceToken = extractTextProvenanceToken(suppliedCaption);
    if (!sourceToken && canonicalCaption !== suppliedCaption) {
      return errorResponse(
        "The caption contains a malformed provenance marker. Restore the original marked text or remove the damaged marker before review.",
        422
      );
    }
    let sourceTextProvenance: ProvenanceRow | null = null;
    if (sourceToken) {
      sourceTextProvenance = await env.DB.prepare(
        `
          SELECT * FROM ai_provenance_records
          WHERE owner_email = ? AND public_token = ?
          ORDER BY created_at DESC LIMIT 1
        `
      )
        .bind(user.email, sourceToken)
        .first<ProvenanceRow>();
      if (
        !sourceTextProvenance ||
        sourceTextProvenance.marking_status !== "verified" ||
        !(await tokenIsAuthentic(env, sourceTextProvenance))
      ) {
        return errorResponse(
          "The caption's provenance token is not an authentic record for this workspace",
          422
        );
      }
      const suppliedFingerprint = await sha256Hex(canonicalCaption);
      if (sourceTextProvenance.content_sha256 !== suppliedFingerprint) {
        return errorResponse(
          "The marked caption changed after its provenance record. Save the edited version first so REELassati can create a new derivative record.",
          422
        );
      }
    }
    await assertAllowedCreativeUse(env, user, canonicalCaption, intentId);
    const complianceReview = publicationReviewFromInput(
      input.post.complianceReview,
      {
        authenticatedAiText: Boolean(sourceTextProvenance),
        hasMedia: Boolean(input.post.mediaAssetId),
      }
    );
    const readiness = await complianceStatus(env);
    if (!readiness.publicLaunchReady) {
      return json(
        {
          error:
            "External publishing is locked until the platform's public-release evidence is complete",
          code: "PUBLIC_RELEASE_NOT_READY",
          blockers: readiness.blockers,
        },
        423
      );
    }
    if (
      input.post.mediaAssetId &&
      complianceReview.rightsBasis === "not-applicable"
    ) {
      return errorResponse(
        "Choose an ownership, licence or documented-consent basis for the selected media",
        422
      );
    }
    let selectedMediaRow: AssetRow | null = null;
    let selectedMediaProvenance: ProvenanceRow | null = null;
    if (input.post.mediaAssetId) {
      selectedMediaRow = await getAssetRow(env, user, input.post.mediaAssetId);
      if (!selectedMediaRow) {
        return errorResponse("The selected media asset was not found", 404);
      }
      selectedMediaProvenance = await provenanceByEntity(
        env,
        user,
        "asset",
        selectedMediaRow.id
      );
      const generatedStoragePath =
        selectedMediaRow.r2_key.includes("/generated/");
      if (generatedStoragePath && !selectedMediaProvenance) {
        return errorResponse(
          "This older generated asset has no verifiable output mark. Regenerate it with the current protected workflow before publishing.",
          422
        );
      }
      if (
        selectedMediaProvenance &&
        selectedMediaProvenance.marking_status !== "verified"
      ) {
        return errorResponse(
          "The selected generated media does not have a verified output mark",
          422
        );
      }
    }
    const intentRequest = JSON.stringify({
      caption: canonicalCaption,
      hashtags: input.post.hashtags,
      mediaAssetId: input.post.mediaAssetId || null,
      accountIds: input.post.accountIds,
      scheduledAt: input.post.scheduledAt || null,
      publishNow,
      complianceReview,
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
      content = [canonicalCaption, hashtagText].filter(Boolean).join("\n\n");
      content = appendReleaseDisclosure(content, complianceReview);
      if (complianceReview.containsAiGeneratedText) {
        const publicationProvenance = await createProvenanceRecord(env, user, {
          entityType: "publication",
          entityId: intentId,
          origin: sourceTextProvenance ? "ai-manipulated" : "ai-generated",
          operation: "publication-marking",
          provider:
            sourceTextProvenance?.provider ||
            "Upstream AI declared by the deployer",
          model: sourceTextProvenance?.model || "not-recorded",
          content,
          textToken: true,
          metadata: {
            ...(sourceTextProvenance
              ? { parentRecordId: sourceTextProvenance.id }
              : {}),
            publicInterestText: complianceReview.publicInterestText,
            substantiveHumanReview: complianceReview.substantiveHumanReview,
            disclosureLanguage: complianceReview.disclosureLanguage,
          },
        });
        const token = publicationProvenance.marking.publicToken;
        if (token) {
          content = appendTextProvenanceMarker(content, token);
        }
      }
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
      await recordComplianceEvent(env, {
        ownerEmail: user.email,
        eventType: "publication.release-reviewed",
        entityType: "publication",
        entityId: intentId,
        details: {
          realisticSyntheticMedia:
            complianceReview.containsRealisticSyntheticMedia,
          publicInterestText: complianceReview.publicInterestText,
          disclosureRequired: complianceReview.visibleDisclosure.required,
          disclosureLanguage: complianceReview.disclosureLanguage,
          rightsBasis: complianceReview.rightsBasis,
          mediaProvenanceVerified: Boolean(selectedMediaProvenance),
        },
      });
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
            const media =
              selectedMediaRow ||
              (await getAssetRow(env, user, input.post.mediaAssetId));
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
            let uploadBody: ReadableStream | ArrayBuffer = object.body;
            let uploadSize = object.size;
            const finalMediaProvenance = await provenanceByEntity(
              env,
              user,
              "asset",
              media.id
            );
            if (media.r2_key.includes("/generated/")) {
              if (
                !finalMediaProvenance ||
                finalMediaProvenance.marking_status !== "verified" ||
                object.customMetadata?.provenanceToken !==
                  finalMediaProvenance.public_token ||
                !(await tokenIsAuthentic(env, finalMediaProvenance))
              ) {
                throw errorResponse(
                  "The final generated media mark could not be authenticated",
                  422
                );
              }
              const finalBytes = await object.arrayBuffer();
              const inspected = inspectMediaProvenanceMarker(finalBytes);
              if (
                !inspected ||
                inspected.token !== finalMediaProvenance.public_token ||
                (await sha256Hex(inspected.unmarkedBytes)) !==
                  finalMediaProvenance.content_sha256
              ) {
                throw errorResponse(
                  "The final generated media bytes no longer match their verified output mark",
                  422
                );
              }
              uploadBody = finalBytes;
              uploadSize = finalBytes.byteLength;
            }
            const uploadResponse = await fetch(uploadUrl, {
              method: "PUT",
              redirect: "error",
              headers: {
                "Content-Type": media.content_type,
                "Content-Length": String(uploadSize),
              },
              body: uploadBody,
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
    if (!content && intent.provider_request) {
      try {
        const savedProviderRequest = JSON.parse(intent.provider_request) as {
          content?: unknown;
        };
        content = stringValue(savedProviderRequest.content);
      } catch {
        // A legacy provider request may not be JSON. Do not invent an outgoing
        // payload; the durable intent remains available for investigation.
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
        ...(content ? { outgoingContent: content } : {}),
        complianceReview,
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
      .bind(id, code, referral.owner_email, user.email, createdAt)
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

function publicProvenanceResult(
  row: ProvenanceRow,
  method: "text-token" | "sha256-fingerprint" | "embedded-media-marker",
  verification:
    "artifact-verified" | "record-authentic" | "artifact-mismatch" | "unmatched"
): ProvenanceDetectionResult {
  return {
    matched: verification === "artifact-verified",
    recordFound: true,
    verification,
    method,
    provenance: {
      origin: row.origin,
      operation: row.operation,
      provider: row.provider,
      model: row.model,
      generatedAt: row.created_at,
      policyVersion: row.policy_version,
      markingStatus: row.marking_status,
    },
  };
}

async function handlePublicProvenance(
  request: Request,
  env: SitesEnvironment,
  url: URL
): Promise<Response> {
  assertProvenanceConfigured(env);
  await initializeSchema(env);

  const tokenMatch = /^\/api\/provenance\/([A-Za-z0-9_-]{16,96})$/.exec(
    url.pathname
  );
  if (tokenMatch && request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT * FROM ai_provenance_records WHERE public_token = ? LIMIT 1"
    )
      .bind(tokenMatch[1])
      .first<ProvenanceRow>();
    if (!row || !(await tokenIsAuthentic(env, row))) {
      return json({
        matched: false,
        verification: "unmatched",
      } satisfies ProvenanceDetectionResult);
    }
    return json(publicProvenanceResult(row, "text-token", "record-authentic"));
  }

  if (url.pathname !== "/api/provenance/detect" || request.method !== "POST") {
    return errorResponse("Provenance route not found", 404);
  }

  let token = "";
  let fingerprint = "";
  let embeddedToken = false;
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (!Number.isFinite(contentLength) || contentLength <= 0) {
      return errorResponse("A known file size is required", 411);
    }
    if (contentLength > MAX_UPLOAD_BYTES + 1024 * 1024) {
      return errorResponse("Detection files are limited to 64 MB", 413);
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return errorResponse("Choose a file to check");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return errorResponse("Detection files are limited to 64 MB", 413);
    }
    const fileBytes = await file.arrayBuffer();
    const embeddedMark = inspectMediaProvenanceMarker(fileBytes);
    if (embeddedMark) {
      token = embeddedMark.token;
      embeddedToken = true;
      fingerprint = await sha256Hex(embeddedMark.unmarkedBytes);
    } else if (
      file.size <= MAX_WORKSPACE_BYTES &&
      (file.type.startsWith("text/") ||
        file.type === "application/json" ||
        /\.(?:txt|md|json|csv|srt|vtt)$/i.test(file.name))
    ) {
      const decodedText = new TextDecoder().decode(fileBytes);
      token = extractTextProvenanceToken(decodedText) || "";
      fingerprint = await sha256Hex(
        token ? withoutTextProvenanceMarker(decodedText) : fileBytes
      );
    } else {
      fingerprint = await sha256Hex(fileBytes);
    }
  } else {
    const input = await parseJsonBody<{
      text?: string;
      token?: string;
      sha256?: string;
    }>(request);
    const text = typeof input.text === "string" ? input.text : "";
    token = stringValue(input.token) || extractTextProvenanceToken(text) || "";
    fingerprint = stringValue(input.sha256).toLowerCase();
    if (!fingerprint && text) {
      fingerprint = await sha256Hex(withoutTextProvenanceMarker(text));
    }
  }

  let row: ProvenanceRow | null = null;
  let method: "text-token" | "sha256-fingerprint" | "embedded-media-marker" =
    "sha256-fingerprint";
  if (/^[A-Za-z0-9_-]{16,96}$/.test(token)) {
    row = await env.DB.prepare(
      "SELECT * FROM ai_provenance_records WHERE public_token = ? LIMIT 1"
    )
      .bind(token)
      .first<ProvenanceRow>();
    method = embeddedToken ? "embedded-media-marker" : "text-token";
  } else if (/^[a-f0-9]{64}$/.test(fingerprint)) {
    row = await env.DB.prepare(
      `
        SELECT * FROM ai_provenance_records
        WHERE content_sha256 = ? AND marking_status = 'verified'
        ORDER BY created_at DESC LIMIT 1
      `
    )
      .bind(fingerprint)
      .first<ProvenanceRow>();
  } else {
    return errorResponse("Paste marked text or choose a file to check");
  }
  if (row && !(await tokenIsAuthentic(env, row))) row = null;

  const verification = row
    ? fingerprint
      ? row.content_sha256 === fingerprint
        ? "artifact-verified"
        : "artifact-mismatch"
      : "record-authentic"
    : "unmatched";
  const response = row
    ? json(publicProvenanceResult(row, method, verification))
    : json({
        matched: false,
        verification,
      } satisfies ProvenanceDetectionResult);
  response.headers.set("X-REELassati-Retention", "none");
  return response;
}

async function complianceStatus(
  env: SitesEnvironment
): Promise<ComplianceStatus> {
  await initializeSchema(env);
  const operatorEmail = operatorOwnerEmail(env);
  const row = operatorEmail
    ? await env.DB.prepare(
        "SELECT * FROM operator_compliance WHERE owner_email = ?"
      )
        .bind(operatorEmail)
        .first<OperatorComplianceRow>()
    : null;
  const markingAndDetectionReady = Boolean(
    env.AI_PROVENANCE_SIGNING_KEY && env.AI_PROVENANCE_SIGNING_KEY.length >= 24
  );
  const markingValidationVerified =
    env.AI_MARKING_VALIDATION_STATUS === "verified";
  const providerEvidenceVerified =
    env.AI_PROVIDER_EVIDENCE_STATUS === "verified";
  const legalReviewRecorded = env.AI_LEGAL_REVIEW_STATUS === "verified";
  const incidentOperationsVerified =
    env.AI_INCIDENT_OPERATIONS_STATUS === "verified";
  const provenanceLifecycleVerified =
    env.AI_PROVENANCE_LIFECYCLE_STATUS === "verified";
  const kimiTestModeDisabled = env.KIMI_TEST_MODE !== "enabled";
  const blockers: string[] = [];
  if (!operatorEmail) {
    blockers.push("Configure the authorized compliance operator account");
  }
  if (!row?.legal_name) blockers.push("Add the exact legal operator identity");
  if (row?.release_status !== "public") {
    blockers.push("Keep public release blocked until release status is public");
  }
  if (!row?.first_eu_availability_date) {
    blockers.push("Record the first EU availability date");
  }
  if (!row?.creative_scope_confirmed_at) {
    blockers.push("Confirm the creative/marketing-only intended use");
  }
  if (!row?.ai_literacy_acknowledged_at) {
    blockers.push("Complete the role-specific AI literacy review");
  }
  if (!markingAndDetectionReady) {
    blockers.push("Configure output marking and public detection");
  }
  if (!markingValidationVerified) {
    blockers.push(
      "Record independent marking interoperability and transform-survival validation"
    );
  }
  if (!providerEvidenceVerified) {
    blockers.push("Complete the upstream provider/model evidence review");
  }
  if (!legalReviewRecorded) {
    blockers.push("Record Italian and applicable non-AI-Act legal review");
  }
  if (!incidentOperationsVerified) {
    blockers.push(
      "Assign and evidence incident-response and monitoring owners"
    );
  }
  if (!provenanceLifecycleVerified) {
    blockers.push(
      "Validate provenance retention, key rotation, revocation and recovery"
    );
  }
  if (!kimiTestModeDisabled) {
    blockers.push("Disable the owner-only Kimi subscription test route");
  }
  return {
    policyVersion: AI_COMPLIANCE_POLICY_VERSION,
    intendedUse: "creative-marketing-only",
    operatorIdentityConfigured: Boolean(row?.legal_name),
    ...(row?.legal_name ? { operatorName: row.legal_name } : {}),
    ...(row?.entity_type &&
    ["individual", "company", "other"].includes(row.entity_type)
      ? {
          operatorEntityType:
            row.entity_type as ComplianceStatus["operatorEntityType"],
        }
      : {}),
    ...(row?.release_status ? { releaseStatus: row.release_status } : {}),
    ...(row?.first_eu_availability_date
      ? { firstEuAvailabilityDate: row.first_eu_availability_date }
      : {}),
    creativeScopeConfirmed: Boolean(row?.creative_scope_confirmed_at),
    ...(row?.ai_literacy_acknowledged_at
      ? { aiLiteracyAcknowledgedAt: row.ai_literacy_acknowledged_at }
      : {}),
    markingAndDetectionReady,
    markingValidationVerified,
    providerEvidenceVerified,
    legalReviewRecorded,
    incidentOperationsVerified,
    provenanceLifecycleVerified,
    kimiTestModeDisabled,
    publicLaunchReady: blockers.length === 0,
    blockers,
  };
}

async function handleCompliance(
  request: Request,
  env: SitesEnvironment,
  user: AuthenticatedUser,
  url: URL
): Promise<Response> {
  await initializeSchema(env);
  const operatorEmail = operatorOwnerEmail(env);
  if (url.pathname === "/api/compliance/status" && request.method === "GET") {
    return json({ status: await complianceStatus(env) });
  }

  if (!operatorEmail) {
    return errorResponse(
      "Compliance operator authorization is not configured",
      503,
      ["COMPLIANCE_OPERATOR_OWNER_EMAIL"]
    );
  }

  if (user.email !== operatorEmail) {
    return errorResponse(
      "Only the configured platform operator can change deployment compliance records",
      403
    );
  }

  if (url.pathname === "/api/compliance/operator" && request.method === "PUT") {
    const input = await parseJsonBody<{
      legalName?: string;
      entityType?: string;
      releaseStatus?: string;
      firstEuAvailabilityDate?: string;
      creativeScopeConfirmed?: boolean;
    }>(request);
    const legalName = stringValue(input.legalName).slice(0, 240);
    const entityType = stringValue(input.entityType);
    const releaseStatus = stringValue(input.releaseStatus);
    const firstEuAvailabilityDate = stringValue(input.firstEuAvailabilityDate);
    if (!legalName) return errorResponse("Enter the exact legal operator name");
    if (!["individual", "company", "other"].includes(entityType)) {
      return errorResponse("Choose the operator type");
    }
    if (!["private-testing", "closed-beta", "public"].includes(releaseStatus)) {
      return errorResponse("Choose the current release status");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(firstEuAvailabilityDate)) {
      return errorResponse("Enter the first EU availability date");
    }
    const availabilityTime = new Date(
      `${firstEuAvailabilityDate}T00:00:00.000Z`
    ).getTime();
    if (
      !Number.isFinite(availabilityTime) ||
      new Date(availabilityTime).toISOString().slice(0, 10) !==
        firstEuAvailabilityDate ||
      availabilityTime > Date.now()
    ) {
      return errorResponse("Enter a valid first EU availability date");
    }
    if (input.creativeScopeConfirmed !== true) {
      return errorResponse(
        "Confirm the permanent creative/marketing intended-use boundary"
      );
    }
    const now = new Date().toISOString();
    await env.DB.prepare(
      `
        INSERT INTO operator_compliance
          (owner_email, legal_name, entity_type, release_status,
           first_eu_availability_date, creative_scope_confirmed_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner_email) DO UPDATE SET
          legal_name = excluded.legal_name,
          entity_type = excluded.entity_type,
          release_status = excluded.release_status,
          first_eu_availability_date = excluded.first_eu_availability_date,
          creative_scope_confirmed_at = excluded.creative_scope_confirmed_at,
          updated_at = excluded.updated_at
      `
    )
      .bind(
        operatorEmail,
        legalName,
        entityType,
        releaseStatus,
        firstEuAvailabilityDate,
        now,
        now
      )
      .run();
    await recordComplianceEvent(env, {
      ownerEmail: operatorEmail,
      eventType: "operator.scope-confirmed",
      entityType: "operator",
      entityId: operatorEmail,
      details: { entityType, releaseStatus, firstEuAvailabilityDate },
    });
    return json({ status: await complianceStatus(env) });
  }

  if (
    url.pathname === "/api/compliance/ai-literacy" &&
    request.method === "POST"
  ) {
    const input = await parseJsonBody<{ acknowledged?: boolean }>(request);
    if (input.acknowledged !== true) {
      return errorResponse("Confirm completion of the role-specific review");
    }
    const now = new Date().toISOString();
    await env.DB.prepare(
      `
        INSERT INTO operator_compliance
          (owner_email, ai_literacy_acknowledged_at, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(owner_email) DO UPDATE SET
          ai_literacy_acknowledged_at = excluded.ai_literacy_acknowledged_at,
          updated_at = excluded.updated_at
      `
    )
      .bind(operatorEmail, now, now)
      .run();
    await recordComplianceEvent(env, {
      ownerEmail: operatorEmail,
      eventType: "operator.ai-literacy-reviewed",
      entityType: "operator",
      entityId: operatorEmail,
      details: { article: "4" },
    });
    return json({ status: await complianceStatus(env) });
  }

  return errorResponse("Compliance route not found", 404);
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

  if (url.pathname.startsWith("/api/provenance/")) {
    return handlePublicProvenance(request, env, url);
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
      capabilities: capabilities(env, user),
    });
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    return json({ ok: true });
  }

  if (url.pathname === "/api/capabilities" && request.method === "GET") {
    return json({ capabilities: capabilities(env, user) });
  }

  if (url.pathname === "/api/referrals" && request.method === "GET") {
    return referralStats(env, user, url);
  }

  if (url.pathname === "/api/referrals/claim" && request.method === "POST") {
    return claimReferral(request, env, user);
  }

  if (url.pathname.startsWith("/api/compliance/")) {
    return handleCompliance(request, env, user, url);
  }

  if (url.pathname === "/api/workspace") {
    if (request.method === "GET") {
      return json({
        workspace: await getWorkspace(env, user),
        capabilities: capabilities(env, user),
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

  const editBriefMatch = url.pathname.match(
    /^\/api\/projects\/([^/]+)\/edit-brief$/
  );
  if (editBriefMatch) {
    if (request.method !== "GET") {
      return errorResponse("Method not allowed", 405);
    }
    return json(
      await createAuthoritativeEditBrief(
        env,
        user,
        decodeURIComponent(editBriefMatch[1])
      )
    );
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
        const reference = crypto.randomUUID();
        const user = getUser(request);
        console.error("Unhandled REELassati request failure", {
          reference,
          method: request.method,
          path: url.pathname,
          errorType: cause instanceof Error ? cause.name : typeof cause,
        });
        if (user && env.DB) {
          await initializeSchema(env)
            .then(() =>
              recordComplianceEvent(env, {
                ownerEmail: user.email,
                eventType: "incident.unhandled-request",
                entityType: "request",
                entityId: reference,
                details: {
                  method: request.method,
                  path: url.pathname,
                  errorType: cause instanceof Error ? cause.name : typeof cause,
                },
              })
            )
            .catch(() => undefined);
        }
        return withSecurityHeaders(
          json(
            {
              error: "Unexpected server error",
              reference,
            },
            500
          )
        );
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
