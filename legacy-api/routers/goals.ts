import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware.js";
import { getDb } from "../queries/connection.js";
import { goals } from "@db/schema";

export const goalsRouter = createRouter({
  list: publicQuery.query(async ({ ctx }) => {
    if (!ctx.session?.userId) return [];
    const db = getDb();
    return db
      .select()
      .from(goals)
      .where(eq(goals.userId, Number(ctx.session.userId)))
      .orderBy(goals.createdAt);
  }),

  create: publicQuery
    .input(
      z.object({
        type: z.enum(["followers", "posts", "engagement", "views", "revenue"]),
        platform: z.string().optional(),
        targetValue: z.number().min(1),
        deadline: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.session?.userId) throw new Error("Not authenticated");
      const db = getDb();
      const result = await db
        .insert(goals)
        .values({
          userId: Number(ctx.session.userId),
          type: input.type,
          platform: input.platform as any,
          targetValue: input.targetValue,
          currentValue: 0,
          deadline: input.deadline ? new Date(input.deadline) : undefined,
          status: "active",
        })
        .returning({ id: goals.id });
      return { id: result[0]?.id };
    }),

  updateProgress: publicQuery
    .input(z.object({ id: z.number(), currentValue: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.session?.userId) throw new Error("Not authenticated");
      const db = getDb();
      const goal = await db
        .select()
        .from(goals)
        .where(eq(goals.id, input.id))
        .limit(1);
      if (!goal[0]) throw new Error("Goal not found");

      const newStatus =
        input.currentValue >= goal[0].targetValue ? "achieved" : goal[0].status;

      await db
        .update(goals)
        .set({ currentValue: input.currentValue, status: newStatus as any })
        .where(eq(goals.id, input.id));

      return { achieved: newStatus === "achieved" };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(goals).where(eq(goals.id, input.id));
      return { success: true };
    }),
});
