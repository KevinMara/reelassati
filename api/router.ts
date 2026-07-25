import { createRouter, publicQuery } from "./middleware";
import { z } from "zod";
import { getDb } from "./queries/connection";
import {
  users, clients, scripts, contentLibrary, templates,
  publishingSchedule, analytics, trendingContent, aiJobs,
  platformConnections, brandKits,
} from "@db/schema";
import { eq, desc, and, sql, like, inArray } from "drizzle-orm";
import { videoRouter } from "./routers/video";
import { referralRouter } from "./routers/referral";
import { voiceRouter } from "./routers/voice";
import { interviewRouter } from "./routers/interview";
import { goalsRouter } from "./routers/goals";
import { coachingRouter } from "./routers/coaching";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  // ═══════════════════════════════════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════════════════════════════════
  user: createRouter({
    me: publicQuery.query(async ({ ctx }) => {
      if (!ctx.session?.userId) return null;
      const db = getDb();
      const user = await db.select().from(users).where(eq(users.id, Number(ctx.session.userId))).limit(1);
      return user[0] || null;
    }),

    update: publicQuery
      .input(z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        language: z.string().optional(),
        avatar: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) throw new Error("Not authenticated");
        const db = getDb();
        await db.update(users).set(input).where(eq(users.id, Number(ctx.session.userId)));
        return { success: true };
      }),

    stats: publicQuery.query(async ({ ctx }) => {
      if (!ctx.session?.userId) return null;
      const db = getDb();
      const [contentCount, scriptCount, clientCount, publishedCount] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(contentLibrary).where(eq(contentLibrary.userId, Number(ctx.session.userId))),
        db.select({ count: sql<number>`count(*)` }).from(scripts).where(eq(scripts.userId, Number(ctx.session.userId))),
        db.select({ count: sql<number>`count(*)` }).from(clients).where(eq(clients.userId, Number(ctx.session.userId))),
        db.select({ count: sql<number>`count(*)` }).from(publishingSchedule)
          .where(and(
            eq(publishingSchedule.userId, Number(ctx.session.userId)),
            eq(publishingSchedule.status, "published")
          )),
      ]);

      // Get total views
      const viewsData = await db.select({ total: sql<number>`COALESCE(SUM(views), 0)` })
        .from(analytics)
        .where(eq(analytics.userId, Number(ctx.session.userId)));

      return {
        contentCount: contentCount[0]?.count || 0,
        scriptCount: scriptCount[0]?.count || 0,
        clientCount: clientCount[0]?.count || 0,
        publishedCount: publishedCount[0]?.count || 0,
        totalViews: viewsData[0]?.total || 0,
      };
    }),
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENTS
  // ═══════════════════════════════════════════════════════════════════════════
  client: createRouter({
    list: publicQuery.query(async ({ ctx }) => {
      if (!ctx.session?.userId) return [];
      const db = getDb();
      return db.select().from(clients)
        .where(eq(clients.userId, Number(ctx.session.userId)))
        .orderBy(desc(clients.createdAt));
    }),

    get: publicQuery.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
      if (!ctx.session?.userId) return null;
      const db = getDb();
      const result = await db.select().from(clients)
        .where(and(eq(clients.id, input.id), eq(clients.userId, Number(ctx.session.userId))))
        .limit(1);
      return result[0] || null;
    }),

    create: publicQuery
      .input(z.object({
        name: z.string().min(1),
        brand: z.string().optional(),
        niche: z.string().optional(),
        targetAudience: z.string().optional(),
        brandVoice: z.string().optional(),
        guidelines: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) throw new Error("Not authenticated");
        const db = getDb();
        const result = await db.insert(clients).values({
          ...input,
          userId: Number(ctx.session.userId),
        });
        return { id: Number(result[0].insertId), ...input };
      }),

    update: publicQuery
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        brand: z.string().optional(),
        niche: z.string().optional(),
        targetAudience: z.string().optional(),
        brandVoice: z.string().optional(),
        guidelines: z.string().optional(),
        status: z.enum(["active", "paused", "archived"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) throw new Error("Not authenticated");
        const db = getDb();
        const { id, ...data } = input;
        await db.update(clients).set(data).where(eq(clients.id, id));
        return { success: true };
      }),

    delete: publicQuery.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      if (!ctx.session?.userId) throw new Error("Not authenticated");
      const db = getDb();
      await db.delete(clients).where(eq(clients.id, input.id));
      return { success: true };
    }),
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // SCRIPTS
  // ═══════════════════════════════════════════════════════════════════════════
  script: createRouter({
    list: publicQuery.query(async ({ ctx }) => {
      if (!ctx.session?.userId) return [];
      const db = getDb();
      return db.select().from(scripts)
        .where(eq(scripts.userId, Number(ctx.session.userId)))
        .orderBy(desc(scripts.createdAt));
    }),

    get: publicQuery.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
      if (!ctx.session?.userId) return null;
      const db = getDb();
      const result = await db.select().from(scripts)
        .where(and(eq(scripts.id, input.id), eq(scripts.userId, Number(ctx.session.userId))))
        .limit(1);
      return result[0] || null;
    }),

    create: publicQuery
      .input(z.object({
        title: z.string().min(1),
        hook: z.string().optional(),
        body: z.string().optional(),
        cta: z.string().optional(),
        fullScript: z.string().optional(),
        targetPlatform: z.enum(["tiktok", "instagram", "youtube", "x", "facebook", "linkedin"]).optional(),
        tone: z.string().optional(),
        duration: z.number().optional(),
        language: z.string().optional(),
        clientId: z.number().optional(),
        aiGenerated: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) throw new Error("Not authenticated");
        const db = getDb();
        const result = await db.insert(scripts).values({
          ...input,
          userId: Number(ctx.session.userId),
        });
        return { id: Number(result[0].insertId), ...input };
      }),

    update: publicQuery
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        hook: z.string().optional(),
        body: z.string().optional(),
        cta: z.string().optional(),
        fullScript: z.string().optional(),
        status: z.enum(["draft", "review", "approved", "archived"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) throw new Error("Not authenticated");
        const db = getDb();
        const { id, ...data } = input;
        await db.update(scripts).set(data).where(eq(scripts.id, id));
        return { success: true };
      }),

    delete: publicQuery.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      if (!ctx.session?.userId) throw new Error("Not authenticated");
      const db = getDb();
      await db.delete(scripts).where(eq(scripts.id, input.id));
      return { success: true };
    }),

    generate: publicQuery
      .input(z.object({
        topic: z.string().min(1),
        platform: z.enum(["tiktok", "instagram", "youtube", "x", "facebook", "linkedin"]),
        tone: z.string().default("energetic"),
        duration: z.number().default(30),
        language: z.string().default("en"),
        clientId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) throw new Error("Not authenticated");

        // TODO: Connect to OpenAI API for real generation
        // For now, return a structured mock response
        const mockHooks = [
          "Stop scrolling! This changes everything...",
          "I wish I knew this sooner...",
          "POV: You just found the secret to...",
          "This is why your content isn't going viral...",
          "3 things nobody tells you about...",
        ];

        const hook = mockHooks[Math.floor(Math.random() * mockHooks.length)];
        const body = `Here's the deal with ${input.topic}. Most people get this completely wrong. They think it's about [common misconception], but the real secret is [key insight]. Let me break it down for you in ${input.duration} seconds.`;
        const cta = `Follow for more ${input.topic} tips! Drop a comment if you want Part 2.`;
        const fullScript = `${hook}\n\n${body}\n\n${cta}`;

        const db = getDb();
        const result = await db.insert(scripts).values({
          userId: Number(ctx.session.userId),
          clientId: input.clientId,
          title: `${input.topic} — ${input.platform}`,
          hook,
          body,
          cta,
          fullScript,
          targetPlatform: input.platform,
          tone: input.tone,
          duration: input.duration,
          language: input.language,
          aiGenerated: true,
          hookScore: Math.floor(Math.random() * 30) + 70,
          status: "draft",
        });

        return {
          id: Number(result[0].insertId),
          title: `${input.topic} — ${input.platform}`,
          hook, body, cta, fullScript,
          hookScore: Math.floor(Math.random() * 30) + 70,
        };
      }),
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT LIBRARY
  // ═══════════════════════════════════════════════════════════════════════════
  content: createRouter({
    list: publicQuery.query(async ({ ctx }) => {
      if (!ctx.session?.userId) return [];
      const db = getDb();
      return db.select().from(contentLibrary)
        .where(eq(contentLibrary.userId, Number(ctx.session.userId)))
        .orderBy(desc(contentLibrary.createdAt));
    }),

    create: publicQuery
      .input(z.object({
        title: z.string().min(1),
        type: z.enum(["video", "script", "image", "audio", "template", "avatar"]),
        description: z.string().optional(),
        url: z.string().optional(),
        tags: z.array(z.string()).optional(),
        format: z.enum(["slideshow", "wall_of_text", "hook_demo", "green_screen", "ugc", "meme", "reel", "short", "carousel", "story"]).optional(),
        clientId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) throw new Error("Not authenticated");
        const db = getDb();
        const result = await db.insert(contentLibrary).values({
          ...input,
          userId: Number(ctx.session.userId),
          tags: input.tags || [],
        });
        return { id: Number(result[0].insertId), ...input };
      }),

    delete: publicQuery.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      if (!ctx.session?.userId) throw new Error("Not authenticated");
      const db = getDb();
      await db.delete(contentLibrary).where(eq(contentLibrary.id, input.id));
      return { success: true };
    }),
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════
  template: createRouter({
    list: publicQuery.query(async () => {
      const db = getDb();
      return db.select().from(templates).orderBy(desc(templates.usageCount));
    }),

    byNiche: publicQuery.input(z.object({ niche: z.string() })).query(async ({ input }) => {
      const db = getDb();
      return db.select().from(templates).where(like(templates.niche, `%${input.niche}%`));
    }),
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLISHING SCHEDULE
  // ═══════════════════════════════════════════════════════════════════════════
  schedule: createRouter({
    list: publicQuery.query(async ({ ctx }) => {
      if (!ctx.session?.userId) return [];
      const db = getDb();
      return db.select().from(publishingSchedule)
        .where(eq(publishingSchedule.userId, Number(ctx.session.userId)))
        .orderBy(desc(publishingSchedule.scheduledAt));
    }),

    create: publicQuery
      .input(z.object({
        contentId: z.number(),
        platform: z.enum(["tiktok", "instagram", "youtube", "x", "facebook", "linkedin", "pinterest", "snapchat", "spotify"]),
        scheduledAt: z.string(),
        caption: z.string().optional(),
        hashtags: z.string().optional(),
        clientId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) throw new Error("Not authenticated");
        const db = getDb();
        const result = await db.insert(publishingSchedule).values({
          ...input,
          userId: Number(ctx.session.userId),
          scheduledAt: new Date(input.scheduledAt),
        });
        return { id: Number(result[0].insertId) };
      }),

    update: publicQuery
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "processing", "published", "failed", "cancelled"]).optional(),
        scheduledAt: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) throw new Error("Not authenticated");
        const db = getDb();
        const { id, ...data } = input;
        if (data.scheduledAt) data.scheduledAt = new Date(data.scheduledAt) as any;
        await db.update(publishingSchedule).set(data).where(eq(publishingSchedule.id, id));
        return { success: true };
      }),

    delete: publicQuery.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      if (!ctx.session?.userId) throw new Error("Not authenticated");
      const db = getDb();
      await db.delete(publishingSchedule).where(eq(publishingSchedule.id, input.id));
      return { success: true };
    }),
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════
  analytics: createRouter({
    overview: publicQuery.query(async ({ ctx }) => {
      if (!ctx.session?.userId) return { views: 0, likes: 0, comments: 0, shares: 0, engagement: "0%" };
      const db = getDb();
      const result = await db.select({
        totalViews: sql<number>`COALESCE(SUM(views), 0)`,
        totalLikes: sql<number>`COALESCE(SUM(likes), 0)`,
        totalComments: sql<number>`COALESCE(SUM(comments), 0)`,
        totalShares: sql<number>`COALESCE(SUM(shares), 0)`,
      }).from(analytics).where(eq(analytics.userId, Number(ctx.session.userId)));

      const data = result[0];
      const totalEngagement = (data?.totalLikes || 0) + (data?.totalComments || 0) + (data?.totalShares || 0);
      const views = data?.totalViews || 1;

      return {
        views: data?.totalViews || 0,
        likes: data?.totalLikes || 0,
        comments: data?.totalComments || 0,
        shares: data?.totalShares || 0,
        engagement: `${((totalEngagement / views) * 100).toFixed(1)}%`,
      };
    }),

    byPlatform: publicQuery.query(async ({ ctx }) => {
      if (!ctx.session?.userId) return [];
      const db = getDb();
      return db.select({
        platform: analytics.platform,
        totalViews: sql<number>`COALESCE(SUM(views), 0)`,
        totalLikes: sql<number>`COALESCE(SUM(likes), 0)`,
        totalComments: sql<number>`COALESCE(SUM(comments), 0)`,
      }).from(analytics)
        .where(eq(analytics.userId, Number(ctx.session.userId)))
        .groupBy(analytics.platform);
    }),

    record: publicQuery
      .input(z.object({
        contentId: z.number(),
        platform: z.enum(["tiktok", "instagram", "youtube", "x", "facebook", "linkedin", "pinterest", "snapchat", "spotify"]),
        views: z.number().default(0),
        likes: z.number().default(0),
        comments: z.number().default(0),
        shares: z.number().default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) throw new Error("Not authenticated");
        const db = getDb();
        await db.insert(analytics).values({
          ...input,
          userId: Number(ctx.session.userId),
        });
        return { success: true };
      }),
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // TRENDING CONTENT
  // ═══════════════════════════════════════════════════════════════════════════
  trending: createRouter({
    list: publicQuery.query(async () => {
      const db = getDb();
      return db.select().from(trendingContent)
        .where(eq(trendingContent.isActive, true))
        .orderBy(desc(trendingContent.views))
        .limit(50);
    }),

    byNiche: publicQuery.input(z.object({ niche: z.string() })).query(async ({ input }) => {
      const db = getDb();
      return db.select().from(trendingContent)
        .where(and(eq(trendingContent.isActive, true), like(trendingContent.niche, `%${input.niche}%`)))
        .orderBy(desc(trendingContent.views))
        .limit(20);
    }),

    byFormat: publicQuery.input(z.object({ format: z.string() })).query(async ({ input }) => {
      const db = getDb();
      return db.select().from(trendingContent)
        .where(and(
          eq(trendingContent.isActive, true),
          eq(trendingContent.format, input.format as any)
        ))
        .orderBy(desc(trendingContent.views))
        .limit(20);
    }),
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // AI JOBS
  // ═══════════════════════════════════════════════════════════════════════════
  aiJob: createRouter({
    list: publicQuery.query(async ({ ctx }) => {
      if (!ctx.session?.userId) return [];
      const db = getDb();
      return db.select().from(aiJobs)
        .where(eq(aiJobs.userId, Number(ctx.session.userId)))
        .orderBy(desc(aiJobs.createdAt));
    }),

    create: publicQuery
      .input(z.object({
        type: z.enum(["script_generate", "video_analyze", "video_edit", "avatar_generate", "caption_generate", "image_generate", "voice_synthesize"]),
        input: z.record(z.any()).optional(),
        creditsUsed: z.number().default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) throw new Error("Not authenticated");
        const db = getDb();
        const result = await db.insert(aiJobs).values({
          ...input,
          userId: Number(ctx.session.userId),
          status: "queued",
          input: input.input || {},
        });
        return { id: Number(result[0].insertId) };
      }),

    update: publicQuery
      .input(z.object({
        id: z.number(),
        status: z.enum(["queued", "processing", "completed", "failed"]).optional(),
        output: z.record(z.any()).optional(),
        errorMessage: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) throw new Error("Not authenticated");
        const db = getDb();
        const { id, ...data } = input;
        if (data.status === "completed" || data.status === "failed") {
          (data as any).completedAt = new Date();
        }
        await db.update(aiJobs).set(data).where(eq(aiJobs.id, id));
        return { success: true };
      }),
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // PLATFORM CONNECTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  platform: createRouter({
    list: publicQuery.query(async ({ ctx }) => {
      if (!ctx.session?.userId) return [];
      const db = getDb();
      return db.select().from(platformConnections);
    }),

  // ═══════════════════════════════════════════════════════════════════════════════
  // VIDEO GENERATION (OpenRouter — Kling v3.0)
  // ═══════════════════════════════════════════════════════════════════════════════
  video: videoRouter,

  // ═══════════════════════════════════════════════════════════════════════════════
  // VOICE NOTES — Audio → Transcription → Scripts
  // ═══════════════════════════════════════════════════════════════════════════════
  voice: voiceRouter,

  // ═══════════════════════════════════════════════════════════════════════════════
  // INTERVIEW ME — AI Interviews → Content
  // ═══════════════════════════════════════════════════════════════════════════════
  interview: interviewRouter,

  // ═══════════════════════════════════════════════════════════════════════════════
  // GOALS — Follower & Content Target Tracking
  // ═══════════════════════════════════════════════════════════════════════════════
  goals: goalsRouter,

  // ═══════════════════════════════════════════════════════════════════════════════
  // COACHING — Weekly Performance Digest
  // ═══════════════════════════════════════════════════════════════════════════════
  coaching: coachingRouter,

  // ═══════════════════════════════════════════════════════════════════════════════
  // REFERRALS — Credit-based Affiliate System
  // ═══════════════════════════════════════════════════════════════════════════════
  referral: referralRouter,

  // ═══════════════════════════════════════════════════════════════════════════════
  // PLATFORM CONNECTIONS (Zernio-Powered)
  // ═══════════════════════════════════════════════════════════════════════════════
    // ── DEPRECATED: Old connect endpoint (replaced by Zernio flow) ───────────
    connect: publicQuery
      .input(z.object({
        clientId: z.number(),
        platform: z.enum(["tiktok", "instagram", "youtube", "x", "facebook", "linkedin", "pinterest", "snapchat", "spotify"]),
        accountName: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) throw new Error("Not authenticated");
        return { success: true, message: "Use initiateConnect + Zernio OAuth flow" };
      }),

    // ── Step 1: Initiate Zernio OAuth connection ─────────────────────────────
    initiateConnect: publicQuery
      .input(z.object({
        platform: z.enum([
          "tiktok", "instagram", "youtube", "x", "facebook", "linkedin",
          "pinterest", "threads", "reddit", "bluesky", "telegram", "discord",
        ]),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) throw new Error("Not authenticated");
        const { initiateConnect, isConfigured } = await import("./lib/zernio");
        if (!isConfigured()) throw new Error("Zernio API key not configured");

        const redirectUri = `${process.env.VITE_APP_URL || "http://localhost:3000"}/api/zernio/callback`;
        const state = String(ctx.session.userId);
        const result = await initiateConnect(input.platform as any, redirectUri, state);
        if (!result) throw new Error("Failed to initiate connection");
        return { authUrl: result.authUrl, requestId: result.requestId };
      }),

    // ── Disconnect account ───────────────────────────────────────────────────
    disconnect: publicQuery
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) throw new Error("Not authenticated");
        const db = getDb();
        const conn = await db.select().from(platformConnections)
          .where(eq(platformConnections.id, input.id))
          .limit(1);
        if (!conn[0]) throw new Error("Connection not found");
        if (conn[0].zernioAccountId) {
          const { disconnectAccount } = await import("./lib/zernio");
          await disconnectAccount(conn[0].zernioAccountId);
        }
        await db.update(platformConnections)
          .set({ status: "disconnected" })
          .where(eq(platformConnections.id, input.id));
        return { success: true };
      }),

    // ── Publish content via Zernio ───────────────────────────────────────────
    publish: publicQuery
      .input(z.object({
        accountId: z.number(),
        content: z.string().min(1),
        mediaUrl: z.string().optional(),
        mediaUrls: z.array(z.string()).optional(),
        hashtags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) throw new Error("Not authenticated");
        const db = getDb();
        const conn = await db.select().from(platformConnections)
          .where(eq(platformConnections.id, input.accountId))
          .limit(1);
        if (!conn[0] || !conn[0].zernioAccountId) throw new Error("Account not connected via Zernio");

        const { publishPost, isConfigured } = await import("./lib/zernio");
        if (!isConfigured()) throw new Error("Zernio API key not configured");
        const result = await publishPost({
          accountId: conn[0].zernioAccountId,
          content: input.content,
          mediaUrl: input.mediaUrl,
          mediaUrls: input.mediaUrls,
          hashtags: input.hashtags,
        });
        if (!result) throw new Error("Publishing failed");

        await db.insert(analytics).values({
          userId: Number(ctx.session.userId),
          clientId: conn[0].clientId,
          platform: conn[0].platform,
          contentId: 0,
          views: 0, likes: 0, comments: 0, shares: 0,
        });
        return result;
      }),

    // ── Schedule content via Zernio ──────────────────────────────────────────
    schedule: publicQuery
      .input(z.object({
        accountId: z.number(),
        content: z.string().min(1),
        mediaUrl: z.string().optional(),
        hashtags: z.array(z.string()).optional(),
        scheduledAt: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.session?.userId) throw new Error("Not authenticated");
        const db = getDb();
        const conn = await db.select().from(platformConnections)
          .where(eq(platformConnections.id, input.accountId))
          .limit(1);
        if (!conn[0] || !conn[0].zernioAccountId) throw new Error("Account not connected via Zernio");

        const { schedulePost, isConfigured } = await import("./lib/zernio");
        if (!isConfigured()) throw new Error("Zernio API key not configured");
        const result = await schedulePost({
          accountId: conn[0].zernioAccountId,
          content: input.content,
          mediaUrl: input.mediaUrl,
          hashtags: input.hashtags,
          scheduledAt: input.scheduledAt,
        });
        if (!result) throw new Error("Scheduling failed");

        await db.insert(publishingSchedule).values({
          userId: Number(ctx.session.userId),
          clientId: conn[0].clientId,
          contentId: 0,
          platform: conn[0].platform,
          scheduledAt: new Date(input.scheduledAt),
          caption: input.content,
          status: "pending",
        });
        return result;
      }),

    // ── Pull analytics via Zernio ────────────────────────────────────────────
    pullAnalytics: publicQuery
      .input(z.object({ accountId: z.number(), startDate: z.string().optional(), endDate: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.session?.userId) return null;
        const db = getDb();
        const conn = await db.select().from(platformConnections)
          .where(eq(platformConnections.id, input.accountId))
          .limit(1);
        if (!conn[0] || !conn[0].zernioAccountId) return null;
        const { getAnalytics, isConfigured } = await import("./lib/zernio");
        if (!isConfigured()) return null;
        return getAnalytics({ accountId: conn[0].zernioAccountId, startDate: input.startDate, endDate: input.endDate });
      }),
  }),
});

export type AppRouter = typeof appRouter;
