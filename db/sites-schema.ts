import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const zernioProfiles = sqliteTable("zernio_profiles", {
  ownerEmail: text("owner_email").primaryKey().notNull(),
  profileId: text("profile_id").notNull().unique(),
  createdAt: text("created_at").notNull(),
});
