import {
  mysqlTable,
  serial,
  varchar,
  text,
  timestamp,
  int,
  bigint,
  json,
  boolean,
  mysqlEnum,
} from "drizzle-orm/mysql-core";

// ═══════════════════════════════════════════════════════════════════════════════
// REELASSATI — Complete Database Schema
// ═══════════════════════════════════════════════════════════════════════════════

// ── Users ──
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }), // nullable for OAuth users
  googleId: varchar("google_id", { length: 255 }).unique(),
  authProvider: mysqlEnum("auth_provider", ["local", "google"]).notNull().default("local"),
  avatar: varchar("avatar", { length: 500 }),
  role: mysqlEnum("role", ["admin", "editor", "client"]).notNull().default("editor"),
  subscription: mysqlEnum("subscription", ["free", "pro", "agency"]).notNull().default("free"),
  credits: int("credits").notNull().default(100),
  language: varchar("language", { length: 10 }).default("en"),
  timezone: varchar("timezone", { length: 50 }).default("Europe/Rome"),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Clients ──
export const clients = mysqlTable("clients", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
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
  status: mysqlEnum("status", ["active", "paused", "archived"]).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Platform Connections ──
export const platformConnections = mysqlTable("platform_connections", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  clientId: bigint("client_id", { mode: "number", unsigned: true }),
  platform: mysqlEnum("platform", ["tiktok", "instagram", "youtube", "x", "facebook", "linkedin", "pinterest", "snapchat", "spotify", "threads", "reddit", "bluesky", "telegram", "discord"]).notNull(),
  accountName: varchar("account_name", { length: 255 }),
  accountHandle: varchar("account_handle", { length: 255 }),
  avatarUrl: varchar("avatar_url", { length: 1000 }),
  // Zernio integration: store the Zernio account ID (replaces local token storage)
  zernioAccountId: varchar("zernio_account_id", { length: 255 }),
  // Legacy fields — kept for backward compatibility
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  followers: int("followers").default(0),
  status: mysqlEnum("status", ["connected", "expired", "disconnected"]).notNull().default("disconnected"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Content Library ──
export const contentLibrary = mysqlTable("content_library", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  clientId: bigint("client_id", { mode: "number", unsigned: true }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["video", "script", "image", "audio", "template", "avatar"]).notNull(),
  url: varchar("url", { length: 1000 }),
  thumbnail: varchar("thumbnail", { length: 1000 }),
  tags: json("tags"),
  format: mysqlEnum("format", ["slideshow", "wall_of_text", "hook_demo", "green_screen", "ugc", "meme", "reel", "short", "carousel", "story"]),
  duration: int("duration"),
  status: mysqlEnum("status", ["draft", "review", "approved", "scheduled", "published", "archived"]).notNull().default("draft"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Scripts ──
export const scripts = mysqlTable("scripts", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  clientId: bigint("client_id", { mode: "number", unsigned: true }),
  title: varchar("title", { length: 255 }).notNull(),
  hook: text("hook"),
  body: text("body"),
  cta: text("cta"),
  fullScript: text("full_script"),
  targetPlatform: mysqlEnum("target_platform", ["tiktok", "instagram", "youtube", "x", "facebook", "linkedin"]),
  tone: varchar("tone", { length: 100 }),
  duration: int("duration"),
  language: varchar("language", { length: 10 }).default("en"),
  tags: json("tags"),
  hookScore: int("hook_score"),
  aiGenerated: boolean("ai_generated").default(false),
  parentScriptId: bigint("parent_script_id", { mode: "number", unsigned: true }),
  status: mysqlEnum("status", ["draft", "review", "approved", "archived"]).notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Templates ──
export const templates = mysqlTable("templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["slideshow", "wall_of_text", "hook_demo", "green_screen", "ugc", "meme", "reel", "short"]).notNull(),
  niche: varchar("niche", { length: 255 }),
  thumbnail: varchar("thumbnail", { length: 1000 }),
  structure: json("structure"),
  aiPrompt: text("ai_prompt"),
  usageCount: int("usage_count").default(0),
  avgPerformance: int("avg_performance"),
  isSystem: boolean("is_system").default(false),
  createdBy: bigint("created_by", { mode: "number", unsigned: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Publishing Schedule ──
export const publishingSchedule = mysqlTable("publishing_schedule", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  clientId: bigint("client_id", { mode: "number", unsigned: true }),
  contentId: bigint("content_id", { mode: "number", unsigned: true }).notNull(),
  platform: mysqlEnum("platform", ["tiktok", "instagram", "youtube", "x", "facebook", "linkedin", "pinterest", "snapchat", "spotify"]).notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: mysqlEnum("status", ["pending", "processing", "published", "failed", "cancelled"]).notNull().default("pending"),
  caption: text("caption"),
  hashtags: text("hashtags"),
  thumbnail: varchar("thumbnail", { length: 1000 }),
  publishedUrl: varchar("published_url", { length: 1000 }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Analytics ──
export const analytics = mysqlTable("analytics", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  clientId: bigint("client_id", { mode: "number", unsigned: true }),
  contentId: bigint("content_id", { mode: "number", unsigned: true }),
  platform: mysqlEnum("platform", ["tiktok", "instagram", "youtube", "x", "facebook", "linkedin", "pinterest", "snapchat", "spotify"]).notNull(),
  views: int("views").default(0),
  likes: int("likes").default(0),
  comments: int("comments").default(0),
  shares: int("shares").default(0),
  saves: int("saves").default(0),
  watchTime: int("watch_time").default(0),
  followers: int("followers").default(0),
  engagementRate: varchar("engagement_rate", { length: 20 }),
  clickThroughRate: varchar("ctr", { length: 20 }),
  revenue: int("revenue").default(0),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

// ── Trending Content ──
export const trendingContent = mysqlTable("trending_content", {
  id: serial("id").primaryKey(),
  platform: mysqlEnum("platform", ["tiktok", "instagram", "youtube", "x"]).notNull(),
  sourceUrl: varchar("source_url", { length: 1000 }),
  creator: varchar("creator", { length: 255 }),
  niche: varchar("niche", { length: 255 }),
  format: mysqlEnum("format", ["slideshow", "wall_of_text", "hook_demo", "green_screen", "ugc", "meme", "reel", "short"]),
  hook: text("hook"),
  structure: json("structure"),
  views: int("views").default(0),
  engagementRate: varchar("engagement_rate", { length: 20 }),
  soundId: varchar("sound_id", { length: 255 }),
  soundName: varchar("sound_name", { length: 255 }),
  isActive: boolean("is_active").default(true),
  scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
});

// ── AI Processing Jobs ──
export const aiJobs = mysqlTable("ai_jobs", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  clientId: bigint("client_id", { mode: "number", unsigned: true }),
  type: mysqlEnum("type", ["script_generate", "video_analyze", "video_edit", "avatar_generate", "caption_generate", "image_generate", "voice_synthesize"]).notNull(),
  status: mysqlEnum("status", ["queued", "processing", "completed", "failed"]).notNull().default("queued"),
  input: json("input"),
  output: json("output"),
  creditsUsed: int("credits_used").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// ── Brand Kits ──
export const brandKits = mysqlTable("brand_kits", {
  id: serial("id").primaryKey(),
  clientId: bigint("client_id", { mode: "number", unsigned: true }).notNull(),
  fonts: json("fonts"),
  colors: json("colors"),
  logo: varchar("logo", { length: 1000 }),
  voiceGuidelines: text("voice_guidelines"),
  musicPreferences: json("music_preferences"),
  doNotUse: text("do_not_use"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
