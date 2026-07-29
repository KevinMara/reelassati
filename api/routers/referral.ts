import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware.js";
import { getDb } from "../queries/connection.js";
import { referrals, users } from "@db/schema";

// Credit value: 1 credit = $0.01 (1 cent)
const CREDIT_TO_DOLLAR = 0.01;
const REFERRAL_CREDITS = 500; // 500 credits per successful referral
const REFERRAL_DOLLAR_VALUE = (REFERRAL_CREDITS * CREDIT_TO_DOLLAR).toFixed(2);

function generateCode(): string {
  return "REEL-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const referralRouter = createRouter({
  // ── Get my referral code ───────────────────────────────────────────────────
  myCode: publicQuery.query(async ({ ctx }) => {
    if (!ctx.session?.userId) return null;
    const db = getDb();
    const existing = await db.select().from(referrals)
      .where(eq(referrals.referrerUserId, Number(ctx.session.userId)))
      .limit(1);
    if (existing[0]) return { code: existing[0].referralCode };
    const code = generateCode();
    await db.insert(referrals).values({
      referrerUserId: Number(ctx.session.userId),
      referralCode: code,
      status: "pending",
    });
    return { code };
  }),

  // ── Get referral stats ─────────────────────────────────────────────────────
  stats: publicQuery.query(async ({ ctx }) => {
    if (!ctx.session?.userId) return { totalReferrals: 0, creditsEarned: 0, dollarValue: "$0.00", referrals: [] };
    const db = getDb();
    const all = await db.select().from(referrals)
      .where(eq(referrals.referrerUserId, Number(ctx.session.userId)));
    const completed = all.filter((r) => r.status === "completed" || r.status === "rewarded");
    const totalCredits = completed.reduce((sum, r) => sum + (r.creditsEarned || 0), 0);
    return {
      totalReferrals: all.length,
      completedReferrals: completed.length,
      creditsEarned: totalCredits,
      dollarValue: "$" + (totalCredits * CREDIT_TO_DOLLAR).toFixed(2),
      referrals: all,
    };
  }),

  // ── Apply referral code on signup ──────────────────────────────────────────
  apply: publicQuery
    .input(z.object({ code: z.string(), userId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const ref = await db.select().from(referrals)
        .where(eq(referrals.referralCode, input.code))
        .limit(1);
      if (!ref[0]) throw new Error("Invalid referral code");
      if (ref[0].status !== "pending") throw new Error("Code already used");

      await db.update(referrals).set({
        referredUserId: input.userId,
        status: "completed",
        creditsEarned: REFERRAL_CREDITS,
        dollarValue: "$" + REFERRAL_DOLLAR_VALUE,
        completedAt: new Date(),
      }).where(eq(referrals.id, ref[0].id));

      // Add credits to referrer
      await db.update(users)
        .set({ credits: (users.credits || 0) + REFERRAL_CREDITS })
        .where(eq(users.id, ref[0].referrerUserId));

      return { success: true, creditsEarned: REFERRAL_CREDITS, dollarValue: "$" + REFERRAL_DOLLAR_VALUE };
    }),
});
