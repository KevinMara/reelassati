import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware.js";
import { getDb } from "../queries/connection.js";
import { voiceNotes } from "@db/schema";
import { transcribeAudio, isConfigured } from "../lib/openrouter.js";

export const voiceRouter = createRouter({
  // ── List voice notes ───────────────────────────────────────────────────────
  list: publicQuery.query(async ({ ctx }) => {
    if (!ctx.session?.userId) return [];
    const db = getDb();
    return db.select().from(voiceNotes)
      .where(eq(voiceNotes.userId, Number(ctx.session.userId)))
      .orderBy(voiceNotes.createdAt);
  }),

  // ── Transcribe audio ───────────────────────────────────────────────────────
  transcribe: publicQuery
    .input(z.object({
      id: z.number(),
      audioUrl: z.string(),
      language: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.session?.userId) throw new Error("Not authenticated");
      if (!isConfigured()) throw new Error("OpenRouter not configured");

      const db = getDb();
      await db.update(voiceNotes).set({ status: "transcribing" })
        .where(eq(voiceNotes.id, input.id));

      const result = await transcribeAudio(input.audioUrl, input.language);

      if (!result) {
        await db.update(voiceNotes).set({ status: "uploaded" })
          .where(eq(voiceNotes.id, input.id));
        throw new Error("Transcription failed");
      }

      await db.update(voiceNotes).set({
        transcription: result.text,
        segments: result.segments as any,
        language: input.language,
        status: "transcribed",
      }).where(eq(voiceNotes.id, input.id));

      return { text: result.text, segments: result.segments };
    }),

  // ── Generate scripts from transcription ────────────────────────────────────
  generateScripts: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.session?.userId) throw new Error("Not authenticated");
      const db = getDb();
      const note = await db.select().from(voiceNotes)
        .where(eq(voiceNotes.id, input.id)).limit(1);
      if (!note[0]?.transcription) throw new Error("No transcription found");

      await db.update(voiceNotes).set({ status: "generating" })
        .where(eq(voiceNotes.id, input.id));

      // Use Kimi to generate scripts from transcription
      const { chatCompletion } = await import("../lib/openrouter.js");
      const prompt = `Turn this voice note into 3 short-form content scripts (for TikTok/Reels/Shorts). Each should have a hook, body, and CTA. Make them punchy and engaging.

Voice note: "${note[0].transcription}"

Return ONLY JSON in this format:
[{"hook":"...","body":"...","cta":"...","platform":"tiktok"},{"hook":"...","body":"...","cta":"...","platform":"instagram"},{"hook":"...","body":"...","cta":"...","platform":"youtube"}]`;

      const response = await chatCompletion([
        { role: "system", content: "You are a social media content expert. Create viral short-form scripts." },
        { role: "user", content: prompt },
      ]);

      let scripts: any[] = [];
      try {
        if (response) scripts = JSON.parse(response);
      } catch { /* ignore parse errors */ }

      // Fallback if parsing fails
      if (!scripts.length) {
        scripts = [
          { hook: note[0].transcription.substring(0, 100) + "...", body: note[0].transcription, cta: "Follow for more!", platform: "tiktok" },
        ];
      }

      await db.update(voiceNotes).set({
        generatedScripts: scripts as any,
        status: "completed",
      }).where(eq(voiceNotes.id, input.id));

      return { scripts };
    }),
});
