import { describe, expect, it } from "vitest";
import {
  AI_CREDIT_COSTS,
  DELIVERY_COST_USD_PER_CREDIT,
  CREDIT_TOP_UPS,
  topUpPriceCents,
  imageCreditCost,
  planEntitlements,
  speechCreditCost,
  speechCharacterCount,
  speechCreditRate,
  ELEVENLABS_LAUNCH_START_MS,
  ELEVENLABS_LAUNCH_END_MS,
  timedCreditCost,
  videoCreditCost,
  deliveryBudgetUsd,
} from "./billing";

describe("billing contracts", () => {
  it("keeps the approved abundant plan allowances", () => {
    expect(DELIVERY_COST_USD_PER_CREDIT).toBe(0.003);
    expect(deliveryBudgetUsd(1_000)).toBe(3);
    expect(planEntitlements("creator").monthlyCredits).toBe(1_000);
    expect(planEntitlements("pro").monthlyCredits).toBe(4_000);
    expect(planEntitlements("studio").monthlyCredits).toBe(12_000);
    expect(planEntitlements("creator").socialAccounts).toBe(1);
    expect(planEntitlements("pro").socialAccounts).toBe(5);
    expect(planEntitlements("studio").socialAccounts).toBe(10);
  });

  it("keeps every top-up cheaper per credit than every monthly and annual plan", () => {
    for (const planId of ["creator", "pro", "studio"] as const)
      for (const cycle of ["monthly", "annual"] as const) {
        const plan = planEntitlements(planId);
        for (const id of ["boost", "momentum", "scale"] as const) {
          const unit =
            (cycle === "annual" ? plan.annualTotal / 12 : plan.monthlyPrice) /
            plan.monthlyCredits;
          expect(
            topUpPriceCents(id) / 100 / CREDIT_TOP_UPS[id].credits
          ).toBeLessThan(unit);
        }
      }
    expect(topUpPriceCents("boost")).toBe(900);
    expect(topUpPriceCents("momentum")).toBe(1700);
    expect(topUpPriceCents("scale")).toBe(3900);
    const packs = Object.values(CREDIT_TOP_UPS);
    expect(packs[0].credits).toBeGreaterThanOrEqual(
      15 * AI_CREDIT_COSTS.video720pWithAudioPerSecond
    );
    for (let i = 1; i < packs.length; i++) {
      expect(packs[i].price / packs[i].credits).toBeLessThan(
        packs[i - 1].price / packs[i - 1].credits
      );
    }
  });

  it("quotes image, speech, transcription and analysis credits deterministically", () => {
    expect(imageCreditCost("1K")).toBe(20);
    expect(imageCreditCost("2K")).toBe(40);
    expect(speechCreditCost(1)).toBe(1);
    expect(speechCreditCost(1_001, "sarah", ELEVENLABS_LAUNCH_END_MS)).toBe(21);
    expect(speechCreditCost(1_000, "English_Graceful_Lady")).toBe(30);
    expect(speechCreditCost(1_000, "sarah", ELEVENLABS_LAUNCH_END_MS)).toBe(20);
    expect(speechCharacterCount("ciao 😀")).toBe(6);
    expect(timedCreditCost(61, AI_CREDIT_COSTS.transcriptionPerMinute)).toBe(4);
    expect(timedCreditCost(61, AI_CREDIT_COSTS.videoAnalysisPerMinute)).toBe(
      20
    );
  });

  it("passes through the verified launch discount and expires it at 8am Pacific", () => {
    expect(speechCreditRate("sarah", ELEVENLABS_LAUNCH_START_MS - 1)).toBe(20);
    expect(speechCreditRate("sarah", ELEVENLABS_LAUNCH_START_MS)).toBe(10);
    expect(speechCreditRate("sarah", ELEVENLABS_LAUNCH_END_MS - 1)).toBe(10);
    expect(speechCreditRate("sarah", ELEVENLABS_LAUNCH_END_MS)).toBe(20);
    expect(
      speechCreditRate("English_Graceful_Lady", ELEVENLABS_LAUNCH_START_MS)
    ).toBe(30);
    expect(speechCreditCost(100, "sarah", ELEVENLABS_LAUNCH_START_MS)).toBe(1);
    expect(speechCreditCost(100, "sarah", ELEVENLABS_LAUNCH_END_MS)).toBe(2);
    expect(speechCreditCost(1_001, "sarah", ELEVENLABS_LAUNCH_START_MS)).toBe(
      11
    );
    expect(() => speechCreditCost(Infinity)).toThrow(/character count/);
  });

  it("covers provider costs plus delivery headroom within the accepted credit budget", () => {
    for (const characters of [1, 50, 100, 999, 1_000, 1_001, 5_000]) {
      for (const at of [ELEVENLABS_LAUNCH_START_MS, ELEVENLABS_LAUNCH_END_MS]) {
        const usdPerCharacter =
          at < ELEVENLABS_LAUNCH_END_MS ? 0.00002 : 0.00004;
        expect(
          deliveryBudgetUsd(speechCreditCost(characters, "sarah", at)) + 1e-12
        ).toBeGreaterThanOrEqual(characters * usdPerCharacter * 1.5);
      }
      expect(
        deliveryBudgetUsd(
          speechCreditCost(characters, "English_Graceful_Lady")
        ) + 1e-12
      ).toBeGreaterThanOrEqual(characters * 0.00006 * 1.5);
    }
  });

  it("prices new and continued video clips from the chosen settings", () => {
    expect(
      videoCreditCost({
        duration: 15,
        resolution: "720p",
        generateAudio: true,
        continuation: true,
      })
    ).toBe(700);
    expect(
      videoCreditCost({
        duration: 15,
        resolution: "720p",
        generateAudio: false,
        continuation: false,
      })
    ).toBe(600);
    expect(
      videoCreditCost({
        duration: 15,
        resolution: "720p",
        generateAudio: true,
        continuation: false,
      })
    ).toBe(900);
    expect(
      videoCreditCost({
        duration: 15,
        resolution: "1080p",
        generateAudio: true,
        continuation: true,
      })
    ).toBe(1_500);
  });
});
