import { SOCIAL_METRICS } from "../contracts/social-analytics";
import { isAuthorizedMaintenanceIdentity } from "../contracts/maintenance";
import { VOICE_PREVIEWS } from "../contracts/voices";
import {
  parseSocialPost,
  type SocialAnalyticsResponse,
} from "../contracts/social-analytics";
import {
  createEmptyWorkspace,
  type Asset,
  type CalendarEvent,
  type CalendarEventKind,
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
import { MAX_AI_MEDIA_BYTES, MAX_UPLOAD_BYTES } from "../contracts/uploads";
import {
  ANNUAL_BILLED_MONTHS,
  annualMonthlyEquivalent,
  customTrendResearchCreditCost,
  PUBLIC_PLAN_PRICING,
} from "../contracts/pricing";
import {
  AI_CREDIT_COSTS,
  CREDIT_TOP_UPS,
  imageCreditCost,
  speechCreditCost,
  timedCreditCost,
  videoCreditCost,
} from "../contracts/billing";
import {
  applyAllDueAnnualCreditRenewals,
  availableCredits,
  billingSummary,
  grantReferralCredits,
  handleBillingApi,
  handleStripeWebhook,
  releaseCreditReservation,
  reserveCredits,
  settleCreditReservation,
  socialAccountLimit,
  stripeBillingConfigured,
  stripeReadiness,
  type CreditReservation,
} from "./billing";
import type {
  TrendEvidenceItem,
  TrendFeedResponse,
  TrendContentType,
  TrendLifecycle,
  TrendObjective,
  TrendPlatform,
  TrendScope,
} from "../contracts/trends";
import { weeklyTrendFeedStatus } from "../contracts/trends";
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";

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
  OPENROUTER_IMAGE_MODEL?: string;
  OPENROUTER_TREND_MODEL?: string;
  OPENROUTER_VIDEO_MODEL?: string;
  OPENROUTER_CONTINUITY_VIDEO_MODEL?: string;
  OPENROUTER_WEBHOOK_SECRET?: string;
  REFERRAL_BILLING_WEBHOOK_SECRET?: string;
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
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  RESEND_API_KEY?: string;
  SUPPORT_EMAIL_TO?: string;
  SUPPORT_EMAIL_FROM?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_IDS_JSON?: string;
  PUBLIC_APP_URL?: string;
};

interface AuthenticatedUser {
  brandId?: string;
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
  brand_id?: string;
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

interface SupportMessage {
  role: "user" | "assistant";
  content: string;
}

interface SupportAction {
  label: string;
  message: string;
}

interface SupportTicketInput {
  email?: string;
  name?: string;
  category?: string;
  priority?: string;
  subject?: string;
  description?: string;
  conversation?: SupportMessage[];
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
  release_status: "public" | null;
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
const REFERRAL_REWARD_CREDITS = 500;
const REFERRAL_REWARD_CENTS = 500;
const TREND_WEEKLY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TREND_REFRESH_LEASE_MS = 10 * 60 * 1000;
const TREND_WEEKLY_SCOPE_KEY = "weekly:organic-brand-hyperviral-shorts:v2";
const TREND_MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;
const TREND_MIN_VIEWS = 500_000;
const TREND_MIN_LIKES = 50_000;
const TREND_MIN_COMMENTS = 5_000;
const TREND_MIN_SHARES = 10_000;
const TREND_SYSTEM_OWNER: AuthenticatedUser = {
  email: "trend-system@reelassati.app",
  name: "REELassati Trends",
};
const VERCEL_TREND_PROJECT_ID = "prj_oMk2WHi81HNBQBU1AACAKMwFiycP";
const VERCEL_TREND_TEAM_SLUG = "kevinmaras-projects";
const VERCEL_TREND_ISSUERS = new Set([
  "https://oidc.vercel.com",
  `https://oidc.vercel.com/${VERCEL_TREND_TEAM_SLUG}`,
]);
const vercelTrendJwks = new Map<
  string,
  ReturnType<typeof createRemoteJWKSet>
>();
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

async function getUser(
  request: Request,
  env: SitesEnvironment
): Promise<AuthenticatedUser | null> {
  const authorization = request.headers.get("authorization")?.trim();
  if (
    authorization?.startsWith("Bearer ") &&
    env.SUPABASE_URL &&
    env.SUPABASE_PUBLISHABLE_KEY
  ) {
    const response = await fetch(
      `${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`,
      {
        headers: {
          apikey: env.SUPABASE_PUBLISHABLE_KEY,
          Authorization: authorization,
        },
      }
    );
    if (response.ok) {
      const payload = (await response.json()) as {
        email?: string;
        user_metadata?: { full_name?: string; name?: string };
      };
      const verifiedEmail = payload.email?.trim().toLowerCase();
      if (verifiedEmail) {
        return {
          email: verifiedEmail,
          name:
            payload.user_metadata?.full_name?.trim() ||
            payload.user_metadata?.name?.trim() ||
            nameFromEmail(verifiedEmail),
        };
      }
    }
    return null;
  }

  const email = request.headers
    .get("oai-authenticated-user-email")
    ?.trim()
    .toLowerCase();

  if (email) {
    return { email, name: decodeUserName(request) || nameFromEmail(email) };
  }

  const hostname = new URL(request.url).hostname;
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "terminal.local"
  ) {
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
  if (
    !env.OPENROUTER_API_KEY ||
    (useKimiSubscription && !env.KIMI_CODE_API_KEY)
  ) {
    missing.push("AI_SERVICE");
  }
  if (!env.ZERNIO_API_KEY) missing.push("PUBLISHING_SERVICE");
  if (!provenanceReady) missing.push("OUTPUT_MARKING");

  return {
    operations: operatorOwnerEmail(env) === user.email,
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
    imageGeneration: Boolean(
      env.OPENROUTER_API_KEY && env.BUCKET && provenanceReady
    ),
    videoGeneration: Boolean(
      env.OPENROUTER_API_KEY && env.BUCKET && provenanceReady
    ),
    publishing: Boolean(env.ZERNIO_API_KEY),
    missing,
    modelRoutes: [
      { purpose: "Text" },
      { purpose: "Analysis" },
      { purpose: "Transcription" },
      { purpose: "Speech" },
      { purpose: "Image" },
      { purpose: "Video" },
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
      env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS support_tickets (
            id TEXT PRIMARY KEY NOT NULL,
            requester_email TEXT NOT NULL,
            requester_name TEXT,
            authenticated_owner_email TEXT,
            category TEXT NOT NULL,
            priority TEXT NOT NULL DEFAULT 'normal',
            subject TEXT NOT NULL,
            description TEXT NOT NULL,
            conversation_json TEXT NOT NULL DEFAULT '[]',
            ai_summary TEXT,
            status TEXT NOT NULL DEFAULT 'open',
            email_status TEXT NOT NULL DEFAULT 'pending',
            provider_message_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS support_tickets_email_created_idx ON support_tickets (requester_email, created_at)"
      ),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS support_tickets_status_created_idx ON support_tickets (status, created_at)"
      ),
      env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS support_rate_limits (
            key TEXT PRIMARY KEY NOT NULL,
            request_count INTEGER NOT NULL DEFAULT 0,
            window_started_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `),
      env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS trend_snapshots (
            id TEXT PRIMARY KEY NOT NULL,
            scope_key TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            generated_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
          )
        `),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS trend_snapshots_scope_expires_idx ON trend_snapshots (scope_key, expires_at)"
      ),
      env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS trend_research_runs (
            id TEXT PRIMARY KEY NOT NULL,
            owner_email TEXT NOT NULL,
            query_hash TEXT NOT NULL,
            scope_json TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            credit_cost INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
          )
        `),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS trend_research_owner_created_idx ON trend_research_runs (owner_email, created_at)"
      ),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS trend_research_owner_query_idx ON trend_research_runs (owner_email, query_hash, created_at)"
      ),
      env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS trend_refresh_state (
            refresh_key TEXT PRIMARY KEY NOT NULL,
            lease_expires_at TEXT NOT NULL,
            last_started_at TEXT NOT NULL,
            last_completed_at TEXT,
            last_error TEXT
          )
        `),
    ])
      .then(async () => {
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS brand_workspaces (id TEXT PRIMARY KEY NOT NULL, owner_email TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL)`
        ).run();
        await env.DB.prepare(
          "CREATE INDEX IF NOT EXISTS brands_owner_idx ON brand_workspaces(owner_email)"
        ).run();
        for (const table of ["assets", "generation_jobs"]) {
          const fields = await env.DB.prepare(
            `PRAGMA table_info(${table})`
          ).all<{ name: string }>();
          if (!fields.results.some(field => field.name === "brand_id"))
            await env.DB.prepare(
              `ALTER TABLE ${table} ADD COLUMN brand_id TEXT NOT NULL DEFAULT 'default'`
            ).run();
          await env.DB.prepare(
            `CREATE INDEX IF NOT EXISTS ${table}_brand_created_idx ON ${table}(owner_email, brand_id, created_at)`
          ).run();
        }
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
    provider: "REELassati",
    model: "managed-ai",
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

async function signedMediaUrl(
  env: SitesEnvironment,
  id: string
): Promise<string> {
  const key = env.AI_PROVENANCE_SIGNING_KEY || env.OPENROUTER_API_KEY;
  if (!key) return `/api/assets/${encodeURIComponent(id)}`;
  const expires = Math.floor(Date.now() / 1000) + 6 * 3600;
  const token = await videoReferenceToken(key, `media:${id}`, expires);
  return `/api/media/${encodeURIComponent(id)}?expires=${expires}&token=${token}`;
}

async function handleSignedMedia(
  request: Request,
  env: SitesEnvironment,
  url: URL
): Promise<Response> {
  const id = url.pathname.split("/")[3] || "";
  const expires = Number(url.searchParams.get("expires"));
  const key = env.AI_PROVENANCE_SIGNING_KEY || env.OPENROUTER_API_KEY;
  const now = Math.floor(Date.now() / 1000);
  if (
    !["GET", "HEAD"].includes(request.method) ||
    !key ||
    !Number.isInteger(expires) ||
    expires <= now ||
    expires > now + 6 * 3600 ||
    !id
  )
    return errorResponse("Media link expired. Refresh your Library.", 403);
  const expected = await videoReferenceToken(key, `media:${id}`, expires);
  if (!constantTimeEqual(url.searchParams.get("token") || "", expected))
    return errorResponse("Media unavailable", 403);
  const row = await env.DB.prepare(
    "SELECT owner_email, brand_id FROM assets WHERE id = ?"
  )
    .bind(id)
    .first<{ owner_email: string; brand_id: string }>();
  if (!row) return errorResponse("Media not found", 404);
  return handleAssets(
    request,
    env,
    { email: row.owner_email, name: "Creator", brandId: row.brand_id },
    new URL(`/api/assets/${id}`, url.origin)
  );
}

function workspaceOwnerKey(user: AuthenticatedUser): string {
  return user.brandId && user.brandId !== "default"
    ? `${user.email}::brand:${user.brandId}`
    : user.email;
}

async function handleSocialAnalytics(
  request: Request,
  env: SitesEnvironment,
  user: AuthenticatedUser
): Promise<Response> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS social_analytics_snapshots (owner_key TEXT NOT NULL, day TEXT NOT NULL, payload TEXT NOT NULL, synced_at TEXT NOT NULL, PRIMARY KEY(owner_key, day))`
  ).run();
  const key = workspaceOwnerKey(user);
  const latest = await env.DB.prepare(
    "SELECT payload, synced_at FROM social_analytics_snapshots WHERE owner_key = ? ORDER BY day DESC LIMIT 1"
  )
    .bind(key)
    .first<{ payload: string; synced_at: string }>();
  const profile = await env.DB.prepare(
    "SELECT profile_id FROM zernio_profiles WHERE owner_email = ?"
  )
    .bind(key)
    .first<{ profile_id: string }>();
  const response: SocialAnalyticsResponse = {
    configured: Boolean(env.ZERNIO_API_KEY),
    connected: Boolean(profile),
    syncedAt: latest?.synced_at || null,
    partial: false,
    posts: [],
  };
  if (latest) {
    try {
      const cached = JSON.parse(latest.payload);
      response.posts = cached.posts || [];
      response.partial = cached.partial === true;
    } catch {
      response.message = "Previous analytics could not be read. Sync again.";
    }
  }
  if (request.method === "GET") return json(response);
  if (request.method !== "POST")
    return errorResponse("Method not allowed", 405);
  if (!env.ZERNIO_API_KEY || !profile)
    return json(
      {
        ...response,
        message: "Connect a social account before syncing performance.",
      },
      409
    );
  if (latest && Date.now() - Date.parse(latest.synced_at) < 15 * 60_000)
    return json({
      ...response,
      message: "Your analytics were synced recently.",
    });
  const posts = new Map<
    string,
    NonNullable<ReturnType<typeof parseSocialPost>>
  >();
  const fromDate = new Date(Date.now() - 180 * 86400000)
    .toISOString()
    .slice(0, 10);
  for (let page = 1; page <= 10; page++) {
    const query = new URLSearchParams({
      profileId: profile.profile_id,
      fromDate,
      limit: "100",
      page: String(page),
    });
    const payload = await zernioRequest(env, `/analytics?${query}`);
    const nested = recordValue(payload.data);
    const list = Array.isArray(payload.posts)
      ? payload.posts
      : Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(nested?.posts)
          ? nested.posts
          : null;
    if (!list)
      throw errorResponse(
        "Performance data is not ready yet. Your previous results are preserved.",
        502
      );
    for (const value of list) {
      const post = parseSocialPost(value);
      if (post) posts.set(post.id, post);
    }
    if (list.length < 100) break;
    if (page === 10) response.partial = true;
  }
  response.posts = Array.from(posts.values());
  response.syncedAt = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO social_analytics_snapshots (owner_key, day, payload, synced_at) VALUES (?, ?, ?, ?) ON CONFLICT(owner_key, day) DO UPDATE SET payload=excluded.payload, synced_at=excluded.synced_at"
    ).bind(
      key,
      response.syncedAt.slice(0, 10),
      JSON.stringify({
        posts: response.posts,
        partial: response.partial,
        totals: Object.fromEntries(
          SOCIAL_METRICS.map(metric => [
            metric,
            response.posts.reduce(
              (sum, post) => sum + (post.metrics[metric] || 0),
              0
            ),
          ])
        ),
      }),
      response.syncedAt
    ),
    env.DB.prepare(
      "UPDATE social_analytics_snapshots SET payload = json_remove(payload, '$.posts') WHERE owner_key = ? AND day < ?"
    ).bind(key, new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)),
    env.DB.prepare(
      "DELETE FROM social_analytics_snapshots WHERE owner_key = ? AND day < ?"
    ).bind(
      key,
      new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10)
    ),
  ]);
  return json(response);
}

async function handleBrands(
  request: Request,
  env: SitesEnvironment,
  user: AuthenticatedUser
): Promise<Response> {
  const billing = await billingSummary(env, user);
  const limit = billing.canUseCredits ? billing.plan?.workspaces || 1 : 1;
  if (request.method === "GET") {
    const result = await env.DB.prepare(
      "SELECT id, name, created_at AS createdAt FROM brand_workspaces WHERE owner_email = ? ORDER BY created_at"
    )
      .bind(user.email)
      .all();
    const main = await env.DB.prepare(
      "SELECT document FROM workspace_state WHERE owner_email = ?"
    )
      .bind(user.email)
      .first<{ document: string }>();
    let name = "My brand";
    try {
      name = JSON.parse(main?.document || "{}").brandKit?.name || name;
    } catch {
      /* keep display fallback */
    }
    return json({
      brands: [{ id: "default", name }, ...result.results],
      limit,
      activeId: user.brandId || "default",
    });
  }
  if (request.method === "POST") {
    const input = (await request.json()) as { name?: unknown };
    const name = stringValue(input.name).trim().slice(0, 100);
    if (!name) return errorResponse("Give your brand a name");
    const id = crypto.randomUUID();
    const result = await env.DB.prepare(
      `INSERT INTO brand_workspaces (id, owner_email, name, created_at) SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM brand_workspaces WHERE owner_email = ?) < ?`
    )
      .bind(
        id,
        user.email,
        name,
        new Date().toISOString(),
        user.email,
        limit - 1
      )
      .run();
    if (result.meta?.changes !== 1)
      return errorResponse(
        "Your plan's brand workspace allowance is full. Choose a larger plan to add another brand.",
        409
      );
    return json({ id, name }, 201);
  }
  return errorResponse("Method not allowed", 405);
}

async function getWorkspace(
  env: SitesEnvironment,
  user: AuthenticatedUser
): Promise<WorkspaceDocument> {
  await initializeSchema(env);
  const row = await env.DB.prepare(
    "SELECT document, revision FROM workspace_state WHERE owner_email = ?"
  )
    .bind(workspaceOwnerKey(user))
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
    if (user.brandId && user.brandId !== "default") {
      const brand = await env.DB.prepare(
        "SELECT name FROM brand_workspaces WHERE id = ? AND owner_email = ?"
      )
        .bind(user.brandId, user.email)
        .first<{ name: string }>();
      if (brand) {
        workspace.brandKit.name = brand.name;
        workspace.profile.workspaceName = brand.name;
      }
    }
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
      favorite: saved.favorite === true,
      ...(saved.projectId &&
      workspace!.projects.some(project => project.id === saved.projectId)
        ? { projectId: saved.projectId }
        : {}),
    };
  });
  const availableAssetIds = new Set(workspace.assets.map(asset => asset.id));
  workspace.projects = workspace.projects.map(project => ({
    ...project,
    activeAssetId:
      project.activeAssetId && availableAssetIds.has(project.activeAssetId)
        ? project.activeAssetId
        : undefined,
    clips: project.clips.filter(
      clip => !clip.assetId || availableAssetIds.has(clip.assetId)
    ),
  }));
  workspace.posts = workspace.posts.map(post => ({
    ...post,
    mediaAssetId:
      post.mediaAssetId && availableAssetIds.has(post.mediaAssetId)
        ? post.mediaAssetId
        : undefined,
  }));
  workspace.jobs = await listOwnerJobs(env, user);
  workspace.assets = await Promise.all(
    workspace.assets.map(async asset => ({
      ...asset,
      url: await signedMediaUrl(env, asset.id),
    }))
  );
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
    brandKit: {
      ...empty.brandKit,
      ...(candidate.brandKit || {}),
      scenePresets: Array.isArray(candidate.brandKit?.scenePresets)
        ? candidate.brandKit.scenePresets.slice(0, 20).flatMap(p => {
            if (
              !p ||
              typeof p.id !== "string" ||
              typeof p.name !== "string" ||
              !recordValue(p.direction)
            )
              return [];
            return [
              {
                id: p.id.slice(0, 100),
                name: p.name.slice(0, 80),
                direction: Object.fromEntries(
                  Object.entries(p.direction)
                    .filter(
                      ([key, v]) =>
                        [
                          "subject",
                          "action",
                          "location",
                          "camera",
                          "mood",
                          "dialogue",
                          "sound",
                          "avoid",
                        ].includes(key) && typeof v === "string"
                    )
                    .map(([key, v]) => [key, String(v).slice(0, 4000)])
                ),
              },
            ];
          })
        : [],
    },
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
    calendarEvents: normalizeCalendarEvents(candidate.calendarEvents),
    goals: Array.isArray(candidate.goals) ? candidate.goals : [],
    jobs: Array.isArray(candidate.jobs) ? candidate.jobs : [],
    activity: Array.isArray(candidate.activity) ? candidate.activity : [],
    updatedAt:
      typeof candidate.updatedAt === "string"
        ? candidate.updatedAt
        : new Date().toISOString(),
  };
}

