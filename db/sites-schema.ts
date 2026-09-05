import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const workspaceState = sqliteTable("workspace_state", {
  ownerEmail: text("owner_email").primaryKey().notNull(),
  document: text("document").notNull(),
  updatedAt: text("updated_at").notNull(),
  revision: integer("revision").notNull().default(0),
});

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey().notNull(),
    ownerEmail: text("owner_email").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    contentType: text("content_type").notNull(),
    bytes: integer("bytes").notNull().default(0),
    r2Key: text("r2_key").notNull().unique(),
    createdAt: text("created_at").notNull(),
  },
  table => [
    index("assets_owner_created_idx").on(table.ownerEmail, table.createdAt),
  ]
);

export const generationJobs = sqliteTable(
  "generation_jobs",
  {
    id: text("id").primaryKey().notNull(),
    ownerEmail: text("owner_email").notNull(),
    providerJobId: text("provider_job_id"),
    projectId: text("project_id"),
    prompt: text("prompt"),
    status: text("status").notNull(),
    progress: integer("progress").notNull().default(0),
    resultAssetId: text("result_asset_id"),
    error: text("error"),
    payload: text("payload").notNull(),
    finalizingAt: text("finalizing_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  table => [
    index("generation_jobs_owner_created_idx").on(
      table.ownerEmail,
      table.createdAt
    ),
  ]
);

export const publishingIntents = sqliteTable(
  "publishing_intents",
  {
    id: text("id").primaryKey().notNull(),
    ownerEmail: text("owner_email").notNull(),
    requestJson: text("request_json").notNull(),
    providerRequest: text("provider_request"),
    providerResponse: text("provider_response"),
    status: text("status").notNull().default("pending"),
    submittingAt: text("submitting_at"),
    error: text("error"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  table => [
    index("publishing_intents_owner_created_idx").on(
      table.ownerEmail,
      table.createdAt
    ),
  ]
);

/** EU-AI-02 — Server-owned provenance. No application delete/update route exists. */
export const aiProvenanceRecords = sqliteTable(
  "ai_provenance_records",
  {
    id: text("id").primaryKey().notNull(),
    publicToken: text("public_token").notNull().unique(),
    ownerEmail: text("owner_email").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    origin: text("origin").notNull(),
    operation: text("operation").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    policyVersion: text("policy_version").notNull(),
    signingKeyId: text("signing_key_id").notNull(),
    markingMethod: text("marking_method").notNull(),
    markingStatus: text("marking_status").notNull(),
    contentSha256: text("content_sha256"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  table => [
    index("ai_provenance_owner_created_idx").on(
      table.ownerEmail,
      table.createdAt
    ),
    uniqueIndex("ai_provenance_owner_entity_unique").on(
      table.ownerEmail,
      table.entityType,
      table.entityId
    ),
    index("ai_provenance_sha256_idx").on(table.contentSha256),
  ]
);

/** EU-AI-03 — Durable trace for every provider-backed AI invocation. */
export const aiInvocations = sqliteTable(
  "ai_invocations",
  {
    id: text("id").primaryKey().notNull(),
    ownerEmail: text("owner_email").notNull(),
    purpose: text("purpose").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    policyVersion: text("policy_version").notNull(),
    inputSha256: text("input_sha256").notNull(),
    outputSha256: text("output_sha256"),
    status: text("status").notNull(),
    errorCode: text("error_code"),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
  },
  table => [
    index("ai_invocations_owner_created_idx").on(
      table.ownerEmail,
      table.createdAt
    ),
  ]
);

/** EU-AI-10 — Append-only evidence events; excludes raw prompts and media. */
export const complianceEvents = sqliteTable(
  "compliance_events",
  {
    id: text("id").primaryKey().notNull(),
    ownerEmail: text("owner_email"),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    policyVersion: text("policy_version").notNull(),
    detailsJson: text("details_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  table => [
    index("compliance_events_owner_created_idx").on(
      table.ownerEmail,
      table.createdAt
    ),
  ]
);

/** EU-AI-11 — Operator facts and Article 4 literacy evidence. */
export const operatorCompliance = sqliteTable("operator_compliance", {
  ownerEmail: text("owner_email").primaryKey().notNull(),
  legalName: text("legal_name"),
  entityType: text("entity_type"),
  releaseStatus: text("release_status"),
  firstEuAvailabilityDate: text("first_eu_availability_date"),
  creativeScopeConfirmedAt: text("creative_scope_confirmed_at"),
  aiLiteracyAcknowledgedAt: text("ai_literacy_acknowledged_at"),
  updatedAt: text("updated_at").notNull(),
});

export const zernioProfiles = sqliteTable("zernio_profiles", {
  ownerEmail: text("owner_email").primaryKey().notNull(),
  profileId: text("profile_id").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const referralCodes = sqliteTable("referral_codes", {
  ownerEmail: text("owner_email").primaryKey().notNull(),
  code: text("code").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const referralClaims = sqliteTable(
  "referral_claims",
  {
    id: text("id").primaryKey().notNull(),
    referralCode: text("referral_code").notNull(),
    referrerEmail: text("referrer_email").notNull(),
    referredEmail: text("referred_email").notNull().unique(),
    status: text("status").notNull().default("pending"),
    creditsAwarded: integer("credits_awarded").notNull().default(0),
    valueCents: integer("value_cents").notNull().default(0),
    qualifiedAt: text("qualified_at"),
    paymentEventId: text("payment_event_id").unique(),
    planId: text("plan_id"),
    createdAt: text("created_at").notNull(),
  },
  table => [
    index("referral_claims_referrer_created_idx").on(
      table.referrerEmail,
      table.createdAt
    ),
  ]
);

export const supportTickets = sqliteTable(
  "support_tickets",
  {
    id: text("id").primaryKey().notNull(),
    requesterEmail: text("requester_email").notNull(),
    requesterName: text("requester_name"),
    authenticatedOwnerEmail: text("authenticated_owner_email"),
    category: text("category").notNull(),
    priority: text("priority").notNull().default("normal"),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    conversationJson: text("conversation_json").notNull().default("[]"),
    aiSummary: text("ai_summary"),
    status: text("status").notNull().default("open"),
    emailStatus: text("email_status").notNull().default("pending"),
    providerMessageId: text("provider_message_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  table => [
    index("support_tickets_email_created_idx").on(
      table.requesterEmail,
      table.createdAt
    ),
    index("support_tickets_status_created_idx").on(
      table.status,
      table.createdAt
    ),
  ]
);

export const supportRateLimits = sqliteTable("support_rate_limits", {
  key: text("key").primaryKey().notNull(),
  requestCount: integer("request_count").notNull().default(0),
  windowStartedAt: text("window_started_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const trendSnapshots = sqliteTable(
  "trend_snapshots",
  {
    id: text("id").primaryKey().notNull(),
    scopeKey: text("scope_key").notNull(),
    payloadJson: text("payload_json").notNull(),
    generatedAt: text("generated_at").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  table => [
    index("trend_snapshots_scope_expires_idx").on(
      table.scopeKey,
      table.expiresAt
    ),
  ]
);

export const trendResearchRuns = sqliteTable(
  "trend_research_runs",
  {
    id: text("id").primaryKey().notNull(),
    ownerEmail: text("owner_email").notNull(),
    queryHash: text("query_hash").notNull(),
    scopeJson: text("scope_json").notNull(),
    payloadJson: text("payload_json").notNull(),
    creditCost: integer("credit_cost").notNull().default(1),
    createdAt: text("created_at").notNull(),
  },
  table => [
    index("trend_research_owner_created_idx").on(
      table.ownerEmail,
      table.createdAt
    ),
    index("trend_research_owner_query_idx").on(
      table.ownerEmail,
      table.queryHash,
      table.createdAt
    ),
  ]
);

export const trendRefreshState = sqliteTable("trend_refresh_state", {
  refreshKey: text("refresh_key").primaryKey().notNull(),
  leaseExpiresAt: text("lease_expires_at").notNull(),
  lastStartedAt: text("last_started_at").notNull(),
  lastCompletedAt: text("last_completed_at"),
  lastError: text("last_error"),
});

export const creditAccounts = sqliteTable("credit_accounts", {
  ownerEmail: text("owner_email").primaryKey().notNull(),
  includedBalance: integer("included_balance").notNull().default(0),
  topupBalance: integer("topup_balance").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const creditLedger = sqliteTable(
  "credit_ledger",
  {
    id: text("id").primaryKey().notNull(),
    ownerEmail: text("owner_email").notNull(),
    amount: integer("amount").notNull(),
    includedAmount: integer("included_amount").notNull().default(0),
    topupAmount: integer("topup_amount").notNull().default(0),
    category: text("category").notNull(),
    status: text("status").notNull(),
    operationKey: text("operation_key").notNull().unique(),
    referenceId: text("reference_id"),
    description: text("description").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    applied: integer("applied").notNull().default(0),
    createdAt: text("created_at").notNull(),
    settledAt: text("settled_at"),
  },
  table => [
    index("credit_ledger_owner_created_idx").on(
      table.ownerEmail,
      table.createdAt
    ),
  ]
);

export const billingAccounts = sqliteTable(
  "billing_accounts",
  {
    ownerEmail: text("owner_email").primaryKey().notNull(),
    stripeCustomerId: text("stripe_customer_id").unique(),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    planId: text("plan_id"),
    billingCycle: text("billing_cycle"),
    status: text("status").notNull().default("inactive"),
    currentPeriodStart: text("current_period_start"),
    currentPeriodEnd: text("current_period_end"),
    nextCreditRenewalAt: text("next_credit_renewal_at"),
    cancelAtPeriodEnd: integer("cancel_at_period_end").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  table => [
    index("billing_accounts_subscription_idx").on(table.stripeSubscriptionId),
  ]
);

export const stripeEvents = sqliteTable("stripe_events", {
  eventId: text("event_id").primaryKey().notNull(),
  eventType: text("event_type").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  processedAt: text("processed_at"),
  error: text("error"),
});
