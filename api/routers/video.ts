import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { generateVideo, checkVideoStatus, isConfigured, PRIMARY_VIDEO_MODEL } from "../lib/openrouter";
import { getDb } from "../queries/connection";
import { aiJobs } from "@db/schema";

export const videoRouter = createRouter({
  // ── Check if OpenRouter video is configured ────────────────────────────────
  config: publicQuery.query(() => ({
    enabled: isConfigured(),
    model: {
      id: PRIMARY_VIDEO_MODEL,
      name: "Kling v3.0 Standard",
      quality: "720p + Native Audio",
      costSilent: "$0.084/sec",
      costAudio: "$0.126/sec",
      maxDuration: 15,
      ratios: ["9:16", "16:9", "1:1"],
      features: ["Native audio generation", "First frame image-to-video", "Last frame image-to-video", "Negative prompt", "CFG scale control"],
    },
  })),

  // ── Generate video ─────────────────────────────────────────────────────────
  generate: publicQuery
    .input(z.object({
      prompt: z.string().min(1).max(2500),
      duration: z.number().min(3).max(15).optional(),
      ratio: z.enum(["16:9", "9:16", "1:1"]).optional(),
      generateAudio: z.boolean().optional(),
      negativePrompt: z.string().max(500).optional(),
      cfgScale: z.number().min(0).max(1).optional(),
      firstFrameUrl: z.string().optional(),
      lastFrameUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.session?.userId) throw new Error("Not authenticated");
      if (!isConfigured()) throw new Error("OpenRouter API key not configured");

      const userId = Number(ctx.session.userId);
      const db = getDb();

      // Create AI job record
      const jobResult = await db.insert(aiJobs).values({
        userId,
        type: "video_edit",
        status: "processing",
        input: {
          prompt: input.prompt,
          duration: input.duration,
          ratio: input.ratio,
          generateAudio: input.generateAudio,
          negativePrompt: input.negativePrompt,
          cfgScale: input.cfgScale,
          hasFirstFrame: !!input.firstFrameUrl,
          hasLastFrame: !!input.lastFrameUrl,
        },
        creditsUsed: Math.round((input.duration || 5) * 13), // ~13 credits per second (with audio)
      }).returning({ id: aiJobs.id });

      const jobId = jobResult[0]?.id;

      // Call OpenRouter with Kling v3.0 Standard
      const result = await generateVideo({
        prompt: input.prompt,
        duration: (input.duration || 5) as 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15,
        ratio: input.ratio || "9:16",
        generateAudio: input.generateAudio,
        negativePrompt: input.negativePrompt,
        cfgScale: input.cfgScale,
        firstFrameUrl: input.firstFrameUrl,
        lastFrameUrl: input.lastFrameUrl,
      });

      if (!result || result.status === "failed") {
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
            output: { videoUrl: result.videoUrl, thumbnailUrl: result.thumbnailUrl, hasAudio: result.hasAudio },
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
        hasAudio: result.hasAudio,
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