const CALENDAR_EVENT_KINDS = new Set<CalendarEventKind>([
  "task",
  "shoot",
  "meeting",
  "deadline",
  "other",
]);

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CALENDAR_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function normalizeCalendarEvents(value: unknown): CalendarEvent[] {
  if (!Array.isArray(value)) return [];
  const now = new Date().toISOString();
  const normalized: CalendarEvent[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    const candidate = recordValue(item);
    if (!candidate) continue;
    const id = stringValue(candidate.id).slice(0, 140);
    const title = stringValue(candidate.title).trim().slice(0, 160);
    const date = stringValue(candidate.date).slice(0, 10);
    const parsedDate = new Date(`${date}T12:00:00.000Z`);
    if (
      !/^[A-Za-z0-9_-]{8,140}$/.test(id) ||
      seen.has(id) ||
      !title ||
      !CALENDAR_DATE_PATTERN.test(date) ||
      !Number.isFinite(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== date
    ) {
      continue;
    }

    const kindValue = stringValue(candidate.kind).toLowerCase();
    const kind = CALENDAR_EVENT_KINDS.has(kindValue as CalendarEventKind)
      ? (kindValue as CalendarEventKind)
      : "other";
    const startCandidate = stringValue(candidate.startTime);
    const endCandidate = stringValue(candidate.endTime);
    const startTime = CALENDAR_TIME_PATTERN.test(startCandidate)
      ? startCandidate
      : undefined;
    const endTime =
      startTime &&
      CALENDAR_TIME_PATTERN.test(endCandidate) &&
      endCandidate > startTime
        ? endCandidate
        : undefined;
    const createdCandidate = stringValue(candidate.createdAt);
    const updatedCandidate = stringValue(candidate.updatedAt);

    seen.add(id);
    normalized.push({
      id,
      title,
      notes: stringValue(candidate.notes).trim().slice(0, 2_000),
      date,
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
      kind,
      createdAt: Number.isFinite(Date.parse(createdCandidate))
        ? new Date(createdCandidate).toISOString()
        : now,
      updatedAt: Number.isFinite(Date.parse(updatedCandidate))
        ? new Date(updatedCandidate).toISOString()
        : now,
    });
    if (normalized.length >= 500) break;
  }

  return normalized;
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
  // Balances are server-owned in credit_accounts; clients cannot mint credits
  // by changing the workspace document.
  workspace.profile.credits = 0;
  const current = await env.DB.prepare(
    "SELECT revision FROM workspace_state WHERE owner_email = ?"
  )
    .bind(workspaceOwnerKey(user))
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
            workspaceOwnerKey(user),
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
          .bind(workspaceOwnerKey(user), serialized, workspace.updatedAt)
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

function generatedAssetName(
  requested: unknown,
  fallbackBase: string,
  extension: string
): string {
  const clean = Array.from(stringValue(requested, fallbackBase), character => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  })
    .join("")
    .replace(/[\\/]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 110);
  const base = clean || fallbackBase;
  return base.toLowerCase().endsWith(`.${extension.toLowerCase()}`)
    ? base
    : `${base}.${extension}`;
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
      (id, owner_email, name, kind, content_type, bytes, r2_key, created_at, brand_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      createdAt,
      user.brandId || "default"
    )
    .run();

  return {
    id,
    name: input.name,
    kind: input.kind,
    contentType: input.contentType,
    size: input.size,
    url: await signedMediaUrl(env, id),
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
      (id, owner_email, name, kind, content_type, bytes, r2_key, created_at, brand_id)
    VALUES (?, ?, ?, 'video', ?, ?, ?, ?, ?)
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
      new Date().toISOString(),
      user.brandId || "default"
    )
    .run();
  const row = await getAssetRow(env, user, input.id);
  if (!row || row.r2_key !== input.r2Key) {
    throw new Error("The generated asset id is already bound elsewhere");
  }
  return { ...rowToAsset(row), url: await signedMediaUrl(env, row.id) };
}

async function getAssetRow(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  id: string
): Promise<AssetRow | null> {
  await initializeSchema(env);
  return env.DB.prepare(
    `SELECT id, owner_email, name, kind, content_type, bytes, r2_key, created_at
     FROM assets WHERE id = ? AND owner_email = ? AND brand_id = ?`
  )
    .bind(id, user.email, user.brandId || "default")
    .first<AssetRow>();
}

async function listOwnerAssets(
  env: SitesEnvironment,
  user: AuthenticatedUser
): Promise<Asset[]> {
  await initializeSchema(env);
  const result = await env.DB.prepare(
    `SELECT id, owner_email, name, kind, content_type, bytes, r2_key, created_at
     FROM assets WHERE owner_email = ? AND brand_id = ? ORDER BY created_at DESC`
  )
    .bind(user.email, user.brandId || "default")
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
     FROM generation_jobs WHERE owner_email = ? AND brand_id = ? ORDER BY created_at DESC`
  )
    .bind(user.email, user.brandId || "default")
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
      error:
        "REELassati could not complete this request. Retry once; if it continues, contact support.",
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
  model?: string,
  requireJsonMode = true
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
        error: "REELassati AI is temporarily unavailable",
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
              content: `${system}\n\nREELassati policy ${AI_COMPLIANCE_POLICY_VERSION}: work only on REELassati product support or creative and marketing production. Do not perform biometric identification or categorisation, emotion inference, social scoring, or decisions/recommendations determining access to employment, education, credit, insurance, medical care, legal services, law enforcement, migration or public benefits. Do not generate child sexual abuse material, sexual exploitation, or non-consensual intimate content. Do not target or manipulate voters or democratic participation. Do not fabricate a real person's endorsement, consent, credentials, evidence or results. Never use manipulative or exploitative techniques likely to cause significant harm.`,
            },
            {
              role: "user",
              content:
                typeof userContent === "string"
                  ? userContent
                  : JSON.stringify(userContent),
            },
          ],
          ...(requireJsonMode
            ? { response_format: { type: "json_object" } }
            : {}),
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

