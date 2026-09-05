import { describe, expect, it } from "vitest";
import {
  AI_CREDIT_COSTS,
  CREDIT_TOP_UPS,
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

  it("keeps top-ups less attractive than upgrading a recurring plan", () => {
    expect(CREDIT_TOP_UPS.boost).toMatchObject({ credits: 500, price: 12 });
    expect(CREDIT_TOP_UPS.momentum).toMatchObject({
      credits: 2_000,
      price: 39,
    });
    expect(CREDIT_TOP_UPS.scale).toMatchObject({ credits: 5_000, price: 89 });
  });

  it("quotes image, speech, transcription and analysis credits deterministically", () => {
    expect(imageCreditCost("1K")).toBe(20);
    expect(imageCreditCost("2K")).toBe(40);
    expect(speechCreditCost(1)).toBe(30);
    expect(speechCreditCost(1_001)).toBe(60);
    expect(timedCreditCost(61, AI_CREDIT_COSTS.transcriptionPerMinute)).toBe(2);
    expect(timedCreditCost(61, AI_CREDIT_COSTS.videoAnalysisPerMinute)).toBe(20);
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
