import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { generateVideo, checkVideoStatus, isConfigured } from "../lib/openrouter";
import { getDb } from "../queries/connection";
import { aiJobs } from "@db/schema";

export const videoRouter = createRouter({
  // ── Check if OpenRouter video is configured ────────────────────────────────
  config: publicQuery.query(() => ({
    enabled: isConfigured(),
    models: [
      { id: "alibaba/happyhorse-1.1", name: "HappyHorse 1.1", quality: "Best", cost: "~$0.144/sec" },
      { id: "google/veo-3.1-fast", name: "Veo 3.1 Fast", quality: "Fast", cost: "~$0.10/sec" },
    ],
  })),

  // ── Generate video ─────────────────────────────────────────────────────────
  generate: publicQuery
    .input(z.object({
      prompt: z.string().min(1).max(2500),
      model: z.enum(["alibaba/happyhorse-1.1", "google/veo-3.1-fast"]).optional(),
      duration: z.number().min(4).max(12).optional(),
      ratio: z.enum(["16:9", "9:16", "1:1", "3:4", "4:3"]).optional(),
      referenceImageUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.session?.userId) throw new Error("Not authenticated");
      if (!isConfigured()) throw new Error("OpenRouter API key not configured");

      const userId = Number(ctx.session.userId);

      // Create AI job record
      const db = getDb();
      const jobResult = await db.insert(aiJobs).values({
        userId,
        type: "video_edit",
        status: "processing",
        input: {
          prompt: input.prompt,
          model: input.model,
          duration: input.duration,
          ratio: input.ratio,
        },
        creditsUsed: Math.round((input.duration || 5) * 10), // 10 credits per second
      }).returning({ id: aiJobs.id });

      const jobId = jobResult[0]?.id;

      // Call OpenRouter
      const result = await generateVideo({
        prompt: input.prompt,
        model: input.model || "alibaba/happyhorse-1.1",
        duration: (input.duration || 5) as 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12,
        ratio: input.ratio || "9:16",
        referenceImageUrl: input.referenceImageUrl,
      });

      if (!result || result.status === "failed") {
        // Update job as failed
        if (jobId) {
          await db.update(aiJobs)
            .set({ status: "failed", errorMessage: result?.error || "Unknown error" })
            .where(aiJobs.id.equals(jobId));
        }
        throw new Error(result?.error || "Video generation failed");
      }

      // Update job with result
      if (jobId) {
        await db.update(aiJobs)
          .set({
            status: "completed",
            output: { videoUrl: result.videoUrl, thumbnailUrl: result.thumbnailUrl },
            completedAt: new Date(),
          })
          .where(aiJobs.id.equals(jobId));
      }

      return {
        jobId,
        videoId: result.id,
        status: result.status,
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl,
        duration: result.duration,
        model: result.model,
        cost: result.cost,
      };
    }),

  // ── Check video status ─────────────────────────────────────────────────────
  status: publicQuery
    .input(z.object({ videoId: z.string() }))
    .query(async ({ input }) => {
      if (!isConfigured()) return null;
      return checkVideoStatus(input.videoId);
    }),
});
