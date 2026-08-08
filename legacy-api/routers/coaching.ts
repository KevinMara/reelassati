import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware.js";
import { getDb } from "../queries/connection.js";
import {
  coachingInsights,
  scripts,
  publishingSchedule,
  analytics,
} from "@db/schema";
import { chatCompletion } from "../lib/openrouter.js";

export const coachingRouter = createRouter({
  // ── Get latest coaching insight ────────────────────────────────────────────
  latest: publicQuery.query(async ({ ctx }) => {
    if (!ctx.session?.userId) return null;
    const db = getDb();
    const insights = await db
      .select()
      .from(coachingInsights)
      .where(eq(coachingInsights.userId, Number(ctx.session.userId)))
      .orderBy(coachingInsights.weekStart);
    return insights[insights.length - 1] || null;
  }),

  // ── Generate weekly coaching report ────────────────────────────────────────
  generate: publicQuery.mutation(async ({ ctx }) => {
    if (!ctx.session?.userId) throw new Error("Not authenticated");
    const db = getDb();
    const userId = Number(ctx.session.userId);

    // Get this week's data
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const weekScripts = await db
      .select()
      .from(scripts)
      .where(eq(scripts.userId, userId))
      .orderBy(scripts.createdAt);
    const weekPublished = await db
      .select()
      .from(publishingSchedule)
      .where(eq(publishingSchedule.userId, userId));
    const weekAnalytics = await db
      .select()
      .from(analytics)
      .where(eq(analytics.userId, userId));

    const postsCreated = weekScripts.length;
    const postsPublished = weekPublished.filter(
      p => p.status === "published"
    ).length;
    const totalViews = weekAnalytics.reduce((s, a) => s + (a.views || 0), 0);
    const totalEngagements = weekAnalytics.reduce(
      (s, a) => s + (a.likes || 0) + (a.comments || 0) + (a.shares || 0),
      0
    );

    // Use Kimi to generate insights
    const prompt = `As a social media coach, analyze this week's performance and give actionable advice:

Posts created: ${postsCreated}
Posts published: ${postsPublished}
Total views: ${totalViews}
Total engagements: ${totalEngagements}

Give me:
1. Three key insights about their performance
2. Three specific recommendations for next week
3. Three goals for next week

Return ONLY JSON:
{"insights":["...","...","..."],"recommendations":["...","...","..."],"nextWeekGoals":["...","...","..."]}`;

    const response = await chatCompletion([
      {
        role: "system",
        content:
          "You are an expert social media strategist who coaches creators to grow their following.",
      },
      { role: "user", content: prompt },
    ]);

    let parsed: any = {};
    try {
      if (response) parsed = JSON.parse(response);
    } catch {
      /* ignore */
    }

    const result = await db
      .insert(coachingInsights)
      .values({
        userId,
        weekStart,
        weekEnd: now,
        postsCreated,
        postsPublished,
        totalViews,
        totalEngagements,
        growthRate:
          totalViews > 0
            ? "+" + Math.round((totalEngagements / totalViews) * 100) + "%"
            : "N/A",
        insights: parsed.insights || [
          "Keep creating consistently!",
          "Engage with your audience in comments.",
          "Try posting at different times to find your peak.",
        ],
        recommendations: parsed.recommendations || [
          "Post 3-5 times per week minimum.",
          "Reply to every comment in the first hour.",
          "Use trending sounds and hashtags.",
        ],
        nextWeekGoals: parsed.nextWeekGoals || [
          "Create 5 new posts",
          "Hit 1K views on one post",
          "Gain 50 new followers",
        ],
      })
      .returning({ id: coachingInsights.id });

    return {
      id: result[0]?.id,
      ...parsed,
      postsCreated,
      postsPublished,
      totalViews,
      totalEngagements,
    };
  }),
});