async function videoReferenceToken(
  secret: string,
  assetId: string,
  expiresAt: number
): Promise<string> {
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
    new TextEncoder().encode(
      `reelassati-video-reference-v1:${assetId}:${expiresAt}`
    )
  );
  return Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function signedVideoReferenceUrl(
  env: SitesEnvironment,
  origin: string,
  assetId: string
): Promise<string> {
  const secret = env.OPENROUTER_API_KEY;
  if (!secret) throw new Error("Video reference signing is unavailable");
  const expiresAt = Math.floor(Date.now() / 1000) + 20 * 60;
  const token = await videoReferenceToken(secret, assetId, expiresAt);
  return `${origin}/api/video/reference/${encodeURIComponent(
    assetId
  )}?expires=${expiresAt}&token=${token}`;
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

async function verifyReferralBillingWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  return verifyOpenRouterWebhook(rawBody, signatureHeader, secret);
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
        error: "Publishing is temporarily unavailable",
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
    .bind(workspaceOwnerKey(user))
    .first<{ profile_id: string }>();
  if (existing?.profile_id) return existing.profile_id;

  let payload: Record<string, unknown>;
  try {
    payload = await zernioRequest(env, "/profiles", {
      method: "POST",
      headers: { "Idempotency-Key": `reelassati-${workspaceOwnerKey(user)}` },
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
  if (!id) throw new Error("The publishing service could not create a profile");
  await env.DB.prepare(
    `
    INSERT INTO zernio_profiles (owner_email, profile_id, created_at)
    VALUES (?, ?, ?)
    ON CONFLICT(owner_email) DO UPDATE SET profile_id = excluded.profile_id
  `
  )
    .bind(workspaceOwnerKey(user), id, new Date().toISOString())
    .run();
  return id;
}

async function listZernioAccounts(
  env: SitesEnvironment,
  user: AuthenticatedUser
): Promise<PublishingAccount[]> {
  const stored = await env.DB.prepare(
    "SELECT profile_id FROM zernio_profiles WHERE owner_email = ?"
  )
    .bind(workspaceOwnerKey(user))
    .first<{ profile_id: string }>();
  if (!stored) return [];
  const profileId = stored.profile_id;
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
  "Video generation could not start",
  "Video generation could not be confirmed",
  "The generated output could not be marked and verified",
]);

function safeVideoJobError(value: string | null): string | undefined {
  const error = stringValue(value);
  if (!error) return undefined;
  if (SAFE_VIDEO_JOB_ERRORS.has(error)) return error;
  if (/^Video generation failed\. Reference: [0-9a-f-]{36}\.$/i.test(error)) {
    return error;
  }
  // Older rows may contain a provider-supplied message. Never return that
  // historical text to a client; new failures receive a correlation reference.
  return "The video job could not be completed. Retry once; if it continues, contact support.";
}

export function jobFromRow(row: JobRow): GenerationJob {
  let payload: Record<string, unknown> = {};
  try {
    payload = recordValue(JSON.parse(row.payload)) || {};
  } catch {
    payload = {};
  }
  const parentJobId = stringValue(payload.parentJobId);
  const sourceAssetId = stringValue(payload.sourceAssetId);
  const rootJobId = stringValue(payload.rootJobId, row.id);
  return {
    id: row.id,
    type: "video",
    status: row.status,
    projectId: row.project_id || undefined,
    prompt: row.prompt || undefined,
    progress: row.progress,
    resultAssetId: row.result_asset_id || undefined,
    error: safeVideoJobError(row.error),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    continuity: {
      mode: parentJobId ? "continue" : "new",
      rootJobId,
      ...(parentJobId ? { parentJobId } : {}),
      ...(sourceAssetId ? { sourceAssetId } : {}),
    },
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

    const renderProjectId = stringValue(form.get("render_project_id"));
    let renderSources: ContentProvenance[] = [];
    if (renderProjectId) {
      if (contentType !== "video/mp4" || file.size > MAX_AI_MEDIA_BYTES)
        return errorResponse(
          "Rendered Library videos must be MP4 files under 24 MB. Your download is still available.",
          413
        );
      const renderWorkspace = await getWorkspace(env, user);
      const sourceProject = renderWorkspace.projects.find(
        project => project.id === renderProjectId
      );
      if (!sourceProject) return errorResponse("Source project not found", 404);
      renderSources = renderWorkspace.assets
        .filter(asset =>
          sourceProject.clips.some(clip => clip.assetId === asset.id)
        )
        .flatMap(asset => (asset.provenance ? [asset.provenance] : []));
      if (sourceProject.transcriptProvenance)
        renderSources.push(sourceProject.transcriptProvenance);
    }
    const assetId = crypto.randomUUID();
    const safeName = sanitizeFilename(file.name);
    const r2Key = `users/${encodeURIComponent(user.email)}/${renderSources.length ? "generated" : "assets"}/${assetId}/${safeName}`;
    await env.BUCKET.put(r2Key, file.stream(), {
      httpMetadata: { contentType },
      customMetadata: { owner: user.email, originalName: file.name },
    });
    let asset: Asset;
    let renderedProvenance: ContentProvenance | undefined;
    let pendingRenderProvenance: ContentProvenance | undefined;
    let storedSize = file.size;
    try {
      if (
        renderSources.some(source =>
          ["ai-generated", "ai-manipulated", "ai-assisted"].includes(
            source.origin
          )
        )
      ) {
        const bytes = await file.arrayBuffer();
        const pending = await createProvenanceRecord(env, user, {
          entityType: "asset",
          entityId: assetId,
          origin: "ai-manipulated",
          operation: "timeline-render",
          provider: "REELassati",
          model: "timeline-compositor",
          content: bytes,
          embeddedMediaMarker: true,
          metadata: {
            projectId: renderProjectId,
            parentRecordIds: renderSources.map(source => source.recordId),
            rendering: "client-composited",
          },
        });
        pendingRenderProvenance = pending;
        const marked = embedMediaProvenanceMarker(
          bytes,
          contentType,
          pending.marking.publicToken || ""
        );
        if (!marked)
          throw new Error(
            "Rendered video could not preserve its source marking"
          );
        await env.BUCKET.put(r2Key, marked.bytes, {
          httpMetadata: { contentType },
          customMetadata: {
            owner: user.email,
            originalName: file.name,
            provenanceToken: pending.marking.publicToken || "",
            policyVersion: AI_COMPLIANCE_POLICY_VERSION,
            embeddedMarking: marked.method,
          },
        });
        renderedProvenance = await finalizeEmbeddedProvenance(
          env,
          user,
          pending,
          marked.bytes
        );
        storedSize = marked.bytes.byteLength;
      }
      asset = await insertAssetRecord(env, user, {
        id: assetId,
        name: file.name,
        kind: inferAssetKind(contentType, stringValue(form.get("kind"))),
        contentType,
        size: storedSize,
        r2Key,
      });
    } catch (cause) {
      await env.BUCKET.delete(r2Key).catch(() => undefined);
      if (pendingRenderProvenance)
        await failProvenanceRecord(
          env,
          user,
          pendingRenderProvenance.recordId,
          "asset",
          assetId,
          "Timeline export could not be finalized"
        ).catch(() => undefined);
      throw cause;
    }
    return json(
      {
        asset: renderedProvenance
          ? { ...asset, provenance: renderedProvenance }
          : asset,
      },
      201
    );
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

  if (request.method === "PATCH") {
    const input = await parseJsonBody<{ name?: string }>(request);
    const name = generatedAssetName(
      input.name,
      row.name.replace(/\.[^.]+$/, "") || "asset",
      row.name.includes(".") ? row.name.split(".").pop() || "bin" : "bin"
    );
    await env.DB.prepare(
      "UPDATE assets SET name = ? WHERE id = ? AND owner_email = ?"
    )
      .bind(name, id, user.email)
      .run();
    return json({
      asset: {
        ...rowToAsset({ ...row, name }),
        url: await signedMediaUrl(env, row.id),
      },
    });
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

async function requireCreditReservation(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  input: {
    cost: number;
    operationKey: string;
    category: string;
    description: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<CreditReservation> {
  const reservation = await reserveCredits(env, user, input);
  if (reservation) return reservation;
  const summary = await billingSummary(env, user);
  if (!summary.configured && !summary.canUseCredits) {
    throw json(
      {
        error:
          "Billing activation is in progress. No credits were used and no payment was attempted.",
        availableCredits: summary.availableCredits,
      },
      503
    );
  }
  if (!summary.canUseCredits) {
    throw json(
      {
        error: "Choose an active plan to use REELassati AI tools.",
        availableCredits: summary.availableCredits,
      },
      402
    );
  }
  throw json(
    {
      error: `You need ${input.cost} credits for this action.`,
      availableCredits: summary.availableCredits,
    },
    402
  );
}

async function runPaidAiAction(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  input: {
    cost: number;
    operationKey: string;
    category: string;
    description: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
  },
  action: (reservation: CreditReservation) => Promise<Response>
): Promise<Response> {
  const reservation = await requireCreditReservation(env, user, input);
  try {
    const response = await action(reservation);
    if (response.ok) {
      await settleCreditReservation(env, reservation);
    } else {
      await releaseCreditReservation(env, reservation);
    }
    return response;
  } catch (cause) {
    await releaseCreditReservation(env, reservation).catch(() => undefined);
    throw cause;
  }
}

async function assetDurationSeconds(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  assetId: string
): Promise<number | undefined> {
  const workspace = await getWorkspace(env, user);
  const duration = workspace.assets.find(
    asset => asset.id === assetId
  )?.duration;
  return typeof duration === "number" && Number.isFinite(duration)
    ? Math.max(0, duration)
    : undefined;
}

function reservationFromJobPayload(
  payload: Record<string, unknown>
): CreditReservation | null {
  const row = recordValue(payload.creditReservation);
  const id = stringValue(row?.id);
  const operationKey = stringValue(row?.operationKey);
  const cost = Math.floor(Number(row?.cost));
  return id && operationKey && Number.isFinite(cost) && cost > 0
    ? { id, operationKey, cost }
    : null;
}

async function handleAi(
  request: Request,
  env: SitesEnvironment,
  user: AuthenticatedUser,
  url: URL
): Promise<Response> {
  if (request.method !== "POST")
    return errorResponse("Method not allowed", 405);

  if (url.pathname === "/api/ai/image") {
    if (!env.OPENROUTER_API_KEY) {
      return errorResponse("Image generation is temporarily unavailable", 503);
    }
    const input = await parseJsonBody<{
      prompt?: string;
      assetName?: string;
      aspectRatio?: string;
      resolution?: string;
      rightsConfirmed?: boolean;
      referenceContainsRealPerson?: boolean;
      realPersonConsentConfirmed?: boolean;
    }>(request);
    const prompt = stringValue(input.prompt);
    if (!prompt) return errorResponse("Describe the image to generate");
    if (prompt.length > 4_000) {
      return errorResponse("Image prompts are limited to 4,000 characters");
    }
    assertProvenanceConfigured(env);
    if (input.rightsConfirmed !== true) {
      return errorResponse(
        "Confirm that you may use the prompt, brands and likenesses before generating an image",
        422
      );
    }
    if (
      input.referenceContainsRealPerson === true &&
      input.realPersonConsentConfirmed !== true
    ) {
      return errorResponse(
        "A prompt depicting an identifiable real person requires documented consent or another verified legal basis",
        422
      );
    }
    await assertAllowedCreativeUse(env, user, prompt);

    const aspectRatio = ["1:1", "4:3", "3:4", "16:9", "9:16"].includes(
      stringValue(input.aspectRatio)
    )
      ? stringValue(input.aspectRatio)
      : "1:1";
    const resolution = input.resolution === "2K" ? "2K" : "1K";
    const model = env.OPENROUTER_IMAGE_MODEL || "qwen/qwen-image-3-pro";
    const assetId = crypto.randomUUID();
    const assetName = generatedAssetName(
      input.assetName,
      `Generated image ${new Date().toLocaleDateString("en-GB")}`,
      "png"
    );
    const r2Key = `users/${encodeURIComponent(user.email)}/generated/${assetId}.png`;
    return runPaidAiAction(
      env,
      user,
      {
        cost: imageCreditCost(resolution),
        operationKey: `image:${assetId}`,
        category: "image",
        description: `${resolution} image generation`,
        referenceId: assetId,
        metadata: { resolution, aspectRatio },
      },
      async () => {
        const invocation = await beginAiInvocation(
          env,
          user,
          "image-generation",
          "OpenRouter",
          model,
          { prompt, aspectRatio, resolution, rightsConfirmed: true }
        );
        let provenance: ContentProvenance | null = null;
        try {
          const response = await fetch(`${OPENROUTER_BASE}/images`, {
            method: "POST",
            headers: openRouterHeaders(env),
            body: JSON.stringify({
              model,
              prompt,
              n: 1,
              aspect_ratio: aspectRatio,
              resolution,
              quality: "high",
              output_format: "png",
            }),
          });
          if (!response.ok) await providerError(response, "OpenRouter");
          const payload = (await response.json()) as {
            data?: Array<{ b64_json?: string; media_type?: string }>;
          };
          const encoded = stringValue(payload.data?.[0]?.b64_json).replace(
            /^data:image\/png;base64,/i,
            ""
          );
          if (!encoded || encoded.length > 28_000_000) {
            throw new Error("Image generation returned an invalid image");
          }
          const binary = atob(encoded);
          const imageBytes = new Uint8Array(binary.length);
          for (let index = 0; index < binary.length; index += 1) {
            imageBytes[index] = binary.charCodeAt(index);
          }
          if (
            imageBytes.byteLength < 8 ||
            ![137, 80, 78, 71, 13, 10, 26, 10].every(
              (byte, index) => imageBytes[index] === byte
            )
          ) {
            throw new Error("Image generation did not return a valid PNG");
          }
          provenance = await createProvenanceRecord(env, user, {
            entityType: "asset",
            entityId: assetId,
            origin: "ai-generated",
            operation: "image-generation",
            provider: invocation.provider,
            model: invocation.model,
            content: imageBytes,
            embeddedMediaMarker: true,
            metadata: {
              invocationId: invocation.id,
              aspectRatio,
              resolution,
              rightsAttested: true,
              referenceContainsRealPerson:
                input.referenceContainsRealPerson === true,
              realPersonConsentAttested:
                input.realPersonConsentConfirmed === true,
            },
          });
          const markedImage = embedMediaProvenanceMarker(
            imageBytes.buffer,
            "image/png",
            provenance.marking.publicToken || ""
          );
          if (!markedImage) throw new Error("Image output marking failed");
          await env.BUCKET.put(r2Key, markedImage.bytes, {
            httpMetadata: { contentType: "image/png" },
            customMetadata: {
              owner: user.email,
              source: "reelassati-image",
              provenanceToken: provenance.marking.publicToken || "",
              policyVersion: AI_COMPLIANCE_POLICY_VERSION,
              embeddedMarking: markedImage.method,
            },
          });
          const stored = await env.BUCKET.get(r2Key);
          if (!stored) throw new Error("Generated image storage is missing");
          const verifiedProvenance = await finalizeEmbeddedProvenance(
            env,
            user,
            provenance,
            await stored.arrayBuffer()
          );
          const asset = await insertAssetRecord(env, user, {
            id: assetId,
            name: assetName,
            kind: "image",
            contentType: "image/png",
            size: markedImage.bytes.byteLength,
            r2Key,
          });
          await completeAiInvocation(
            env,
            invocation,
            await sha256Hex(imageBytes)
          );
          return json(
            { asset: { ...asset, provenance: verifiedProvenance } },
            201
          );
        } catch (cause) {
          await env.BUCKET.delete(r2Key).catch(() => undefined);
          await env.DB.prepare(
            "DELETE FROM assets WHERE id = ? AND owner_email = ?"
          )
            .bind(assetId, user.email)
            .run()
            .catch(() => undefined);
          if (provenance) {
            await failProvenanceRecord(
              env,
              user,
              provenance.recordId,
              "asset",
              assetId,
              "image-output-rollback"
            ).catch(() => undefined);
          }
          await failAiInvocation(env, invocation, "image_generation_failure");
          throw cause;
        }
      }
    );
  }

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
    return runPaidAiAction(
      env,
      user,
      {
        cost: AI_CREDIT_COSTS.script,
        operationKey: `script:${crypto.randomUUID()}`,
        category: "script",
        description: "Script generation",
        metadata: { platform, duration },
      },
      async () => {
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
    );
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
    const project = input.project;
    const projectId = stringValue(project.id);
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
    return runPaidAiAction(
      env,
      user,
      {
        cost: AI_CREDIT_COSTS.editPlan,
        operationKey: `edit-plan:${crypto.randomUUID()}`,
        category: "edit-plan",
        description: "AI edit plan",
        referenceId: projectId,
        metadata: { projectId, duration },
      },
      async () => {
        const { output, invocation } = await chatJson(
          env,
          user,
          "edit-planning",
          `You are the accountable AI edit planner inside a professional short-form timeline. Return JSON only: {"summary":"...", "changes":[...]}. Each change must contain type, label, reason, start, end, confidence (0..1), and intensity (light|balanced|aggressive). Allowed types: trim, split, move, delete, caption, silence, pacing, broll, audio, style. Plan only—never claim changes are already applied. Respect locked clips and stay inside 0..${duration}s. Prefer fewer high-impact operations. Explain the audience-retention reason concretely.`,
          JSON.stringify({ command: input.command, project: projectContext })
        );
        const summary = stringValue(
          output.summary,
          "Edit plan ready for review"
        );
        const changes = mapEditOperations(
          output.changes,
          duration,
          project.clips,
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
    );
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
    let analysisDuration: number | undefined;
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
      analysisDuration = await assetDurationSeconds(env, user, row.id);
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

    return runPaidAiAction(
      env,
      user,
      {
        cost: timedCreditCost(
          analysisDuration,
          AI_CREDIT_COSTS.videoAnalysisPerMinute
        ),
        operationKey: `video-analysis:${crypto.randomUUID()}`,
        category: "analysis",
        description: "Video analysis",
        referenceId: stringValue(input.assetId) || undefined,
        metadata: { durationSeconds: analysisDuration || null },
      },
      async () => {
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
    );
  }

  if (url.pathname === "/api/ai/transcribe") {
    if (!env.OPENROUTER_API_KEY) {
      return errorResponse("Transcription is temporarily unavailable", 503);
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
    const transcriptionDuration = await assetDurationSeconds(
      env,
      user,
      assetId
    );
    return runPaidAiAction(
      env,
      user,
      {
        cost: timedCreditCost(
          transcriptionDuration,
          AI_CREDIT_COSTS.transcriptionPerMinute
        ),
        operationKey: `transcription:${crypto.randomUUID()}`,
        category: "transcription",
        description: "Media transcription",
        referenceId: assetId,
        metadata: { durationSeconds: transcriptionDuration || null },
      },
      async () => {
        const model =
          env.OPENROUTER_STT_MODEL || "openai/whisper-large-v3-turbo";
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
          const response = await fetch(
            `${OPENROUTER_BASE}/audio/transcriptions`,
            {
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
            }
          );
          if (!response.ok) {
            await failAiInvocation(
              env,
              invocation,
              `provider_${response.status}`
            );
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
    );
  }

  if (url.pathname === "/api/ai/speech") {
    if (!env.OPENROUTER_API_KEY) {
      return errorResponse("Voice generation is temporarily unavailable", 503);
    }
    const input = await parseJsonBody<{
      text?: string;
      voice?: string;
      assetName?: string;
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
    return runPaidAiAction(
      env,
      user,
      {
        cost: speechCreditCost(text.length),
        operationKey: `speech:${crypto.randomUUID()}`,
        category: "speech",
        description: "Voice generation",
        metadata: { characters: text.length },
      },
      async () => {
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
            await failAiInvocation(
              env,
              invocation,
              `provider_${response.status}`
            );
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
            name: generatedAssetName(
              input.assetName,
              `Voice take ${new Date().toLocaleDateString("en-GB")}`,
              "mp3"
            ),
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
    );
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
    return errorResponse("Video generation is temporarily unavailable", 503);
  }
  await initializeSchema(env);
  const id = url.pathname.split("/").filter(Boolean)[3];
  if (id) {
    const scoped = await env.DB.prepare(
      "SELECT brand_id FROM generation_jobs WHERE id = ? AND owner_email = ?"
    )
      .bind(id, user.email)
      .first<{ brand_id: string }>();
    if (scoped && scoped.brand_id !== (user.brandId || "default"))
      return errorResponse("Video not found in this brand", 404);
  }

  if (request.method === "POST" && !id) {
    const input = await parseJsonBody<{
      requestId?: string;
      assetName?: string;
      prompt?: string;
      duration?: number;
      aspectRatio?: string;
      resolution?: string;
      generateAudio?: boolean;
      firstFrameUrl?: string;
      lastFrameUrl?: string;
      continuitySourceJobId?: string;
      projectId?: string;
      rightsConfirmed?: boolean;
      referenceContainsRealPerson?: boolean;
      realPersonConsentConfirmed?: boolean;
    }>(request);
    const requestId = stringValue(input.requestId);
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) {
      return errorResponse("A stable video request id is required");
    }
    const requestedPrompt = stringValue(input.prompt);
    if (!requestedPrompt) return errorResponse("Describe the clip to generate");
    const assetName = generatedAssetName(
      input.assetName,
      `Generated clip ${new Date().toLocaleDateString("en-GB")}`,
      "mp4"
    );
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
    await assertAllowedCreativeUse(env, user, requestedPrompt, requestId);
    let duration = boundedNumber(input.duration, 5, 3, 15);
    const aspectRatio = ["9:16", "16:9", "1:1"].includes(
      stringValue(input.aspectRatio)
    )
      ? stringValue(input.aspectRatio)
      : "9:16";
    const resolution = input.resolution === "1080p" ? "1080p" : "720p";
    const continuitySourceJobId = stringValue(input.continuitySourceJobId);
    let parentJob: JobRow | null = null;
    let parentPayload: Record<string, unknown> = {};
    let sourceAssetId = "";
    let continuityReferenceUrl = "";
    if (continuitySourceJobId) {
      parentJob = await env.DB.prepare(
        "SELECT * FROM generation_jobs WHERE id = ? AND owner_email = ?"
      )
        .bind(continuitySourceJobId, user.email)
        .first<JobRow>();
      if (
        !parentJob ||
        (parentJob.brand_id || "default") !== (user.brandId || "default") ||
        parentJob.status !== "completed" ||
        !parentJob.result_asset_id
      ) {
        return errorResponse(
          "Choose a completed video from your workspace to continue",
          422
        );
      }
      try {
        parentPayload = recordValue(JSON.parse(parentJob.payload)) || {};
      } catch {
        parentPayload = {};
      }
      sourceAssetId = parentJob.result_asset_id;
      const sourceAsset = await getAssetRow(env, user, sourceAssetId);
      if (!sourceAsset || !sourceAsset.content_type.startsWith("video/")) {
        return errorResponse(
          "The selected clip is no longer available for continuation",
          422
        );
      }
      continuityReferenceUrl = await signedVideoReferenceUrl(
        env,
        url.origin,
        sourceAssetId
      );
      duration = Math.max(4, duration);
    }

    const rootJobId = parentJob
      ? stringValue(parentPayload.rootJobId, parentJob.id)
      : requestId;
    const parentSeed = Number(parentPayload.continuitySeed);
    const continuitySeed =
      parentJob && Number.isInteger(parentSeed) && parentSeed > 0
        ? parentSeed
        : crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff || 1;
    const rootScenePrompt = parentJob
      ? stringValue(
          parentPayload.rootScenePrompt,
          parentJob.prompt || requestedPrompt
        )
      : requestedPrompt;
    const previousDirection = parentJob
      ? stringValue(parentPayload.requestedPrompt, parentJob.prompt || "")
      : "";
    const prompt = parentJob
      ? [
          "Continue directly from the selected previous clip.",
          "Preserve the same subject identity, facial features, body proportions, wardrobe, props, environment, scene geography, color palette, lighting, lens treatment, camera language and audio character.",
          "Begin from the previous clip's final scene state; do not reset or redesign it.",
          `Original scene direction: ${rootScenePrompt}`,
          previousDirection
            ? `Previous clip direction: ${previousDirection}`
            : "Use the previous clip itself as the continuity reference.",
          `Next clip direction: ${requestedPrompt}`,
        ].join(" ")
      : requestedPrompt;

    const frameImages: Array<{
      type: "image_url";
      frame_type: "first_frame" | "last_frame";
      image_url: { url: string };
    }> = [];
    const inheritedFirstFrameUrl = stringValue(parentPayload.lastFrameUrl);
    const firstFrameUrl = stringValue(
      input.firstFrameUrl,
      parentJob && isPublicHttpsUrl(inheritedFirstFrameUrl)
        ? inheritedFirstFrameUrl
        : ""
    );
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
    const inputReferences = continuityReferenceUrl
      ? [
          {
            type: "video_url",
            video_url: { url: continuityReferenceUrl },
          },
        ]
      : [];

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

    const videoCost = videoCreditCost({
      duration,
      resolution,
      generateAudio: input.generateAudio !== false,
      continuation: Boolean(parentJob),
    });
    const creditReservation = await requireCreditReservation(env, user, {
      cost: videoCost,
      operationKey: `video:${requestId}`,
      category: "video",
      description: parentJob
        ? "Continued video generation"
        : "Video generation",
      referenceId: requestId,
      metadata: {
        duration,
        resolution,
        generateAudio: input.generateAudio !== false,
        continuation: Boolean(parentJob),
      },
    });

    const now = new Date().toISOString();
    const registration = await env.DB.prepare(
      `
      INSERT INTO generation_jobs
        (id, owner_email, provider_job_id, project_id, prompt, status, progress,
         result_asset_id, error, payload, finalizing_at, created_at, updated_at, brand_id)
      VALUES (?, ?, NULL, ?, ?, 'pending', 2, NULL, NULL, ?, NULL, ?, ?, ?)
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
          continuitySeed,
          rootJobId,
          parentJobId: parentJob?.id || undefined,
          sourceAssetId: sourceAssetId || undefined,
          rootScenePrompt,
          requestedPrompt,
          assetName,
          creditReservation,
        }),
        now,
        now,
        user.brandId || "default"
      )
      .run();
    const registered = await env.DB.prepare(
      "SELECT * FROM generation_jobs WHERE id = ? AND owner_email = ?"
    )
      .bind(requestId, user.email)
      .first<JobRow>();
    if (!registered) {
      await releaseCreditReservation(env, creditReservation).catch(
        () => undefined
      );
      return errorResponse("The video request could not be registered", 500);
    }
    if ((registration.meta?.changes || 0) !== 1 || registered.provider_job_id) {
      return json({ job: jobFromRow(registered) }, 202);
    }

    let providerAccepted = false;
    try {
      const selectedVideoModel = parentJob
        ? env.OPENROUTER_CONTINUITY_VIDEO_MODEL || "bytedance/seedance-2.0"
        : env.OPENROUTER_VIDEO_MODEL || "kwaivgi/kling-v3.0-std";
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
          continuityMode: parentJob ? "continue" : "new",
          rootJobId,
          parentJobId: parentJob?.id || null,
          sourceAssetId: sourceAssetId || null,
          rootScenePrompt,
          requestedPrompt,
          assetName,
          rightsConfirmed: true,
          referenceContainsRealPerson:
            input.referenceContainsRealPerson === true,
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
          seed: continuitySeed,
          callback_url: `${url.origin}/api/video/webhook?token=${encodeURIComponent(
            await videoWebhookToken(env.OPENROUTER_API_KEY)
          )}&requestId=${encodeURIComponent(requestId)}`,
          ...(frameImages.length ? { frame_images: frameImages } : {}),
          ...(inputReferences.length
            ? { input_references: inputReferences }
            : {}),
        }),
      });
      if (!response.ok) {
        await failAiInvocation(env, invocation, `provider_${response.status}`);
        await env.DB.prepare(
          `
        UPDATE generation_jobs
        SET status = 'failed', progress = 100,
            error = 'Video generation could not start',
            updated_at = ?
        WHERE id = ? AND owner_email = ? AND provider_job_id IS NULL
      `
        )
          .bind(new Date().toISOString(), requestId, user.email)
          .run();
        await releaseCreditReservation(env, creditReservation);
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
            error = 'Video generation could not be confirmed', updated_at = ?
        WHERE id = ? AND owner_email = ?
      `
        )
          .bind(new Date().toISOString(), requestId, user.email)
          .run();
        await releaseCreditReservation(env, creditReservation);
        return errorResponse("Video generation could not be confirmed", 502);
      }
      providerAccepted = true;
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
            continuitySeed,
            rootJobId,
            parentJobId: parentJob?.id || undefined,
            sourceAssetId: sourceAssetId || undefined,
            rootScenePrompt,
            requestedPrompt,
            assetName,
            firstFrameUrl: firstFrameUrl || undefined,
            lastFrameUrl: lastFrameUrl || undefined,
            rightsConfirmed: true,
            referenceContainsRealPerson:
              input.referenceContainsRealPerson === true,
            realPersonConsentConfirmed:
              input.realPersonConsentConfirmed === true,
            creditReservation,
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
    } catch (cause) {
      if (!providerAccepted) {
        await releaseCreditReservation(env, creditReservation).catch(
          () => undefined
        );
        await env.DB.prepare(
          `UPDATE generation_jobs
           SET status = 'failed', progress = 100,
               error = 'Video generation could not start', updated_at = ?
           WHERE id = ? AND owner_email = ? AND provider_job_id IS NULL`
        )
          .bind(new Date().toISOString(), requestId, user.email)
          .run()
          .catch(() => undefined);
      }
      throw cause;
    }
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
    let stalePayload: Record<string, unknown> = {};
    try {
      stalePayload = recordValue(JSON.parse(row.payload)) || {};
    } catch {
      stalePayload = {};
    }
    const staleReservation = reservationFromJobPayload(stalePayload);
    if (staleReservation) {
      await releaseCreditReservation(env, staleReservation).catch(
        () => undefined
      );
    }
    await env.DB.prepare(
      `
      UPDATE generation_jobs
      SET status = 'failed', progress = 100,
          error = 'Video generation could not be confirmed',
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
              continuityRootJobId: stringValue(jobPayload.rootJobId) || row.id,
              parentJobId: stringValue(jobPayload.parentJobId) || null,
              sourceAssetId: stringValue(jobPayload.sourceAssetId) || null,
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
              name: generatedAssetName(
                jobPayload.assetName,
                `Generated clip ${new Date().toLocaleDateString("en-GB")}`,
                "mp4"
              ),
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
          const completedReservation = reservationFromJobPayload(jobPayload);
          if (completedReservation) {
            await settleCreditReservation(env, completedReservation);
          }
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
          const failedReservation = reservationFromJobPayload(jobPayload);
          if (failedReservation) {
            await releaseCreditReservation(env, failedReservation).catch(
              () => undefined
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
      const failedReservation = reservationFromJobPayload(jobPayload);
      if (failedReservation) {
        await releaseCreditReservation(env, failedReservation).catch(
          () => undefined
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
            "Video generation failed.",
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
    ...(asset
      ? {
          asset: {
            ...rowToAsset(asset, assetProvenance),
            url: await signedMediaUrl(env, asset.id),
          },
        }
      : {}),
  });
}

async function handleVideoReference(
  request: Request,
  env: SitesEnvironment,
  url: URL
): Promise<Response> {
  if (
    (request.method !== "GET" && request.method !== "HEAD") ||
    !env.OPENROUTER_API_KEY
  ) {
    return errorResponse("Reference unavailable", 404);
  }
  const assetId = decodeURIComponent(
    url.pathname.split("/").filter(Boolean)[3] || ""
  );
  const expiresAt = Number(url.searchParams.get("expires") || "0");
  const token = url.searchParams.get("token") || "";
  const now = Math.floor(Date.now() / 1000);
  if (
    !assetId ||
    !Number.isInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + 25 * 60 ||
    !/^[a-f0-9]{64}$/i.test(token)
  ) {
    return errorResponse("Reference unavailable", 404);
  }
  const expected = await videoReferenceToken(
    env.OPENROUTER_API_KEY,
    assetId,
    expiresAt
  );
  if (!constantTimeEqual(token.toLowerCase(), expected)) {
    return errorResponse("Reference unavailable", 404);
  }

  await initializeSchema(env);
  const row = await env.DB.prepare("SELECT * FROM assets WHERE id = ?")
    .bind(assetId)
    .first<AssetRow>();
  if (!row || !row.content_type.startsWith("video/")) {
    return errorResponse("Reference unavailable", 404);
  }
  const object = await env.BUCKET.get(row.r2_key);
  if (!object) return errorResponse("Reference unavailable", 404);

  let body: ReadableStream | ArrayBuffer = object.body;
  if (row.r2_key.includes("/generated/")) {
    const owner = { email: row.owner_email, name: "Creator" };
    const provenance = await provenanceByEntity(env, owner, "asset", row.id);
    const structuralFailure = await generatedAssetStructuralFailure(
      env,
      owner,
      provenance,
      object
    );
    const bytes = structuralFailure ? null : await object.arrayBuffer();
    const byteFailure =
      !structuralFailure && bytes && provenance
        ? await generatedAssetByteFailure(row, provenance, object, bytes)
        : null;
    if (structuralFailure || byteFailure || !bytes) {
      return errorResponse("Reference unavailable", 404);
    }
    body = bytes;
  }

  return new Response(request.method === "HEAD" ? null : body, {
    headers: {
      "Content-Type": row.content_type,
      "Content-Length": String(row.bytes),
      "Cache-Control": `public, max-age=${Math.max(0, expiresAt - now)}`,
      "Content-Disposition": `inline; filename="${sanitizeFilename(row.name)}"`,
      "X-Content-Type-Options": "nosniff",
    },
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
    brandId: row.brand_id || "default",
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

const maintenanceJwks = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks")
);
async function handleMaintenance(
  request: Request,
  env: SitesEnvironment
): Promise<Response> {
  if (request.method !== "POST")
    return errorResponse("Method not allowed", 405);
  const token = (request.headers.get("authorization") || "").replace(
    /^Bearer /,
    ""
  );
  try {
    const { payload } = await jwtVerify(token, maintenanceJwks, {
      issuer: "https://token.actions.githubusercontent.com",
      audience: "https://reelassati.app",
      algorithms: ["RS256"],
    });
    if (!isAuthorizedMaintenanceIdentity(payload))
      return errorResponse("Unauthorized", 401);
  } catch {
    return errorResponse("Unauthorized", 401);
  }
  await initializeSchema(env);
  const tasks: Array<{ task: string; ok: boolean; checked?: number }> = [];
  try {
    await applyAllDueAnnualCreditRenewals(env);
    tasks.push({ task: "monthly credit renewals", ok: true });
  } catch {
    tasks.push({ task: "monthly credit renewals", ok: false });
  }
  try {
    await refreshWeeklyTrendFeed(env);
    tasks.push({ task: "weekly trends", ok: true });
  } catch {
    tasks.push({ task: "weekly trends", ok: false });
  }
  if (env.OPENROUTER_API_KEY) {
    const pending = await env.DB.prepare(
      "SELECT id,owner_email,brand_id FROM generation_jobs WHERE status IN ('pending','in_progress') ORDER BY updated_at LIMIT 2"
    ).all<{ id: string; owner_email: string; brand_id: string }>();
    let failed = 0;
    for (const job of pending.results) {
      try {
        const url = new URL(`https://reelassati.app/api/video/jobs/${job.id}`);
        const response = await handleVideoJobs(
          new Request(url),
          env,
          {
            email: job.owner_email,
            name: nameFromEmail(job.owner_email),
            brandId: job.brand_id,
          },
          url
        );
        if (!response.ok) failed++;
      } catch {
        failed++;
      }
    }
    tasks.push({
      task: "generation recovery",
      ok: failed === 0,
      checked: pending.results.length,
    });
  }
  if (env.ZERNIO_API_KEY) {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS social_analytics_snapshots(owner_key TEXT NOT NULL,day TEXT NOT NULL,payload TEXT NOT NULL,synced_at TEXT NOT NULL,PRIMARY KEY(owner_key,day))"
    ).run();
    const profiles = await env.DB.prepare(
      "SELECT owner_email FROM zernio_profiles ORDER BY COALESCE((SELECT MAX(synced_at) FROM social_analytics_snapshots WHERE owner_key = zernio_profiles.owner_email),'') LIMIT 20"
    ).all<{ owner_email: string }>();
    let failed = 0;
    for (const profile of profiles.results) {
      const [email, brandId] = profile.owner_email.split("::brand:");
      const user = {
        email,
        name: nameFromEmail(email),
        brandId: brandId || "default",
      };
      try {
        const response = await handleSocialAnalytics(
          new Request("https://reelassati.app/api/analytics/social", {
            method: "POST",
          }),
          env,
          user
        );
        if (!response.ok) failed++;
        await reconcilePublishingStatuses(env, user);
      } catch {
        failed++;
      }
    }
    tasks.push({
      task: "social results and publication status",
      ok: failed === 0,
      checked: profiles.results.length,
    });
  }
  const ok = tasks.every(t => t.ok);
  return json(
    { ok, checkedAt: new Date().toISOString(), tasks },
    ok ? 200 : 502
  );
}

async function handleOperations(
  request: Request,
  env: SitesEnvironment,
  user: AuthenticatedUser
): Promise<Response> {
  if (request.method !== "GET") return errorResponse("Method not allowed", 405);
  if (!operatorOwnerEmail(env) || operatorOwnerEmail(env) !== user.email)
    return errorResponse("Operator access required", 403);
  const billing = await billingSummary(env, user);
  const since = new Date(Date.now() - 7 * 86400000).toISOString(),
    stalled = new Date(Date.now() - 30 * 60000).toISOString();
  const [
    storage,
    payments,
    generations,
    stalledJobs,
    tickets,
    trend,
    paymentIssues,
  ] = await Promise.all([
    env.DB.prepare(
      "SELECT COUNT(*) AS count, COALESCE(SUM(bytes),0) AS bytes FROM assets"
    ).first<{ count: number; bytes: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM stripe_events WHERE status = 'failed'"
    ).first<{ count: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM ai_invocations WHERE status = 'failed' AND created_at >= ?"
    )
      .bind(since)
      .first<{ count: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM generation_jobs WHERE status IN ('pending','in_progress') AND updated_at < ?"
    )
      .bind(stalled)
      .first<{ count: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM support_tickets WHERE status = 'open'"
    ).first<{ count: number }>(),
    env.DB.prepare(
      "SELECT last_completed_at, last_error FROM trend_refresh_state WHERE refresh_key = ?"
    )
      .bind(TREND_WEEKLY_SCOPE_KEY)
      .first<{ last_completed_at: string | null; last_error: string | null }>(),
    env.DB.prepare(
      "SELECT event_id AS eventId, event_type AS type, created_at AS createdAt FROM stripe_events WHERE status = 'failed' ORDER BY created_at DESC LIMIT 10"
    ).all(),
  ]);
  return json({
    checkedAt: new Date().toISOString(),
    services: [
      { name: "AI generation", configured: !!env.OPENROUTER_API_KEY },
      { name: "Payments", configured: billing.configured },
      {
        name: "Social publishing and analytics",
        configured: !!env.ZERNIO_API_KEY,
      },
      { name: "Output marking", configured: !!env.AI_PROVENANCE_SIGNING_KEY },
    ],
    counts: {
      assets: storage?.count || 0,
      storageBytes: storage?.bytes || 0,
      failedPayments: payments?.count || 0,
      failedGenerations: generations?.count || 0,
      stalledGenerations: stalledJobs?.count || 0,
      openSupport: tickets?.count || 0,
    },
    trends: {
      generatedAt: trend?.last_completed_at || null,
      lastError: trend?.last_error || null,
    },
    paymentIssues: paymentIssues.results,
    billingReadiness: await stripeReadiness(env),
  });
}

async function handleAccountData(
  request: Request,
  env: SitesEnvironment,
  user: AuthenticatedUser
): Promise<Response> {
  if (request.method === "GET") {
    const brands = await env.DB.prepare(
      "SELECT id, name FROM brand_workspaces WHERE owner_email = ?"
    )
      .bind(user.email)
      .all<{ id: string; name: string }>();
    const workspaces = [];
    for (const brandId of ["default", ...brands.results.map(b => b.id)])
      workspaces.push({
        brandId,
        workspace: await getWorkspace(env, { ...user, brandId }),
      });
    const billing = await billingSummary(env, user);
    return json({
      exportedAt: new Date().toISOString(),
      email: user.email,
      workspaces,
      billing,
      note: "Workspace data and Library media links. Media links expire after six hours; download media separately from your Library.",
    });
  }
  if (request.method === "POST") {
    const input = await parseJsonBody<{ confirmation?: string }>(request);
    if (input.confirmation !== "DELETE MY ACCOUNT")
      return errorResponse("Confirm your account deletion request", 422);
    const existing = await env.DB.prepare(
      "SELECT id FROM support_tickets WHERE authenticated_owner_email = ? AND category = 'privacy' AND subject = 'Account deletion request' AND status = 'open' LIMIT 1"
    )
      .bind(user.email)
      .first<{ id: string }>();
    if (existing) return json({ requestId: existing.id });
    const ticket = await createSupportTicket(env, user, {
      category: "privacy",
      priority: "high",
      subject: "Account deletion request",
      description:
        "The signed-in account owner requests deletion of their account and all brand workspaces. Confirm billing cancellation and applicable record-retention requirements before completing deletion.",
    });
    return json({ requestId: ticket.id }, 201);
  }
  return errorResponse("Method not allowed", 405);
}

async function handleVoicePreview(
  request: Request,
  env: SitesEnvironment
): Promise<Response> {
  if (request.method !== "POST")
    return errorResponse("Method not allowed", 405);
  const input = await parseJsonBody<{ voice?: string }>(request);
  const voice = stringValue(input.voice);
  const previewText = Object.prototype.hasOwnProperty.call(
    VOICE_PREVIEWS,
    voice
  )
    ? VOICE_PREVIEWS[voice]
    : null;
  if (!previewText) return errorResponse("Choose an available voice", 422);
  if (!env.OPENROUTER_API_KEY || !env.AI_PROVENANCE_SIGNING_KEY || !env.BUCKET)
    return errorResponse("Voice preview is temporarily unavailable", 503);
  const system = {
    email: "system-voice-previews@reelassati.app",
    name: "REELassati",
  };
  const model = env.OPENROUTER_TTS_MODEL || "minimax/speech-2.8-turbo";
  const id = `voice-preview-${(await sha256Hex(`${model}:${voice}:${previewText}`)).slice(0, 32)}`;
  const r2Key = `users/${encodeURIComponent(system.email)}/generated/${id}.mp3`;
  const cached = await env.DB.prepare(
    "SELECT id FROM assets WHERE owner_email = ? AND r2_key = ?"
  )
    .bind(system.email, r2Key)
    .first<{ id: string }>();
  if (cached) return json({ url: await signedMediaUrl(env, cached.id) });
  const now = new Date().toISOString(),
    leaseUntil = new Date(Date.now() + 300000).toISOString();
  const lock = await env.DB.prepare(
    `INSERT INTO trend_refresh_state(refresh_key,lease_expires_at,last_started_at) VALUES (?,?,?) ON CONFLICT(refresh_key) DO UPDATE SET lease_expires_at=excluded.lease_expires_at,last_started_at=excluded.last_started_at WHERE lease_expires_at <= ?`
  )
    .bind(id, leaseUntil, now, now)
    .run();
  if (lock.meta?.changes !== 1)
    return errorResponse(
      "This voice preview is being prepared. Try again in a moment.",
      409
    );
  const invocation = await beginAiInvocation(
    env,
    system,
    "speech-synthesis",
    "OpenRouter",
    model,
    { sharedPreview: true, voice, text: previewText }
  );
  const assetId = crypto.randomUUID();
  let provenance: ContentProvenance | undefined;
  try {
    const response = await fetch(`${OPENROUTER_BASE}/audio/speech`, {
      method: "POST",
      headers: openRouterHeaders(env),
      body: JSON.stringify({
        model,
        input: previewText,
        voice,
        response_format: "mp3",
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) await providerError(response, "OpenRouter");
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 2000000)
      throw new Error("Voice preview exceeds its size limit");
    provenance = await createProvenanceRecord(env, system, {
      entityType: "asset",
      entityId: assetId,
      origin: "ai-generated",
      operation: "speech-synthesis",
      provider: "OpenRouter",
      model,
      content: bytes,
      embeddedMediaMarker: true,
      metadata: { sharedPreview: true, voice },
    });
    const marked = embedMediaProvenanceMarker(
      bytes,
      "audio/mpeg",
      provenance.marking.publicToken || ""
    );
    if (!marked) throw new Error("Voice preview marking unavailable");
    await env.BUCKET.put(r2Key, marked.bytes, {
      httpMetadata: { contentType: "audio/mpeg" },
      customMetadata: {
        owner: system.email,
        provenanceToken: provenance.marking.publicToken || "",
        policyVersion: AI_COMPLIANCE_POLICY_VERSION,
        embeddedMarking: marked.method,
      },
    });
    await finalizeEmbeddedProvenance(env, system, provenance, marked.bytes);
    await insertAssetRecord(env, system, {
      id: assetId,
      name: "Voice preview.mp3",
      kind: "audio",
      contentType: "audio/mpeg",
      size: marked.bytes.byteLength,
      r2Key,
    });
    await completeAiInvocation(env, invocation, await sha256Hex(bytes));
    return json({ url: await signedMediaUrl(env, assetId) });
  } catch (cause) {
    await failAiInvocation(env, invocation, "preview_generation_failure");
    if (provenance)
      await failProvenanceRecord(
        env,
        system,
        provenance.recordId,
        "asset",
        assetId,
        "preview_generation_failure"
      );
    await env.BUCKET.delete(r2Key).catch(() => undefined);
    await env.DB.prepare("DELETE FROM assets WHERE id = ? AND owner_email = ?")
      .bind(assetId, system.email)
      .run()
      .catch(() => undefined);
    throw cause;
  }
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
    const [accountLimit, connectedAccounts] = await Promise.all([
      socialAccountLimit(env, user),
      (async () => {
        const brands = await env.DB.prepare(
          "SELECT id FROM brand_workspaces WHERE owner_email = ?"
        )
          .bind(user.email)
          .all<{ id: string }>();
        const accounts = [] as PublishingAccount[];
        for (const brandId of ["default", ...brands.results.map(b => b.id)])
          accounts.push(
            ...(await listZernioAccounts(env, { ...user, brandId }))
          );
        return accounts;
      })(),
    ]);
    if (accountLimit <= 0) {
      return errorResponse(
        "Choose an active plan before connecting a publishing account",
        402
      );
    }
    if (connectedAccounts.length >= accountLimit) {
      return errorResponse(
        `Your plan includes ${accountLimit} connected social account${accountLimit === 1 ? "" : "s"}. Manage your plan to add another.`,
        409
      );
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
      return errorResponse(
        "The publishing service did not return a safe connection URL",
        502
      );
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
            "The delivery outcome is still unconfirmed, so this request is locked to prevent a duplicate publication. Verify the post on the destination before replacing it.",
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
              throw errorResponse("Publishing accepts an image or video asset");
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
                "The publishing service returned an invalid media upload URL",
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
                "The publishing service could not receive the selected media",
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
          ? `Delivery status: ${providerStatus || "failed"}`
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

function referralBillingWebhookSecret(env: SitesEnvironment): string | null {
  const secret = stringValue(env.REFERRAL_BILLING_WEBHOOK_SECRET);
  return secret.length >= 24 ? secret : null;
}

async function handleReferralBillingWebhook(
  request: Request,
  env: SitesEnvironment
): Promise<Response> {
  const secret = referralBillingWebhookSecret(env);
  if (request.method !== "POST" || !secret) {
    return errorResponse("Webhook unavailable", 404);
  }

  const rawBody = new TextDecoder().decode(
    await readBoundedBody(request, MAX_WORKSPACE_BYTES)
  );
  const signatureValid = await verifyReferralBillingWebhook(
    rawBody,
    request.headers.get("x-reelassati-signature"),
    secret
  );
  if (!signatureValid) {
    return errorResponse("Webhook signature is invalid", 401);
  }

  let input: {
    type?: string;
    eventId?: string;
    customerEmail?: string;
    planId?: string;
    paymentStatus?: string;
  };
  try {
    input = JSON.parse(rawBody) as typeof input;
  } catch {
    return errorResponse("Webhook body is invalid");
  }

  const eventId = stringValue(input.eventId).trim();
  const customerEmail = normalizedConfiguredEmail(input.customerEmail);
  const planId = stringValue(input.planId).trim();
  if (
    input.type !== "paid_plan_purchased" ||
    input.paymentStatus !== "paid" ||
    !/^[A-Za-z0-9._:-]{6,200}$/.test(eventId) ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail) ||
    !planId ||
    planId.length > 120
  ) {
    return errorResponse("Webhook purchase event is invalid");
  }

  await initializeSchema(env);
  const claim = await env.DB.prepare(
    `
      SELECT id, referral_code, referrer_email, referred_email,
             status, credits_awarded, value_cents, qualified_at,
             payment_event_id, plan_id, created_at
      FROM referral_claims
      WHERE referred_email = ?
    `
  )
    .bind(customerEmail)
    .first<ReferralClaimRow>();
  if (!claim) {
    return errorResponse("No referral claim matches this purchaser", 409);
  }
  if (claim.status === "verified") {
    return json({
      success: true,
      verified: true,
      alreadyQualified: true,
      creditsAwarded: claim.credits_awarded,
    });
  }

  const qualifiedAt = new Date().toISOString();
  let result: D1Result;
  try {
    const [qualificationResult] = await env.DB.batch([
      env.DB.prepare(
        `
          UPDATE referral_claims
          SET status = 'verified', credits_awarded = ?, value_cents = ?,
              qualified_at = ?, payment_event_id = ?, plan_id = ?
          WHERE id = ? AND status = 'pending' AND payment_event_id IS NULL
        `
      ).bind(
        REFERRAL_REWARD_CREDITS,
        REFERRAL_REWARD_CENTS,
        qualifiedAt,
        eventId,
        planId,
        claim.id
      ),
      env.DB.prepare(
        `
          INSERT INTO compliance_events
            (id, owner_email, event_type, entity_type, entity_id,
             policy_version, details_json, created_at)
          SELECT ?, ?, 'referral.reward-qualified', 'referral-claim', ?, ?, ?, ?
          FROM referral_claims
          WHERE id = ? AND payment_event_id = ? AND qualified_at = ?
        `
      ).bind(
        `referral-qualified:${eventId}`,
        claim.referrer_email,
        claim.id,
        AI_COMPLIANCE_POLICY_VERSION,
        JSON.stringify({
          paymentEventId: eventId,
          planId,
          creditsAwarded: REFERRAL_REWARD_CREDITS,
          valueCents: REFERRAL_REWARD_CENTS,
        }),
        qualifiedAt,
        claim.id,
        eventId,
        qualifiedAt
      ),
    ]);
    result = qualificationResult;
  } catch {
    return errorResponse("This billing event has already been processed", 409);
  }
  if ((result.meta?.changes || 0) !== 1) {
    const raced = await env.DB.prepare(
      "SELECT status, credits_awarded FROM referral_claims WHERE id = ?"
    )
      .bind(claim.id)
      .first<Pick<ReferralClaimRow, "status" | "credits_awarded">>();
    if (raced?.status === "verified") {
      return json({
        success: true,
        verified: true,
        alreadyQualified: true,
        creditsAwarded: raced.credits_awarded,
      });
    }
    return errorResponse("The referral could not be qualified", 409);
  }

  await grantReferralCredits(
    env,
    claim.referrer_email,
    claim.id,
    REFERRAL_REWARD_CREDITS
  );

  return json({
    success: true,
    verified: true,
    alreadyQualified: false,
    creditsAwarded: REFERRAL_REWARD_CREDITS,
  });
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
  const [result, totals] = await Promise.all([
    env.DB.prepare(
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
      .all<ReferralClaimRow>(),
    env.DB.prepare(
      `
        SELECT
          SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status = 'verified' THEN credits_awarded ELSE 0 END)
            AS credits_earned,
          SUM(CASE WHEN status = 'verified' THEN value_cents ELSE 0 END)
            AS value_cents
        FROM referral_claims
        WHERE referrer_email = ?
      `
    )
      .bind(user.email)
      .first<{
        completed: number | null;
        pending: number | null;
        credits_earned: number | null;
        value_cents: number | null;
      }>(),
  ]);
  const completedReferrals = Math.max(0, Number(totals?.completed) || 0);
  const pendingReferrals = Math.max(0, Number(totals?.pending) || 0);
  const creditsEarned = Math.max(0, Number(totals?.credits_earned) || 0);
  const valueCents = Math.max(0, Number(totals?.value_cents) || 0);
  const shareUrl = new URL("/", url.origin);
  shareUrl.searchParams.set("ref", referralCode.code);
  return json({
    code: referralCode.code,
    shareUrl: shareUrl.toString(),
    completedReferrals,
    pendingReferrals,
    creditsEarned,
    dollarValue: referralDollarValue(valueCents),
    rewardCredits: REFERRAL_REWARD_CREDITS,
    rewardDollarValue: referralDollarValue(REFERRAL_REWARD_CENTS),
    billingVerificationConfigured: Boolean(
      referralBillingWebhookSecret(env) || stripeBillingConfigured(env)
    ),
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
    if (releaseStatus !== "public") {
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

const SUPPORT_EMAIL = "reelassati@gmail.com";
const SUPPORT_CATEGORIES = new Set([
  "account",
  "billing",
  "studio",
  "generation",
  "publishing",
  "privacy",
  "bug",
  "other",
]);
const SUPPORT_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

const SUPPORT_SYSTEM_PROMPT = `You are REELassati Support, the official product support assistant. Your job is to solve the user's problem inside the conversation whenever safe and possible, not to dispose of the conversation by escalating it.

OFFICIAL PRODUCT KNOWLEDGE
- Public routes: pricing at /pricing; login at /auth/login; signup at /auth/signup; password recovery at /auth/forgot-password; support at /contact.
- Pricing: Creator is EUR ${PUBLIC_PLAN_PRICING.Creator.monthlyPrice} monthly or EUR ${PUBLIC_PLAN_PRICING.Creator.annualTotal} annually (EUR ${annualMonthlyEquivalent("Creator").toFixed(2)}/month equivalent) with ${PUBLIC_PLAN_PRICING.Creator.monthlyCredits.toLocaleString("en-US")} credits per month, 1 brand workspace, and 2 connected social accounts. Pro is EUR ${PUBLIC_PLAN_PRICING.Pro.monthlyPrice} monthly or EUR ${PUBLIC_PLAN_PRICING.Pro.annualTotal} annually (EUR ${annualMonthlyEquivalent("Pro").toFixed(2)}/month equivalent) with ${PUBLIC_PLAN_PRICING.Pro.monthlyCredits.toLocaleString("en-US")} credits per month, 3 brand workspaces, and 6 connected social accounts. Studio is EUR ${PUBLIC_PLAN_PRICING.Studio.monthlyPrice} monthly or EUR ${PUBLIC_PLAN_PRICING.Studio.annualTotal.toLocaleString("en-US")} annually (EUR ${annualMonthlyEquivalent("Studio").toFixed(2)}/month equivalent) with ${PUBLIC_PLAN_PRICING.Studio.monthlyCredits.toLocaleString("en-US")} credits per month, 10 brand workspaces, and 12 connected social accounts. Annual billing charges the price of ${ANNUAL_BILLED_MONTHS} monthly payments. The complete Studio is included in every plan. AI tools use REELassati credits inside the platform; never quote upstream model or provider prices.
- Account access: users can sign up, log in, request a password-reset email, and set a new password from the reset link. A reset link may be expired or already used; request a fresh one and use only the newest email. Never ask for passwords, verification codes, OAuth secrets, private tokens, card data, or identity documents.
- Uploads: hosted workspace uploads accept video, audio, and image files up to 64 MB. Direct AI video analysis and audio transcription require the relevant media to be below 24 MB. If a file is too large, instruct the user to trim or compress it, then retry with a new upload.
- Studio: users can create projects; trim, split, move, delete, caption, adjust pacing, add B-roll/audio/style suggestions, lock clips, and review AI edit plans before applying changes. AI recommendations are proposals, not proof that an edit was applied.
- AI tools: Script, AI Video, Video Analyzer, Voice Studio, Interview Me, Trends, Weekly Coach, and Prompt Director use managed REELassati AI routes. Never reveal upstream providers, model names, internal job identifiers, or upstream prices. For an AI failure, preserve the displayed reference, retry once unchanged, then gather the tool, exact error, file type/size, browser, and last successful step.
- Publishing: users connect supported social accounts in Social Hub/Settings and publish or schedule from Publisher. Supported platforms include Instagram, TikTok, YouTube, Facebook, LinkedIn, Pinterest, Threads, and X/Twitter when the publishing integration is configured. A caption and a connected account are required. Never claim a post is live until the UI/provider reports published.
- Workspace areas also include Calendar, Analytics, Clients, Content Library, Referrals, Settings, and Studio Status.
- Common browser recovery: preserve work first; reload once; sign out and back in for session errors; disable a blocking extension for the site; allow pop-ups only when an OAuth window was blocked; try a current Chrome, Edge, Firefox, or Safari build; do not tell the user to clear all browser data before less destructive steps.

CONVERSATION RULES
1. Directly answer the user's question first. Ask at most one focused follow-up question per response.
2. Use the supplied conversation as state. A clicked choice is a user answer. Never respond as though the assistant itself selected or lacks a preference.
3. For troubleshooting, provide one small numbered sequence, then ask what happened. Do not repeat steps the conversation says were already tried.
4. Pricing and sales questions are answerable from the official pricing above. Give the relevant facts and narrow the plan before offering human sales. Do not create a billing ticket merely because pricing was mentioned.
5. Set needsHuman and ticketDraft only when the user explicitly asks for a person/ticket, an authenticated account/payment/privacy/security action is required, data may be lost, or at least two reasonable troubleshooting rounds failed. Otherwise keep ticketDraft null.
6. A ticket draft is not a sent ticket. Say that the user must review and submit it in the ticket panel. Never claim an email or ticket was sent; the server reports that separately.
7. Do not claim to inspect an account, payment, file, provider status, deployment, or log unless the conversation supplies that fact.
8. Reply in the requested locale. If uncertain, use the language of the latest user message.

CHOICE BUTTON RULES
- suggestedActions must be an array of no more than four objects: {"label":"short visible choice","message":"exact user reply sent when clicked"}.
- The message must be written from the user's perspective, normally beginning with “I”, “My”, “Yes”, or “No” (or the natural equivalent in the reply language).
- Buttons are answers to your one follow-up question, never instructions to the user or assistant. Never output actions such as “Reply with…”, “Tell me…”, “Include…”, “Select…”, or “Confirm and route…”.
- Example: {"label":"Annual billing","message":"I prefer annual billing."}.

Return strict JSON with reply (string), resolved (boolean), needsHuman (boolean), suggestedActions (array described above), and ticketDraft (null or {category, priority, subject, description}). Available categories: account, billing, studio, generation, publishing, privacy, bug, other. Available priorities: low, normal, high, urgent.`;

function supportActions(value: unknown): SupportAction[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(action => {
      const record = recordValue(action);
      if (record) {
        const label = stringValue(record.label).trim().slice(0, 80);
        const message = stringValue(record.message).trim().slice(0, 300);
        if (
          !label ||
          !message ||
          /^(?:reply|tell|provide|include|choose|select|enter|type|specify|let me know|open|try|reconnect|go|check|click|tap|use|rispondi|dimmi|inserisci|scegli|seleziona|apri|prova|ricollega|vai|controlla|clicca|tocca|usa)\b/i.test(
            message
          )
        ) {
          return null;
        }
        return { label, message };
      }
      const legacy = stringValue(action).trim().slice(0, 300);
      if (
        !legacy ||
        /^(?:reply|tell|provide|include|choose|select|enter|type|specify|let me know|open|try|reconnect|go|check|click|tap|use|rispondi|dimmi|inserisci|scegli|seleziona|apri|prova|ricollega|vai|controlla|clicca|tocca|usa)\b/i.test(
          legacy
        )
      ) {
        return null;
      }
      return { label: legacy.slice(0, 80), message: legacy };
    })
    .filter((action): action is SupportAction => Boolean(action))
    .slice(0, 4);
}

function pricingPlanFromConversation(
  messages: SupportMessage[]
): "Creator" | "Pro" | "Studio" | null {
  const conversation = messages
    .filter(message => message.role === "user")
    .map(message => message.content)
    .join(" ");
  if (
    /\b(?:studio plan|agency|agenc(?:y|ies)|10 brands?|12 (?:connected )?social)\b/i.test(
      conversation
    )
  ) {
    return "Studio";
  }
  if (
    /\b(?:pro plan|small team|3 brands?|6 (?:connected )?social)\b/i.test(
      conversation
    )
  ) {
    return "Pro";
  }
  if (
    /\b(?:creator plan|one creator|solo creator|1 brand|2 (?:connected )?social)\b/i.test(
      conversation
    )
  ) {
    return "Creator";
  }
  return null;
}

function pricingTermFromConversation(
  messages: SupportMessage[]
): "monthly" | "annual" | null {
  const latestPreference = [...messages]
    .reverse()
    .find(
      message =>
        message.role === "user" &&
        /\b(?:monthly|annual|mensile|annuale)\b/i.test(message.content)
    );
  if (!latestPreference) return null;
  return /\b(?:annual|annuale)\b/i.test(latestPreference.content)
    ? "annual"
    : "monthly";
}

function guidedPricingSupport(
  messages: SupportMessage[],
  locale: string
): Record<string, unknown> | null {
  const userMessages = messages.filter(message => message.role === "user");
  const latest = userMessages.at(-1)?.content || "";
  const previous = userMessages.slice(0, -1);
  const pricingPattern =
    /\b(?:pricing|prices?|cost|plans?|sales|contract|monthly|annual|credits?|top[ -]?ups?|prezzi?|costo|piani?|vendite|contratto|mensile|annuale|crediti|ricariche?)\b/i;
  const hasPricingContext = userMessages.some(message =>
    pricingPattern.test(message.content)
  );
  if (!hasPricingContext) return null;

  const italian =
    locale.toLowerCase().startsWith("it") ||
    /\b(?:prezzi?|piani?|annuale|mensile)\b/i.test(latest);
  const priorPricingContext = previous.some(message =>
    pricingPattern.test(message.content)
  );
  const asksForHuman =
    /\b(?:human|person|sales (?:team|person)|talk to sales|contact sales|persona|umano|team vendite|parlare con)\b/i.test(
      latest
    );
  const confirmsTicket =
    /\b(?:create|open|send|submit|confirm|route|forward|crea|apri|invia|conferma|inoltra)\b.{0,45}\b(?:ticket|billing|sales|support|vendite|fatturazione|supporto)\b/i.test(
      latest
    );
  const plan = pricingPlanFromConversation(messages);
  const term = pricingTermFromConversation(messages);

  if ((asksForHuman && priorPricingContext) || confirmsTicket) {
    const preference =
      [plan, term].filter(Boolean).join(" · ") || "not selected yet";
    return {
      reply: italian
        ? "Ho preparato una bozza completa per il team commerciale. Controlla i dati nel pannello ticket e inviala: finché non premi il pulsante, non viene inoltrato nulla."
        : "I prepared a complete draft for the sales team. Review your details in the ticket panel and submit it; nothing is routed until you use that button.",
      resolved: false,
      needsHuman: true,
      suggestedActions: [
        italian
          ? {
              label: "Continua qui",
              message: "Preferisco continuare qui senza inviare il ticket.",
            }
          : {
              label: "Keep helping me here",
              message: "I prefer to continue here without sending the ticket.",
            },
      ],
      ticketDraft: {
        category: "billing",
        priority: "normal",
        subject: "Pricing and sales conversation",
        description: `The customer would like a sales conversation about REELassati pricing. Current preference: ${preference}. Please follow up with plan fit, billing terms, and any remaining commercial requirements.`,
      },
    };
  }

  const rates = {
    Creator: {
      monthly: PUBLIC_PLAN_PRICING.Creator.monthlyPrice,
      annualMonthly: annualMonthlyEquivalent("Creator"),
      annualTotal: PUBLIC_PLAN_PRICING.Creator.annualTotal,
      monthlyCredits: PUBLIC_PLAN_PRICING.Creator.monthlyCredits,
      scale: "1 brand workspace and 2 connected social accounts",
      scaleItalian: "1 workspace brand e 2 account social collegati",
    },
    Pro: {
      monthly: PUBLIC_PLAN_PRICING.Pro.monthlyPrice,
      annualMonthly: annualMonthlyEquivalent("Pro"),
      annualTotal: PUBLIC_PLAN_PRICING.Pro.annualTotal,
      monthlyCredits: PUBLIC_PLAN_PRICING.Pro.monthlyCredits,
      scale: "3 brand workspaces and 6 connected social accounts",
      scaleItalian: "3 workspace brand e 6 account social collegati",
    },
    Studio: {
      monthly: PUBLIC_PLAN_PRICING.Studio.monthlyPrice,
      annualMonthly: annualMonthlyEquivalent("Studio"),
      annualTotal: PUBLIC_PLAN_PRICING.Studio.annualTotal,
      monthlyCredits: PUBLIC_PLAN_PRICING.Studio.monthlyCredits,
      scale: "10 brand workspaces and 12 connected social accounts",
      scaleItalian: "10 workspace brand e 12 account social collegati",
    },
  } as const;

  if (/\b(?:credits?|top[ -]?ups?|crediti|ricariche?)\b/i.test(latest)) {
    return {
      reply: italian
        ? `Le ricariche sono: ${CREDIT_TOP_UPS.boost.credits} crediti a €${CREDIT_TOP_UPS.boost.price}, ${CREDIT_TOP_UPS.momentum.credits.toLocaleString("it-IT")} a €${CREDIT_TOP_UPS.momentum.price}, oppure ${CREDIT_TOP_UPS.scale.credits.toLocaleString("it-IT")} a €${CREDIT_TOP_UPS.scale.price}. Richiedono un piano attivo e non scadono; i crediti inclusi nel piano si aggiornano ogni mese.`
        : `Top-ups are ${CREDIT_TOP_UPS.boost.credits} credits for €${CREDIT_TOP_UPS.boost.price}, ${CREDIT_TOP_UPS.momentum.credits.toLocaleString("en-US")} for €${CREDIT_TOP_UPS.momentum.price}, or ${CREDIT_TOP_UPS.scale.credits.toLocaleString("en-US")} for €${CREDIT_TOP_UPS.scale.price}. They require an active plan and roll over; included plan credits refresh monthly.`,
      resolved: true,
      needsHuman: false,
      suggestedActions: [],
      ticketDraft: null,
    };
  }

  if (plan) {
    const rate = rates[plan];
    return {
      reply: italian
        ? `${plan} include ${rate.monthlyCredits.toLocaleString("it-IT")} crediti al mese, ${rate.scaleItalian}. Costa €${rate.monthly}/mese oppure €${rate.annualTotal.toLocaleString("it-IT")}/anno (€${rate.annualMonthly.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mese equivalente). Lo Studio completo è incluso e gli strumenti AI usano soltanto crediti REELassati. Quale fatturazione preferisci?`
        : `${plan} includes ${rate.monthlyCredits.toLocaleString("en-US")} credits per month and ${rate.scale}. It costs €${rate.monthly}/month or €${rate.annualTotal.toLocaleString("en-US")}/year (€${rate.annualMonthly.toFixed(2)}/month equivalent). The complete Studio is included; AI tools use REELassati credits inside the platform. Which billing term do you prefer?`,
      resolved: false,
      needsHuman: false,
      suggestedActions: italian
        ? [
            {
              label: "Mensile",
              message: "Preferisco la fatturazione mensile.",
            },
            {
              label: "Annuale",
              message: "Preferisco la fatturazione annuale.",
            },
            {
              label: "Parla con vendite",
              message: "Vorrei parlare con una persona del team vendite.",
            },
          ]
        : [
            { label: "Monthly billing", message: "I prefer monthly billing." },
            { label: "Annual billing", message: "I prefer annual billing." },
            {
              label: "Talk to sales",
              message: "I want a human sales conversation.",
            },
          ],
      ticketDraft: null,
    };
  }

  if (
    term ||
    /\b(?:compare|comparison|every plan|all plans|confronta|tutti i piani)\b/i.test(
      latest
    )
  ) {
    return {
      reply: italian
        ? `Mensile: Creator €19 con 1.000 crediti, Pro €59 con 4.000 crediti, Studio €149 con 12.000 crediti. Annuale, pagando ${ANNUAL_BILLED_MONTHS} mesi: Creator €190, Pro €590, Studio €1.490. Lo Studio completo è incluso in ogni piano; cambiano crediti, workspace e account collegati. Quale profilo ti descrive meglio?`
        : `Monthly: Creator €19 with 1,000 credits, Pro €59 with 4,000 credits, and Studio €149 with 12,000 credits. Annual billing charges ${ANNUAL_BILLED_MONTHS} months: Creator €190, Pro €590, and Studio €1,490. Every plan includes the complete Studio; credits, workspaces, and connected accounts scale by plan. Which profile fits you?`,
      resolved: false,
      needsHuman: false,
      suggestedActions: italian
        ? [
            {
              label: "Creator singolo",
              message:
                "Sono un creator singolo e mi servono fino a 2 account social collegati.",
            },
            {
              label: "Piccolo team",
              message: "Gestisco fino a 3 brand e 6 account social collegati.",
            },
            {
              label: "Agenzia",
              message: "Gestisco un’agenzia o un portfolio clienti.",
            },
          ]
        : [
            {
              label: "Solo creator",
              message:
                "I’m one creator and need up to 2 connected social accounts.",
            },
            {
              label: "Small team",
              message:
                "I manage up to 3 brands and 6 connected social accounts.",
            },
            {
              label: "Agency / clients",
              message: "I manage an agency or client portfolio.",
            },
          ],
      ticketDraft: null,
    };
  }

  return {
    reply: italian
      ? `Certo. Prima di coinvolgere il team vendite posso darti subito prezzi e piano adatto: Creator €19/mese con 1.000 crediti, Pro €59/mese con 4.000 crediti, Studio €149/mese con 12.000 crediti. Con l’annuale paghi ${ANNUAL_BILLED_MONTHS} mesi. Lo Studio completo è incluso in ogni piano; cambiano crediti, workspace e account collegati. Quale profilo ti descrive meglio?`
      : `Yes. Before involving sales, here are the useful facts: Creator is €19/month with 1,000 credits, Pro €59/month with 4,000 credits, and Studio €149/month with 12,000 credits. Annual billing charges ${ANNUAL_BILLED_MONTHS} months. Every plan includes the complete Studio; credits, workspaces, and connected accounts scale by plan. Which profile fits you?`,
    resolved: false,
    needsHuman: false,
    suggestedActions: italian
      ? [
          {
            label: "Creator singolo",
            message:
              "Sono un creator singolo e mi servono fino a 2 account social collegati.",
          },
          {
            label: "Piccolo team",
            message: "Gestisco fino a 3 brand e 6 account social collegati.",
          },
          {
            label: "Agenzia",
            message: "Gestisco un’agenzia o un portfolio clienti.",
          },
          {
            label: "Confronta i piani",
            message:
              "Mostrami il confronto completo tra prezzi mensili e annuali.",
          },
        ]
      : [
          {
            label: "Solo creator",
            message:
              "I’m one creator and need up to 2 connected social accounts.",
          },
          {
            label: "Small team",
            message: "I manage up to 3 brands and 6 connected social accounts.",
          },
          {
            label: "Agency / clients",
            message: "I manage an agency or client portfolio.",
          },
          {
            label: "Compare every plan",
            message: "Show me the full monthly and annual pricing comparison.",
          },
        ],
    ticketDraft: null,
  };
}

function supportMessages(value: unknown): SupportMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-10)
    .map(item => {
      if (!recordValue(item)) return null;
      const role = item.role === "assistant" ? "assistant" : "user";
      const content = stringValue(item.content).trim().slice(0, 2400);
      return content ? { role, content } : null;
    })
    .filter((item): item is SupportMessage => Boolean(item));
}

function supportCategory(value: unknown): string {
  const category = stringValue(value).trim().toLowerCase();
  return SUPPORT_CATEGORIES.has(category) ? category : "other";
}

function supportPriority(value: unknown): string {
  const priority = stringValue(value).trim().toLowerCase();
  return SUPPORT_PRIORITIES.has(priority) ? priority : "normal";
}

function validSupportEmail(value: unknown): string | null {
  const email = stringValue(value).trim().toLowerCase().slice(0, 254);
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, character => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

async function supportRateLimit(
  request: Request,
  env: SitesEnvironment,
  user: AuthenticatedUser | null
): Promise<boolean> {
  await initializeSchema(env);
  const ip =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const hour = new Date().toISOString().slice(0, 13);
  const identity = user?.email || ip;
  const key = await sha256Hex(`support:${hour}:${identity}`);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO support_rate_limits
       (key, request_count, window_started_at, updated_at)
     VALUES (?, 1, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       request_count = request_count + 1,
       updated_at = excluded.updated_at`
  )
    .bind(key, now, now)
    .run();
  const row = await env.DB.prepare(
    "SELECT request_count FROM support_rate_limits WHERE key = ?"
  )
    .bind(key)
    .first<{ request_count: number }>();
  return Number(row?.request_count || 0) <= (user ? 60 : 25);
}

async function sendSupportEmail(
  env: SitesEnvironment,
  ticket: {
    id: string;
    email: string;
    name: string;
    category: string;
    priority: string;
    subject: string;
    description: string;
    conversation: SupportMessage[];
  }
): Promise<{ status: string; providerMessageId: string | null }> {
  if (!env.RESEND_API_KEY) {
    return { status: "configuration_required", providerMessageId: null };
  }
  const destination = validSupportEmail(env.SUPPORT_EMAIL_TO) || SUPPORT_EMAIL;
  const from =
    stringValue(env.SUPPORT_EMAIL_FROM).trim() ||
    "REELassati Support <support@reelassati.app>";
  const transcript = ticket.conversation
    .map(
      message =>
        `<p><strong>${message.role === "user" ? "Customer" : "Assistant"}:</strong> ${htmlEscape(message.content)}</p>`
    )
    .join("");
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `support-ticket-${ticket.id}`,
      },
      body: JSON.stringify({
        from,
        to: [destination],
        reply_to: ticket.email,
        subject: `[${ticket.priority.toUpperCase()}] ${ticket.id} · ${ticket.subject}`,
        html: `<h1>REELassati support ticket</h1><p><strong>ID:</strong> ${ticket.id}</p><p><strong>Customer:</strong> ${htmlEscape(ticket.name)} &lt;${htmlEscape(ticket.email)}&gt;</p><p><strong>Category:</strong> ${htmlEscape(ticket.category)}</p><p><strong>Priority:</strong> ${htmlEscape(ticket.priority)}</p><h2>${htmlEscape(ticket.subject)}</h2><p>${htmlEscape(ticket.description).replace(/\n/g, "<br>")}</p>${transcript ? `<hr><h3>Conversation</h3>${transcript}` : ""}`,
      }),
    });
    if (!response.ok) return { status: "failed", providerMessageId: null };
    const payload = (await response.json()) as { id?: unknown };
    const id = stringValue(payload.id).slice(0, 160) || null;
    return { status: "sent", providerMessageId: id };
  } catch {
    return { status: "failed", providerMessageId: null };
  }
}

async function createSupportTicket(
  env: SitesEnvironment,
  user: AuthenticatedUser | null,
  input: SupportTicketInput
): Promise<{
  id: string;
  emailStatus: string;
  supportEmail: string;
}> {
  await initializeSchema(env);
  const email = user?.email || validSupportEmail(input.email);
  if (!email) {
    throw errorResponse("Add a valid email so support can reply");
  }
  const name = (
    user?.name ||
    stringValue(input.name).trim() ||
    "Customer"
  ).slice(0, 120);
  const category = supportCategory(input.category);
  const priority = supportPriority(input.priority);
  const subject = stringValue(input.subject).trim().slice(0, 180);
  const description = stringValue(input.description).trim().slice(0, 8000);
  const conversation = supportMessages(input.conversation);
  if (subject.length < 4) throw errorResponse("Add a short ticket subject");
  if (description.length < 10) {
    throw errorResponse("Describe what happened and what you expected");
  }
  const id = `RA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();
  const summary = `${category}: ${subject}. ${description}`.slice(0, 1200);
  await env.DB.prepare(
    `INSERT INTO support_tickets
       (id, requester_email, requester_name, authenticated_owner_email,
        category, priority, subject, description, conversation_json,
        ai_summary, status, email_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 'pending', ?, ?)`
  )
    .bind(
      id,
      email,
      name,
      user?.email || null,
      category,
      priority,
      subject,
      description,
      JSON.stringify(conversation),
      summary,
      now,
      now
    )
    .run();
  const delivery = await sendSupportEmail(env, {
    id,
    email,
    name,
    category,
    priority,
    subject,
    description,
    conversation,
  });
  await env.DB.prepare(
    `UPDATE support_tickets
     SET email_status = ?, provider_message_id = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
      delivery.status,
      delivery.providerMessageId,
      new Date().toISOString(),
      id
    )
    .run();
  return { id, emailStatus: delivery.status, supportEmail: SUPPORT_EMAIL };
}

function explicitlyRequestsTicket(message: string): boolean {
  return /(?:\b(?:open|create|raise|file|submit|send|confirm|route|forward)\b.{0,45}\b(?:ticket|support request|billing team|sales team)\b)|(?:\b(?:apri|crea|invia|conferma|inoltra)\b.{0,45}\b(?:ticket|richiesta di supporto|team vendite|fatturazione)\b)/i.test(
    message
  );
}

async function handleSupport(
  request: Request,
  env: SitesEnvironment,
  url: URL
): Promise<Response> {
  if (request.method !== "POST")
    return errorResponse("Method not allowed", 405);
  const user = await getUser(request, env);
  if (!(await supportRateLimit(request, env, user))) {
    return errorResponse(
      "Support is receiving too many requests from this connection. Try again in an hour or email reelassati@gmail.com.",
      429
    );
  }
  if (url.pathname === "/api/support/tickets") {
    const input = await parseJsonBody<SupportTicketInput>(request);
    return json({ ticket: await createSupportTicket(env, user, input) }, 201);
  }
  if (url.pathname !== "/api/support/chat") {
    return errorResponse("Support route not found", 404);
  }
  const input = await parseJsonBody<{ messages?: unknown; locale?: unknown }>(
    request
  );
  const messages = supportMessages(input.messages);
  const latest = [...messages]
    .reverse()
    .find(message => message.role === "user");
  if (!latest)
    return errorResponse("Write a question for the support assistant");
  const locale = stringValue(input.locale).slice(0, 24) || "en";
  const aiUser = user || {
    email: "anonymous-support@reelassati.app",
    name: "Public visitor",
  };
  const repeatedFailureSignals = messages.filter(
    message =>
      message.role === "user" &&
      /\b(?:still|again|same|already tried|did not work|didn't work|not working|failed again|ancora|già provato|non ha funzionato|stesso errore)\b/i.test(
        message.content
      )
  ).length;
  const guidedOutput = guidedPricingSupport(messages, locale);
  const output =
    guidedOutput ||
    (
      await chatJson(
        env,
        aiUser,
        "support-assistance",
        SUPPORT_SYSTEM_PROMPT,
        {
          locale,
          repeatedFailureSignals,
          authenticatedUser: Boolean(user),
          messages,
          supportEmail: SUPPORT_EMAIL,
        },
        env.OPENROUTER_TEXT_MODEL || "moonshotai/kimi-k2.5",
        false
      )
    ).output;
  const reply = stringValue(output.reply).trim().slice(0, 5000);
  const actions = supportActions(output.suggestedActions);
  const draftValue = recordValue(output.ticketDraft);
  const draftCandidate = draftValue
    ? {
        category: supportCategory(draftValue.category),
        priority: supportPriority(draftValue.priority),
        subject: stringValue(draftValue.subject).trim().slice(0, 180),
        description: stringValue(draftValue.description).trim().slice(0, 8000),
      }
    : null;
  const ticketDraft =
    draftCandidate &&
    draftCandidate.subject.length >= 4 &&
    draftCandidate.description.length >= 10
      ? draftCandidate
      : null;
  const autoCreateTicket = Boolean(
    user &&
    ticketDraft &&
    explicitlyRequestsTicket(latest.content) &&
    ticketDraft.subject.length >= 4 &&
    ticketDraft.description.length >= 10
  );
  let ticket: Awaited<ReturnType<typeof createSupportTicket>> | null = null;
  if (
    autoCreateTicket &&
    request.headers.get("x-support-ticket-owner") !== "vercel"
  ) {
    ticket = await createSupportTicket(env, user, {
      ...ticketDraft,
      conversation: messages,
    });
  }
  return json({
    reply:
      reply ||
      `I could not complete that answer. Try once more or email ${SUPPORT_EMAIL}.`,
    resolved: output.resolved === true,
    needsHuman: output.needsHuman === true,
    suggestedActions: actions,
    ticketDraft: ticket ? null : ticketDraft,
    ticket,
    autoCreateTicket: autoCreateTicket && !ticket,
    supportEmail: SUPPORT_EMAIL,
  });
}

const TREND_PLATFORMS = new Set<TrendPlatform>([
  "tiktok",
  "instagram",
  "youtube",
]);
const TREND_LIFECYCLES = new Set<TrendLifecycle>([
  "seed",
  "emerging",
  "breakout",
  "mainstream",
  "saturated",
  "decaying",
]);
const TREND_CONTENT_TYPES = new Set<TrendContentType>([
  "overall",
  "creator-led",
  "product-demo",
  "educational",
  "faceless",
  "ugc",
  "storytelling",
]);
const TREND_OBJECTIVES = new Set<TrendObjective>([
  "overall",
  "reach",
  "engagement",
  "retention",
  "conversion",
]);

interface TrendSnapshotRow {
  payload_json: string;
  generated_at: string;
  expires_at: string;
}

function trendPlatform(value: unknown): "all" | TrendPlatform {
  const normalized = stringValue(value, "all").toLowerCase();
  return TREND_PLATFORMS.has(normalized as TrendPlatform)
    ? (normalized as TrendPlatform)
    : "all";
}

function trendContentType(value: unknown): TrendContentType {
  const normalized = stringValue(value, "overall").toLowerCase();
  return TREND_CONTENT_TYPES.has(normalized as TrendContentType)
    ? (normalized as TrendContentType)
    : "overall";
}

function trendObjective(value: unknown): TrendObjective {
  const normalized = stringValue(value, "overall").toLowerCase();
  return TREND_OBJECTIVES.has(normalized as TrendObjective)
    ? (normalized as TrendObjective)
    : "overall";
}

function cleanTrendScope(value: unknown, fallbackLanguage = "en"): TrendScope {
  const record = recordValue(value) || {};
  return {
    query: stringValue(record.query, "short-form content").slice(0, 140),
    platform: trendPlatform(record.platform),
    contentType: trendContentType(record.contentType),
    objective: trendObjective(record.objective),
    region: stringValue(record.region, "Global").slice(0, 60),
    language: stringValue(record.language, fallbackLanguage).slice(0, 32),
  };
}

export function normalizeTrendSource(
  value: unknown
): { platform: TrendPlatform; sourceUrl: string } | null {
  const rawCandidate = stringValue(value);
  const candidate =
    rawCandidate.match(/https:\/\/[^\s\])}"']+/i)?.[0] || rawCandidate;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const tiktokVideo = url.pathname.match(/^\/@([^/]+)\/video\/(\d+)\/?$/);
    if (
      (host === "tiktok.com" || host.endsWith(".tiktok.com")) &&
      tiktokVideo
    ) {
      return {
        platform: "tiktok",
        sourceUrl: `https://www.tiktok.com/@${tiktokVideo[1]}/video/${tiktokVideo[2]}`,
      };
    }
    if (
      (host === "vt.tiktok.com" || host === "vm.tiktok.com") &&
      /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
    ) {
      return {
        platform: "tiktok",
        sourceUrl: `https://${host}${url.pathname}`,
      };
    }
    const instagramReel = url.pathname.match(/^\/reels?\/([A-Za-z0-9_-]+)\/?$/);
    if (
      (host === "instagram.com" || host.endsWith(".instagram.com")) &&
      instagramReel
    ) {
      return {
        platform: "instagram",
        sourceUrl: `https://www.instagram.com/reel/${instagramReel[1]}/`,
      };
    }
    const youtubeShort = url.pathname.match(
      /^\/shorts\/([A-Za-z0-9_-]{6,})\/?$/
    );
    if (
      (host === "youtube.com" || host.endsWith(".youtube.com")) &&
      youtubeShort
    ) {
      return {
        platform: "youtube",
        sourceUrl: `https://www.youtube.com/shorts/${youtubeShort[1]}`,
      };
    }
  } catch {
    return null;
  }
  return null;
}

interface TrendSearchCitation {
  platform: TrendPlatform;
  sourceUrl: string;
  title: string;
  content: string;
}

export function trendSearchCitations(payload: unknown): TrendSearchCitation[] {
  const root = recordValue(payload);
  const choices = Array.isArray(root?.choices) ? root.choices : [];
  const choice = recordValue(choices[0]);
  const message = recordValue(choice?.message);
  const annotations = Array.isArray(message?.annotations)
    ? message.annotations
    : [];
  const citations: TrendSearchCitation[] = [];
  const seen = new Set<string>();
  for (const annotationValue of annotations) {
    const annotation = recordValue(annotationValue);
    const citation = recordValue(annotation?.url_citation);
    const source = normalizeTrendSource(citation?.url);
    if (!source || seen.has(source.sourceUrl)) continue;
    seen.add(source.sourceUrl);
    citations.push({
      ...source,
      title: stringValue(citation?.title).slice(0, 180),
      content: stringValue(citation?.content).slice(0, 900),
    });
  }
  return citations;
}

export function trendTextCitations(payload: unknown): TrendSearchCitation[] {
  const content = extractTextContent(payload);
  const citations: TrendSearchCitation[] = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(/https:\/\/[^\s\])}"']+/gi)) {
    const source = normalizeTrendSource(match[0]);
    if (!source || seen.has(source.sourceUrl)) continue;
    seen.add(source.sourceUrl);
    citations.push({
      ...source,
      title: "Source video",
      content: "Direct video URL returned in the grounded research notes.",
    });
  }
  return citations;
}

async function verifyTrendCitation(
  citation: TrendSearchCitation
): Promise<TrendSearchCitation | null> {
  let verificationUrl = citation.sourceUrl;
  if (citation.platform === "youtube") {
    verificationUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(citation.sourceUrl)}`;
  } else if (citation.platform === "tiktok") {
    verificationUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(citation.sourceUrl)}`;
  } else {
    const code = new URL(citation.sourceUrl).pathname.match(
      /^\/reel\/([A-Za-z0-9_-]+)\/?$/
    )?.[1];
    if (!code) return null;
    verificationUrl = `https://www.instagram.com/reel/${code}/embed/`;
  }
  try {
    const response = await fetch(verificationUrl, {
      method: "GET",
      headers: {
        Accept: "application/json,text/html;q=0.9",
        "User-Agent": "REELassati-Trend-Verifier/1.0",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    await response.body?.cancel().catch(() => undefined);
    return response.ok ? citation : null;
  } catch {
    return null;
  }
}

export function groundTrendOutput(
  value: unknown,
  citations: TrendSearchCitation[]
): Record<string, unknown> {
  const root = recordValue(value);
  const candidates = Array.isArray(root?.trends) ? root.trends : [];
  const allowedSources = new Map(
    citations.map(citation => [citation.sourceUrl, citation] as const)
  );
  const trends: Record<string, unknown>[] = [];
  for (const candidateValue of candidates) {
    const candidate = recordValue(candidateValue);
    if (!candidate) continue;
    const candidateSource = normalizeTrendSource(
      candidate.sourceUrl || candidate.url
    );
    const citation = candidateSource
      ? allowedSources.get(candidateSource.sourceUrl)
      : undefined;
    if (!citation) continue;
    const creatorFromUrl =
      citation.platform === "tiktok"
        ? new URL(citation.sourceUrl).pathname.match(/^\/@([^/]+)/)?.[1] || ""
        : "";
    trends.push({
      ...candidate,
      platform: citation.platform,
      sourceUrl: citation.sourceUrl,
      title: stringValue(candidate.title).slice(0, 160),
      creator: stringValue(
        candidate.creator || candidate.author || candidate.channel,
        creatorFromUrl
      ).slice(0, 100),
    });
  }
  return { trends };
}

function nullableTrendMetric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function trendViralityScore(metrics: TrendEvidenceItem["metrics"]): number {
  return Math.max(
    metrics.views || 0,
    (metrics.likes || 0) * 10,
    (metrics.comments || 0) * 100,
    (metrics.shares || 0) * 50
  );
}

function hasHyperviralSignal(metrics: TrendEvidenceItem["metrics"]): boolean {
  return (
    (metrics.views || 0) >= TREND_MIN_VIEWS ||
    (metrics.likes || 0) >= TREND_MIN_LIKES ||
    (metrics.comments || 0) >= TREND_MIN_COMMENTS ||
    (metrics.shares || 0) >= TREND_MIN_SHARES
  );
}

export function normalizeTrendItems(
  value: unknown,
  observedAt: string,
  mode: "weekly" | "custom" = "weekly"
): TrendEvidenceItem[] {
  const root = recordValue(value);
  const candidates = Array.isArray(root?.trends) ? root.trends : [];
  const seen = new Set<string>();
  const trends: TrendEvidenceItem[] = [];
  for (const candidateValue of candidates) {
    const candidate = recordValue(candidateValue);
    if (!candidate) continue;
    const source = normalizeTrendSource(candidate.sourceUrl || candidate.url);
    if (!source || seen.has(source.sourceUrl)) continue;
    const { platform: detectedPlatform, sourceUrl } = source;
    const claimedPlatform = trendPlatform(candidate.platform);
    if (claimedPlatform !== "all" && claimedPlatform !== detectedPlatform) {
      continue;
    }
    const title = stringValue(candidate.title).slice(0, 160);
    const creator = stringValue(candidate.creator).slice(0, 100);
    const hook = stringValue(candidate.hook).slice(0, 280);
    const pattern = stringValue(candidate.pattern).slice(0, 280);
    const hypothesis = stringValue(candidate.hypothesis).slice(0, 500);
    const adaptation = stringValue(candidate.adaptation).slice(0, 500);
    const passSignal = stringValue(candidate.passSignal).slice(0, 300);
    const brandName = stringValue(candidate.brandName).slice(0, 100);
    const organicEvidence = stringValue(candidate.organicEvidence).slice(
      0,
      300
    );
    const viralityEvidence = stringValue(candidate.viralityEvidence).slice(
      0,
      300
    );
    if (
      !title ||
      !creator ||
      !brandName ||
      !hook ||
      !pattern ||
      !organicEvidence ||
      !viralityEvidence ||
      !hypothesis ||
      !adaptation ||
      !passSignal ||
      candidate.organicBrandPromotion !== true ||
      candidate.paidAd !== false
    ) {
      continue;
    }
    const lifecycleValue = stringValue(candidate.lifecycle).toLowerCase();
    const lifecycle = TREND_LIFECYCLES.has(lifecycleValue as TrendLifecycle)
      ? (lifecycleValue as TrendLifecycle)
      : "emerging";
    const metrics = recordValue(candidate.metrics) || {};
    const evidence = Array.isArray(candidate.evidence)
      ? candidate.evidence
          .map(item => stringValue(item).slice(0, 260))
          .filter(Boolean)
          .slice(0, 4)
      : [];
    if (!evidence.length) continue;
    const thumbnailCandidate = stringValue(candidate.thumbnailUrl);
    const thumbnailUrl = isPublicHttpsUrl(thumbnailCandidate)
      ? thumbnailCandidate
      : null;
    const publishedCandidate = stringValue(candidate.publishedAt);
    const publishedTimestamp = Date.parse(publishedCandidate);
    const observedTimestamp = Date.parse(observedAt);
    const publishedAt = Number.isFinite(publishedTimestamp)
      ? new Date(publishedTimestamp).toISOString()
      : null;
    const confidence = boundedNumber(candidate.confidence, 0.55, 0.15, 0.95);
    const normalizedMetrics = {
      views: nullableTrendMetric(metrics.views),
      likes: nullableTrendMetric(metrics.likes),
      comments: nullableTrendMetric(metrics.comments),
      shares: nullableTrendMetric(metrics.shares),
    };
    const explicitPaidSignal =
      /(?:#ad\b|paid partnership|paid placement|sponsored (?:post|content)|advertisement|ad library)/i.test(
        `${title} ${organicEvidence} ${evidence.join(" ")}`
      );
    if (
      !publishedAt ||
      !Number.isFinite(observedTimestamp) ||
      publishedTimestamp > observedTimestamp + 6 * 60 * 60 * 1000 ||
      observedTimestamp - publishedTimestamp > TREND_MAX_AGE_MS ||
      confidence < 0.7 ||
      explicitPaidSignal ||
      !hasHyperviralSignal(normalizedMetrics) ||
      (mode === "weekly" && detectedPlatform === "youtube")
    ) {
      continue;
    }
    seen.add(sourceUrl);
    trends.push({
      id: `trend_${crypto.randomUUID()}`,
      platform: detectedPlatform,
      title,
      creator,
      brandName,
      sourceUrl,
      thumbnailUrl,
      publishedAt,
      observedAt,
      niche: stringValue(candidate.niche, "General").slice(0, 80),
      region: stringValue(candidate.region, "Global").slice(0, 60),
      language: stringValue(candidate.language, "Unknown").slice(0, 32),
      hook,
      pattern,
      lifecycle,
      confidence,
      metrics: normalizedMetrics,
      evidence,
      organicEvidence,
      viralityEvidence,
      hypothesis,
      adaptation,
      passSignal,
    });
    if (trends.length >= 12) break;
  }
  return trends.sort(
    (left, right) =>
      trendViralityScore(right.metrics) - trendViralityScore(left.metrics)
  );
}

async function trendAvailableCredits(
  env: SitesEnvironment,
  user: AuthenticatedUser
): Promise<number> {
  return availableCredits(env, user);
}

async function researchTrendSources(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  scope: TrendScope,
  mode: "weekly" | "custom"
): Promise<{ trends: TrendEvidenceItem[]; generatedAt: string }> {
  if (!env.OPENROUTER_API_KEY) {
    throw new Response(
      JSON.stringify({
        error: "Live trend research is temporarily unavailable",
        missing: ["OPENROUTER_API_KEY"],
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
  const generatedAt = new Date().toISOString();
  const selectedModel = env.OPENROUTER_TREND_MODEL || "moonshotai/kimi-k2.5";
  const invocation = await beginAiInvocation(
    env,
    user,
    "trend-research",
    "OpenRouter",
    selectedModel,
    { mode, scope }
  );
  let failureCode = "provider_or_validation_failure";
  try {
    const platformInstruction =
      scope.platform === "all"
        ? "TikTok and Instagram Reels"
        : scope.platform === "youtube"
          ? "YouTube Shorts"
          : scope.platform === "instagram"
            ? "Instagram Reels"
            : "TikTok";
    const contentTypeInstruction =
      scope.contentType === "overall"
        ? "all relevant short-form content types"
        : scope.contentType;
    const objectiveInstruction =
      scope.objective === "overall"
        ? "overall demonstrated performance"
        : scope.objective;
    const taskInstruction =
      mode === "weekly"
        ? `Use the web search tool before answering. Find the most viral individual organic brand-promotion shorts published between ${new Date(Date.parse(generatedAt) - 7 * 86_400_000).toISOString()} and ${generatedAt} on ${platformInstruction}. These must be real posts where a brand, product, or service is central to the content, but the post itself is native organic content rather than a paid ad. Rank the strongest verified pieces by reported views and engagement. Return fewer results instead of adding a weak, generic, stale, or unverified example.`
        : `Use the web search tool before answering. Find the most viral individual organic brand-promotion shorts published between ${new Date(Date.parse(generatedAt) - 7 * 86_400_000).toISOString()} and ${generatedAt} that answer this paid custom brief. Platform: ${platformInstruction}. Topic, niche, product, or audience: "${scope.query}". Content type: ${contentTypeInstruction}. Primary objective: ${objectiveInstruction}. Audience region: ${scope.region}. Content language: ${scope.language}. The brand, product, or service must be central, while the post must be native organic content rather than a paid ad. Rank by verified views and engagement and return fewer results instead of filler.`;
    failureCode = "search_request_failure";
    const searchPlatforms: TrendPlatform[] =
      scope.platform === "all" ? ["tiktok", "instagram"] : [scope.platform];
    const directUrlInstructions: Record<TrendPlatform, string> = {
      tiktok:
        "TikTok only. Find several individual pages shaped like tiktok.com/@creator/video/ID.",
      instagram:
        "Instagram only. Find several individual Reels shaped like instagram.com/reel/CODE.",
      youtube:
        "YouTube only. Find several individual Shorts shaped like youtube.com/shorts/ID.",
    };
    const searchDomains: Record<TrendPlatform, string[]> = {
      tiktok: ["tiktok.com"],
      instagram: ["instagram.com"],
      youtube: ["youtube.com"],
    };
    const searchResults = await Promise.allSettled(
      searchPlatforms.map(async searchPlatform => {
        const searchResponse = await fetch(
          `${OPENROUTER_BASE}/chat/completions`,
          {
            method: "POST",
            headers: openRouterHeaders(env),
            body: JSON.stringify({
              model: selectedModel,
              messages: [
                {
                  role: "system",
                  content: `You are REELassati's strict evidence-first researcher for hyperviral organic brand shorts. You must use the provided web search tool before answering. ${directUrlInstructions[searchPlatform]} Never return search pages, profiles, articles, compilations, long-form videos, paid ads, boosted ad creatives, affiliate placements, sponsored posts, gifted collaborations, or generic entertainment with no central brand promotion. A qualifying result is one individual vertical short published in the stated seven-day window where a brand, product, or service is central and the post is either a normal brand-owned social post or clearly earned organic creator content. It must have a reported hyperviral signal: at least 500000 views, 50000 likes, 5000 comments, or 10000 shares. Never invent URLs, creators, brands, dates, metrics, organic status, or evidence. Omit any candidate whose direct URL, exact publication date, brand, organic status, or performance cannot be supported by the search results. Return fewer items rather than filler. Keep observations separate from hypotheses. Return JSON only with one key, trends. Each trend needs: platform, title, creator, brandName, sourceUrl, hook, pattern, evidence as an array, organicBrandPromotion as true, paidAd as false, organicEvidence, viralityEvidence, hypothesis, adaptation, passSignal, lifecycle, confidence, niche, region, language, metrics, thumbnailUrl, and publishedAt. Metrics has views, likes, comments, and shares; use null only for individual unavailable metrics, never for all performance metrics. thumbnailUrl may be null. publishedAt must be an ISO date.`,
                },
                {
                  role: "user",
                  content: `${taskInstruction}\n\nThis search pass is exclusively for ${searchPlatform}. Return at most three concise examples and only exact individual-video URLs copied from the search results. Do not turn a normal YouTube watch URL into a Short.`,
                },
              ],
              plugins: [
                {
                  id: "web",
                  engine: "exa",
                  mode: "fast",
                  max_results: 10,
                  include_domains: searchDomains[searchPlatform],
                },
              ],
              provider: {
                allow_fallbacks: true,
                require_parameters: true,
              },
              reasoning: { enabled: false },
              max_tokens: 2_400,
              temperature: 0.1,
            }),
            signal: AbortSignal.timeout(90_000),
          }
        );
        if (!searchResponse.ok) {
          failureCode = `search_${searchPlatform}_provider_${searchResponse.status}`;
          await providerError(searchResponse, "OpenRouter");
        }
        return searchResponse.json();
      })
    );
    const searchPayloads = searchResults.flatMap(result =>
      result.status === "fulfilled" ? [result.value] : []
    );
    if (!searchPayloads.length) {
      failureCode = searchResults
        .map((result, index) => {
          const reason = result.status === "rejected" ? result.reason : null;
          const code =
            reason instanceof Response
              ? `http_${reason.status}`
              : reason?.name === "TimeoutError" || reason?.name === "AbortError"
                ? "timeout"
                : "unavailable";
          return `${searchPlatforms[index]}_${code}`;
        })
        .join(";");
      throw json(
        {
          error:
            mode === "weekly"
              ? "The weekly search sources are temporarily unavailable."
              : "The search sources are temporarily unavailable. No credits were used.",
        },
        502
      );
    }
    failureCode = "invalid_search_payload";
    const citationMap = new Map<string, TrendSearchCitation>();
    for (const payload of searchPayloads) {
      for (const citation of [
        ...trendSearchCitations(payload),
        ...trendTextCitations(payload),
      ]) {
        citationMap.set(citation.sourceUrl, citation);
      }
    }
    const citations = (
      await Promise.all(
        Array.from(citationMap.values()).slice(0, 18).map(verifyTrendCitation)
      )
    ).filter((citation): citation is TrendSearchCitation => Boolean(citation));
    if (!citations.length) {
      failureCode = `insufficient_verified_citations_${citations.length}`;
      throw json(
        {
          error:
            mode === "weekly"
              ? "The weekly update could not verify enough current source videos."
              : "The research could not verify enough current source videos. No credits were used.",
        },
        502
      );
    }

    failureCode = "invalid_search_analysis";
    const candidates = searchPayloads.flatMap(payload => {
      try {
        const parsed = parseModelJson(payload);
        return Array.isArray(parsed.trends) ? parsed.trends : [];
      } catch {
        return [];
      }
    });
    const groundedOutput = groundTrendOutput({ trends: candidates }, citations);
    const trends = normalizeTrendItems(
      groundedOutput,
      generatedAt,
      mode
    ).filter(item =>
      scope.platform === "all" ? true : item.platform === scope.platform
    );
    if (!trends.length) {
      failureCode = `insufficient_verified_sources_${trends.length}`;
      throw json(
        {
          error:
            mode === "weekly"
              ? "The weekly update could not verify enough current source videos."
              : "The research could not verify enough current source videos. No credits were used.",
        },
        502
      );
    }
    await completeAiInvocation(env, invocation, {
      scope,
      resultCount: trends.length,
      sourceUrls: trends.map(item => item.sourceUrl),
    });
    return { trends, generatedAt };
  } catch (cause) {
    await failAiInvocation(env, invocation, failureCode);
    if (cause instanceof Response) throw cause;
    throw json(
      {
        error:
          mode === "weekly"
            ? "The weekly trend update could not be completed."
            : "The custom research could not be completed. No credits were used.",
      },
      502
    );
  }
}

function trendResponse(input: {
  trends: TrendEvidenceItem[];
  generatedAt: string;
  nextRefreshAt: string;
  freshness: "live" | "cached";
  kind: "weekly" | "custom";
  status: TrendFeedResponse["status"];
  scope: TrendScope;
  creditCost: number;
  availableCredits: number;
  cacheNote: string;
}): TrendFeedResponse {
  return input;
}

function weeklyTrendScope(): TrendScope {
  return cleanTrendScope({
    query: "hyperviral organic brand promotion",
    platform: "all",
    contentType: "overall",
    objective: "overall",
    region: "Global",
    language: "en",
  });
}

async function latestWeeklyTrendSnapshot(
  env: SitesEnvironment
): Promise<TrendSnapshotRow | null> {
  return env.DB.prepare(
    `
      SELECT payload_json, generated_at, expires_at
      FROM trend_snapshots
      WHERE scope_key = ?
      ORDER BY generated_at DESC
      LIMIT 1
    `
  )
    .bind(TREND_WEEKLY_SCOPE_KEY)
    .first<TrendSnapshotRow>();
}

async function refreshWeeklyTrendFeed(env: SitesEnvironment): Promise<{
  refreshed: boolean;
  reason?: "current" | "in_progress";
  generatedAt?: string;
  nextRefreshAt?: string;
  resultCount?: number;
}> {
  await initializeSchema(env);
  const now = new Date();
  const nowIso = now.toISOString();
  const current = await latestWeeklyTrendSnapshot(env);
  if (current && Date.parse(current.expires_at) > now.getTime()) {
    return {
      refreshed: false,
      reason: "current",
      generatedAt: current.generated_at,
      nextRefreshAt: current.expires_at,
    };
  }

  const leaseExpiresAt = new Date(
    now.getTime() + TREND_REFRESH_LEASE_MS
  ).toISOString();
  const lease = await env.DB.prepare(
    `
      INSERT INTO trend_refresh_state
        (refresh_key, lease_expires_at, last_started_at, last_completed_at, last_error)
      VALUES (?, ?, ?, NULL, NULL)
      ON CONFLICT(refresh_key) DO UPDATE SET
        lease_expires_at = excluded.lease_expires_at,
        last_started_at = excluded.last_started_at,
        last_error = NULL
      WHERE trend_refresh_state.lease_expires_at <= ?
    `
  )
    .bind(TREND_WEEKLY_SCOPE_KEY, leaseExpiresAt, nowIso, nowIso)
    .run();
  if ((lease.meta?.changes || 0) !== 1) {
    return { refreshed: false, reason: "in_progress" };
  }

  try {
    const result = await researchTrendSources(
      env,
      TREND_SYSTEM_OWNER,
      weeklyTrendScope(),
      "weekly"
    );
    const nextRefreshAt = new Date(
      Date.parse(result.generatedAt) + TREND_WEEKLY_TTL_MS
    ).toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `
          INSERT INTO trend_snapshots
            (id, scope_key, payload_json, generated_at, expires_at)
          VALUES (?, ?, ?, ?, ?)
        `
      ).bind(
        crypto.randomUUID(),
        TREND_WEEKLY_SCOPE_KEY,
        JSON.stringify(result.trends),
        result.generatedAt,
        nextRefreshAt
      ),
      env.DB.prepare(
        `
          UPDATE trend_refresh_state
          SET lease_expires_at = ?, last_completed_at = ?, last_error = NULL
          WHERE refresh_key = ?
        `
      ).bind(result.generatedAt, result.generatedAt, TREND_WEEKLY_SCOPE_KEY),
      env.DB.prepare(
        `
          DELETE FROM trend_snapshots
          WHERE scope_key = ? AND generated_at < ?
        `
      ).bind(
        TREND_WEEKLY_SCOPE_KEY,
        new Date(Date.parse(result.generatedAt) - 56 * 86_400_000).toISOString()
      ),
    ]);
    return {
      refreshed: true,
      generatedAt: result.generatedAt,
      nextRefreshAt,
      resultCount: result.trends.length,
    };
  } catch (cause) {
    const failedAt = new Date().toISOString();
    const failure = await env.DB.prepare(
      "SELECT error_code FROM ai_invocations WHERE owner_email = ? AND purpose = 'trend-research' AND created_at >= ? ORDER BY created_at DESC LIMIT 1"
    )
      .bind(TREND_SYSTEM_OWNER.email, nowIso)
      .first<{ error_code: string | null }>()
      .catch(() => null);
    await env.DB.prepare(
      `
        UPDATE trend_refresh_state
        SET lease_expires_at = ?, last_error = ?
        WHERE refresh_key = ?
      `
    )
      .bind(
        failedAt,
        failure?.error_code || "provider_or_validation_failure",
        TREND_WEEKLY_SCOPE_KEY
      )
      .run()
      .catch(() => undefined);
    throw cause;
  }
}

async function handleWeeklyTrendRefresh(
  request: Request,
  env: SitesEnvironment
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!token) return errorResponse("Unauthorized", 401);
  try {
    const issuer = stringValue(decodeJwt(token).iss);
    if (!VERCEL_TREND_ISSUERS.has(issuer)) {
      return errorResponse("Unauthorized", 401);
    }
    let jwks = vercelTrendJwks.get(issuer);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));
      vercelTrendJwks.set(issuer, jwks);
    }
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: `https://vercel.com/${VERCEL_TREND_TEAM_SLUG}`,
      subject: `owner:${VERCEL_TREND_TEAM_SLUG}:project:reelassati:environment:production`,
    });
    if (
      payload.project_id !== VERCEL_TREND_PROJECT_ID ||
      payload.environment !== "production"
    ) {
      return errorResponse("Unauthorized", 401);
    }
  } catch {
    return errorResponse("Unauthorized", 401);
  }
  try {
    const result = await refreshWeeklyTrendFeed(env);
    return json(result, result.reason === "in_progress" ? 202 : 200);
  } catch (cause) {
    if (cause instanceof Response) return cause;
    return errorResponse("The weekly trend update could not be completed", 502);
  }
}

async function saveTrendResearchRun(
  env: SitesEnvironment,
  user: AuthenticatedUser,
  scopeJson: string,
  queryHash: string,
  creditCost: number,
  trends: TrendEvidenceItem[],
  createdAt: string
): Promise<string> {
  const id = crypto.randomUUID();
  const saved = await env.DB.prepare(
    `
      INSERT INTO trend_research_runs
        (id, owner_email, query_hash, scope_json, payload_json, credit_cost, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(
      id,
      user.email,
      queryHash,
      scopeJson,
      JSON.stringify(trends),
      creditCost,
      createdAt
    )
    .run();
  if ((saved.meta?.changes || 0) !== 1) {
    throw errorResponse(
      "The custom research could not be saved. No credits were used.",
      500
    );
  }
  return id;
}

async function handleTrends(
  request: Request,
  env: SitesEnvironment,
  user: AuthenticatedUser
): Promise<Response> {
  await initializeSchema(env);
  const workspace = await getWorkspace(env, user);
  const language = stringValue(workspace.profile.contentLanguage, "en");
  const availableCredits = await trendAvailableCredits(env, user);

  if (request.method === "GET") {
    const scope = weeklyTrendScope();
    const cached = await latestWeeklyTrendSnapshot(env);
    if (cached) {
      try {
        const trends = JSON.parse(cached.payload_json) as TrendEvidenceItem[];
        return json(
          trendResponse({
            trends,
            generatedAt: cached.generated_at,
            nextRefreshAt: cached.expires_at,
            freshness: "cached",
            kind: "weekly",
            status: weeklyTrendFeedStatus(cached.expires_at, null),
            scope,
            creditCost: 0,
            availableCredits,
            cacheNote:
              "Curated automatically from hyperviral organic TikToks and Reels.",
          })
        );
      } catch {
        // A malformed weekly snapshot never triggers user-initiated research.
      }
    }
    const refresh = await env.DB.prepare(
      "SELECT lease_expires_at FROM trend_refresh_state WHERE refresh_key = ?"
    )
      .bind(TREND_WEEKLY_SCOPE_KEY)
      .first<{ lease_expires_at: string }>();
    return json(
      trendResponse({
        trends: [],
        generatedAt: "",
        nextRefreshAt: new Date().toISOString(),
        freshness: "cached",
        kind: "weekly",
        status: weeklyTrendFeedStatus(null, refresh?.lease_expires_at || null),
        scope,
        creditCost: 0,
        availableCredits,
        cacheNote: "The weekly update runs internally.",
      })
    );
  }

  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }
  const body = await parseJsonBody<{ scope?: unknown }>(request);
  const scope = cleanTrendScope(body.scope, language);
  if (scope.query.length < 2) {
    return errorResponse("Describe a niche, topic, product, or audience first");
  }
  const scopeJson = JSON.stringify(scope);
  const queryHash = await sha256Hex(scopeJson);
  const creditCost = customTrendResearchCreditCost(scope.platform);
  let reservation: CreditReservation;
  try {
    reservation = await requireCreditReservation(env, user, {
      cost: creditCost,
      operationKey: `trend:${crypto.randomUUID()}`,
      category: "trend-research",
      description: "Custom trend research",
      metadata: { scope },
    });
  } catch (cause) {
    if (cause instanceof Response) return cause;
    throw cause;
  }
  let result: Awaited<ReturnType<typeof researchTrendSources>>;
  let runId = "";
  try {
    result = await researchTrendSources(env, user, scope, "custom");
    runId = await saveTrendResearchRun(
      env,
      user,
      scopeJson,
      queryHash,
      creditCost,
      result.trends,
      result.generatedAt
    );
    await settleCreditReservation(env, reservation);
  } catch (cause) {
    if (runId) {
      await env.DB.prepare(
        "DELETE FROM trend_research_runs WHERE id = ? AND owner_email = ?"
      )
        .bind(runId, user.email)
        .run()
        .catch(() => undefined);
    }
    await releaseCreditReservation(env, reservation).catch(() => undefined);
    if (cause instanceof Response) return cause;
    return errorResponse(
      "The custom research could not be completed. No credits were used.",
      502
    );
  }
  return json(
    trendResponse({
      trends: result.trends,
      generatedAt: result.generatedAt,
      nextRefreshAt: result.generatedAt,
      freshness: "live",
      kind: "custom",
      status: "ready",
      scope,
      creditCost,
      availableCredits: await trendAvailableCredits(env, user),
      cacheNote: `${creditCost} credits used for this completed custom research.`,
    })
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

  if (url.pathname === "/api/localization" && request.method === "GET") {
    const country =
      request.headers.get("cf-ipcountry")?.trim().toUpperCase() ||
      request.headers.get("x-vercel-ip-country")?.trim().toUpperCase() ||
      request.headers.get("cloudfront-viewer-country")?.trim().toUpperCase() ||
      request.headers.get("x-country-code")?.trim().toUpperCase() ||
      (request as Request & { cf?: { country?: string } }).cf?.country
        ?.trim()
        .toUpperCase() ||
      null;
    return json({ country });
  }

  if (url.pathname === "/api/publishing/callback" && request.method === "GET") {
    const platform =
      knownPlatform(url.searchParams.get("platform")) || "account";
    return Response.redirect(
      `https://www.reelassati.app/#/dashboard/social?connected=${encodeURIComponent(platform)}`,
      302
    );
  }
  if (url.pathname === "/api/internal/maintenance")
    return handleMaintenance(request, env);
  if (url.pathname === "/api/internal/trends/weekly") {
    return handleWeeklyTrendRefresh(request, env);
  }

  if (url.pathname.startsWith("/api/support/")) {
    return handleSupport(request, env, url);
  }

  if (url.pathname === "/api/video/webhook") {
    return handleVideoWebhook(request, env, url);
  }

  if (url.pathname.startsWith("/api/video/reference/")) {
    return handleVideoReference(request, env, url);
  }

  if (url.pathname === "/api/referrals/billing-webhook") {
    return handleReferralBillingWebhook(request, env);
  }

  if (url.pathname === "/api/billing/stripe-webhook") {
    return handleStripeWebhook(request, env);
  }

  if (url.pathname.startsWith("/api/provenance/")) {
    return handlePublicProvenance(request, env, url);
  }

  if (url.pathname.startsWith("/api/media/")) {
    await initializeSchema(env);
    return handleSignedMedia(request, env, url);
  }
  const user = await getUser(request, env);
  if (!user) {
    return errorResponse("Sign in to access this workspace", 401);
  }

  await initializeSchema(env);
  const requestedBrand = request.headers.get("x-reelassati-brand") || "default";
  if (requestedBrand !== "default") {
    const brand = await env.DB.prepare(
      "SELECT id FROM brand_workspaces WHERE id = ? AND owner_email = ?"
    )
      .bind(requestedBrand, user.email)
      .first();
    if (!brand) return errorResponse("Brand workspace not found", 404);
    user.brandId = requestedBrand;
  }
  if (url.pathname === "/api/brands") return handleBrands(request, env, user);
  if (url.pathname === "/api/operations")
    return handleOperations(request, env, user);
  if (url.pathname === "/api/account/data")
    return handleAccountData(request, env, user);
  if (url.pathname === "/api/voice-preview")
    return handleVoicePreview(request, env);
  if (url.pathname === "/api/analytics/social")
    return handleSocialAnalytics(request, env, user);

  if (
    (url.pathname === "/api/session" || url.pathname === "/api/auth/me") &&
    request.method === "GET"
  ) {
    return json({
      user: {
        id: user.email,
        email: user.email,
        name: user.name,
        role: "member",
      },
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

  if (url.pathname.startsWith("/api/billing/")) {
    return handleBillingApi(request, env, user, url);
  }

  if (url.pathname.startsWith("/api/compliance/")) {
    return handleCompliance(request, env, user, url);
  }

  if (url.pathname === "/api/trends") {
    try {
      return await handleTrends(request, env, user);
    } catch (cause) {
      if (cause instanceof Response) throw cause;
      return errorResponse(
        request.method === "POST"
          ? "Custom trend research is temporarily unavailable. No credits were used."
          : "The weekly trend update is temporarily unavailable.",
        503
      );
    }
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

const PUBLIC_APP_ORIGINS = new Set([
  "https://reelassati.app",
  "https://www.reelassati.app",
  "https://reelassati.vercel.app",
  "https://reelassati.kevinbiz.chatgpt.site",
]);

function withCors(response: Response, request: Request): Response {
  const origin = request.headers.get("origin");
  const allowed =
    origin &&
    (PUBLIC_APP_ORIGINS.has(origin) ||
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:"));
  if (!allowed) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, X-Reelassati-Brand"
  );
  headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  headers.set("Access-Control-Max-Age", "86400");
  headers.append("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function apiResponse(response: Response, request: Request): Response {
  return withCors(withSecurityHeaders(response), request);
}

export default {
  async fetch(request: Request, env: SitesEnvironment): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") {
        return apiResponse(new Response(null, { status: 204 }), request);
      }
      try {
        return apiResponse(await handleApi(request, env, url), request);
      } catch (cause) {
        if (cause instanceof Response) return apiResponse(cause, request);
        const reference = crypto.randomUUID();
        const user = await getUser(request, env);
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
        return apiResponse(
          json(
            {
              error: "Unexpected server error",
              reference,
            },
            500
          ),
          request
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
  async scheduled(
    _controller: unknown,
    env: SitesEnvironment,
    ctx: { waitUntil(promise: Promise<unknown>): void }
  ): Promise<void> {
    ctx.waitUntil(
      Promise.all([
        refreshWeeklyTrendFeed(env),
        applyAllDueAnnualCreditRenewals(env),
      ]).catch(cause => {
        console.error("Weekly trend refresh failed", {
          errorType: cause instanceof Error ? cause.name : typeof cause,
        });
      })
    );
  },
};
