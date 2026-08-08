import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware.js";
import { getDb } from "../queries/connection.js";
import { interviewSessions } from "@db/schema";
import { chatCompletion } from "../lib/openrouter.js";

export const interviewRouter = createRouter({
  // ── List sessions ──────────────────────────────────────────────────────────
  list: publicQuery.query(async ({ ctx }) => {
    if (!ctx.session?.userId) return [];
    const db = getDb();
    return db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, Number(ctx.session.userId)))
      .orderBy(interviewSessions.createdAt);
  }),

  // ── Start interview — AI generates questions ───────────────────────────────
  start: publicQuery
    .input(
      z.object({
        topic: z.string().min(1),
        niche: z.string().optional(),
        platform: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.session?.userId) throw new Error("Not authenticated");

      const prompt = `Generate 5 structured interview questions to help a content creator share their expertise about "${input.topic}"${input.niche ? ` in the ${input.niche} niche` : ""}${input.platform ? ` for ${input.platform}` : ""}.

The questions should feel like a friendly podcast interview. Each should dig deep and elicit stories, insights, and actionable advice.

Return ONLY JSON: [{"id":1,"question":"..."},{"id":2,"question":"..."},...]`;

      const response = await chatCompletion([
        {
          role: "system",
          content:
            "You are a skilled podcast interviewer who helps creators share their authentic stories.",
        },
        { role: "user", content: prompt },
      ]);

      let questions: any[] = [];
      try {
        if (response) questions = JSON.parse(response);
      } catch {
        /* ignore */
      }

      // Fallback
      if (!questions.length) {
        questions = [
          {
            id: 1,
            question: `What first got you interested in ${input.topic}?`,
          },
          {
            id: 2,
            question: `What's the biggest misconception people have about ${input.topic}?`,
          },
          {
            id: 3,
            question: `Can you share a specific story or moment that changed everything for you?`,
          },
          {
            id: 4,
            question: `What advice would you give someone just starting out with ${input.topic}?`,
          },
          {
            id: 5,
            question: `What's one thing you wish you knew when you started?`,
          },
        ];
      }

      const db = getDb();
      const result = await db
        .insert(interviewSessions)
        .values({
          userId: Number(ctx.session.userId),
          topic: input.topic,
          niche: input.niche,
          platform: input.platform as any,
          questions: questions as any,
          answers: [],
          status: "in_progress",
        })
        .returning({ id: interviewSessions.id });

      return { sessionId: result[0]?.id, questions };
    }),

  // ── Submit answers ─────────────────────────────────────────────────────────
  answer: publicQuery
    .input(
      z.object({
        sessionId: z.number(),
        answers: z.array(
          z.object({ questionId: z.number(), answer: z.string() })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.session?.userId) throw new Error("Not authenticated");
      const db = getDb();

      await db
        .update(interviewSessions)
        .set({ answers: input.answers as any })
        .where(eq(interviewSessions.id, input.sessionId));

      return { success: true };
    }),

  // ── Generate content from interview ────────────────────────────────────────
  generate: publicQuery
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.session?.userId) throw new Error("Not authenticated");
      const db = getDb();

      await db
        .update(interviewSessions)
        .set({ status: "generating" })
        .where(eq(interviewSessions.id, input.sessionId));

      const session = await db
        .select()
        .from(interviewSessions)
        .where(eq(interviewSessions.id, input.sessionId))
        .limit(1);
      if (!session[0]) throw new Error("Session not found");

      const qa = (session[0].questions as any[])
        .map((q: any) => {
          const a = (session[0].answers as any[]).find(
            (ans: any) => ans.questionId === q.id
          );
          return `Q: ${q.question}\nA: ${a?.answer || "No answer"}`;
        })
        .join("\n\n");

      const prompt = `Based on this interview, create 3 short-form social media posts (TikTok/Reels/Shorts). Each should have a hook, body, and CTA.

Interview:
${qa}

Return ONLY JSON: [{"hook":"...","body":"...","cta":"...","platform":"tiktok"},{"hook":"...","body":"...","cta":"...","platform":"instagram"},{"hook":"...","body":"...","cta":"...","platform":"youtube"}]`;

      const response = await chatCompletion([
        {
          role: "system",
          content:
            "You are a viral content creator who turns interviews into engaging short-form posts.",
        },
        { role: "user", content: prompt },
      ]);

      let content: any[] = [];
      try {
        if (response) content = JSON.parse(response);
      } catch {
        /* ignore */
      }

      if (!content.length) {
        content = [
          {
            hook: "You won't believe this...",
            body: "Based on my interview about " + session[0].topic,
            cta: "Follow for more!",
            platform: "tiktok",
          },
        ];
      }

      await db
        .update(interviewSessions)
        .set({
          generatedContent: content as any,
          status: "completed",
        })
        .where(eq(interviewSessions.id, input.sessionId));

      return { content };
    }),
});
