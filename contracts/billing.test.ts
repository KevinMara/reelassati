import { describe, expect, it } from "vitest";
import {
  AI_CREDIT_COSTS,
  CREDIT_TOP_UPS,
  topUpPriceCents,
  imageCreditCost,
  planEntitlements,
  speechCreditCost,
  timedCreditCost,
  videoCreditCost,
} from "./billing";

describe("billing contracts", () => {
  it("keeps the approved abundant plan allowances", () => {
    expect(planEntitlements("creator").monthlyCredits).toBe(1_000);
    expect(planEntitlements("pro").monthlyCredits).toBe(4_000);
    expect(planEntitlements("studio").monthlyCredits).toBe(12_000);
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
    expect(speechCreditCost(1)).toBe(30);
    expect(speechCreditCost(1_001)).toBe(60);
    expect(timedCreditCost(61, AI_CREDIT_COSTS.transcriptionPerMinute)).toBe(2);
    expect(timedCreditCost(61, AI_CREDIT_COSTS.videoAnalysisPerMinute)).toBe(
      20
    );
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
