import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  bigint,
  json,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";

// ═══════════════════════════════════════════════════════════════════════════════
// REELASSATI — PostgreSQL Database Schema (for Supabase)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Enums ────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["admin", "editor", "client"]);
export const subscriptionEnum = pgEnum("subscription", ["free", "pro", "agency"]);
export const platformEnum = pgEnum("platform", [
  "tiktok", "instagram", "youtube", "x", "facebook", "linkedin",
  "pinterest", "snapchat", "spotify", "threads", "reddit", "bluesky",
  "telegram", "discord",
]);
export const statusEnum = pgEnum("status", ["active", "paused", "archived"]);
export const connectionStatusEnum = pgEnum("connection_status", ["connected", "expired", "disconnected"]);
export const contentTypeEnum = pgEnum("content_type", ["video", "script", "image", "audio", "template", "avatar"]);
export const contentStatusEnum = pgEnum("content_status", ["draft", "review", "approved", "scheduled", "published", "archived"]);
export const contentFormatEnum = pgEnum("content_format", ["slideshow", "wall_of_text", "hook_demo", "green_screen", "ugc", "meme", "reel", "short", "carousel", "story"]);
export const scheduleStatusEnum = pgEnum("schedule_status", ["pending", "processing", "published", "failed", "cancelled"]);
export const aiJobTypeEnum = pgEnum("ai_job_type", [
  "script_generate", "video_analyze", "video_edit", "avatar_generate",
  "caption_generate", "image_generate", "voice_synthesize",
]);
export const aiJobStatusEnum = pgEnum("ai_job_status", ["queued", "processing", "completed", "failed"]);

// ── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }),
  googleId: varchar("google_id", { length: 255 }).unique(),
  authProvider: pgEnum("auth_provider", ["local", "google"])("auth_provider").notNull().default("local"),
  avatar: varchar("avatar", { length: 500 }),
  role: roleEnum("role").notNull().default("editor"),
  subscription: subscriptionEnum("subscription").notNull().default("free"),
  credits: integer("credits").notNull().default(100),
  language: varchar("language", { length: 10 }).default("en"),
  timezone: varchar("timezone", { length: 50 }).default("Europe/Rome"),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Clients ──────────────────────────────────────────────────────────────────
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  brand: varchar("brand", { length: 255 }),
  niche: varchar("niche", { length: 255 }),
  targetAudience: varchar("target_audience", { length: 500 }),
  brandVoice: text("brand_voice"),
  guidelines: text("guidelines"),
  logo: varchar("logo", { length: 500 }),
  primaryColor: varchar("primary_color", { length: 50 }),
  secondaryColor: varchar("secondary_color", { length: 50 }),
  fonts: varchar("fonts", { length: 255 }),
  status: statusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Platform Connections ─────────────────────────────────────────────────────
export const platformConnections = pgTable("platform_connections", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  clientId: bigint("client_id", { mode: "number" }),
  platform: platformEnum("platform").notNull(),
  accountName: varchar("account_name", { length: 255 }),
  accountHandle: varchar("account_handle", { length: 255 }),
  avatarUrl: varchar("avatar_url", { length: 1000 }),
  zernioAccountId: varchar("zernio_account_id", { length: 255 }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  followers: integer("followers").default(0),
  status: connectionStatusEnum("status").notNull().default("disconnected"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Content Library ──────────────────────────────────────────────────────────
export const contentLibrary = pgTable("content_library", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  clientId: bigint("client_id", { mode: "number" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: contentTypeEnum("type").notNull(),
  url: varchar("url", { length: 1000 }),
  thumbnail: varchar("thumbnail", { length: 1000 }),
  tags: json("tags"),
  format: contentFormatEnum("format"),
  duration: integer("duration"),
  status: contentStatusEnum("status").notNull().default("draft"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Scripts ──────────────────────────────────────────────────────────────────
export const scripts = pgTable("scripts", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  clientId: bigint("client_id", { mode: "number" }),
  title: varchar("title", { length: 255 }).notNull(),
  hook: text("hook"),
  body: text("body"),
  cta: text("cta"),
  fullScript: text("full_script"),
  targetPlatform: platformEnum("target_platform"),
  tone: varchar("tone", { length: 50 }),
  duration: integer("duration"),
  language: varchar("language", { length: 10 }),
  hookScore: integer("hook_score"),
  aiGenerated: boolean("ai_generated").default(false),
  status: pgEnum("script_status", ["draft", "review", "approved", "archived"])("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Templates ────────────────────────────────────────────────────────────────
export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  niche: varchar("niche", { length: 100 }),
  structure: json("structure"),
  bestFor: varchar("best_for", { length: 255 }),
  performance: varchar("performance", { length: 100 }),
  usageCount: integer("usage_count").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Publishing Schedule ──────────────────────────────────────────────────────
export const publishingSchedule = pgTable("publishing_schedule", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  clientId: bigint("client_id", { mode: "number" }),
  contentId: bigint("content_id", { mode: "number" }),
  platform: platformEnum("platform").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  caption: text("caption"),
  hashtags: text("hashtags"),
  mediaUrl: varchar("media_url", { length: 1000 }),
  status: scheduleStatusEnum("status").notNull().default("pending"),
  zernioPostId: varchar("zernio_post_id", { length: 255 }),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Analytics ────────────────────────────────────────────────────────────────
export const analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  clientId: bigint("client_id", { mode: "number" }),
  contentId: bigint("content_id", { mode: "number" }),
  platform: platformEnum("platform").notNull(),
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  shares: integer("shares").default(0),
  impressions: integer("impressions").default(0),
  engagementRate: varchar("engagement_rate", { length: 20 }),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

// ── Trending Content ─────────────────────────────────────────────────────────
export const trendingContent = pgTable("trending_content", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  platform: platformEnum("platform").notNull(),
  niche: varchar("niche", { length: 100 }),
  format: contentFormatEnum("format"),
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  shares: integer("shares").default(0),
  viralScore: integer("viral_score"),
  sourceUrl: varchar("source_url", { length: 1000 }),
  thumbnailUrl: varchar("thumbnail_url", { length: 1000 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── AI Jobs ──────────────────────────────────────────────────────────────────
export const aiJobs = pgTable("ai_jobs", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  clientId: bigint("client_id", { mode: "number" }),
  type: aiJobTypeEnum("type").notNull(),
  status: aiJobStatusEnum("status").notNull().default("queued"),
  input: json("input"),
  output: json("output"),
  creditsUsed: integer("credits_used").default(0),
  errorMessage: text("error_message"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Brand Kits ───────────────────────────────────────────────────────────────
export const brandKits = pgTable("brand_kits", {
  id: serial("id").primaryKey(),
  clientId: bigint("client_id", { mode: "number" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  colors: json("colors"),
  fonts: json("fonts"),
  voiceGuidelines: text("voice_guidelines"),
  visualGuidelines: text("visual_guidelines"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
