import { describe, expect, it } from "vitest";
import {
  automaticPublicationReview,
  publicationSchedule,
} from "./publication-options";
describe("publication options", () => {
  it("labels known AI in the selected audience language without inventing classifications or consent", () => {
    const review = automaticPublicationReview({
      language: "it",
      aiText: false,
      aiMedia: true,
      hasMedia: true,
      submittedAt: "2026-10-15T08:00:00Z",
    });
    expect(review.visibleDisclosure.text).toContain("assistenza dell’IA");
    expect(review.classificationAnswers.realisticSyntheticMedia).toBe(
      "unknown"
    );
    expect(review.rightsConfirmed).toBe(false);
    expect(review.substantiveHumanReview).toBe(false);
    const plain = automaticPublicationReview({
      language: "en",
      aiText: false,
      aiMedia: false,
      hasMedia: false,
      submittedAt: "",
    });
    expect(plain.visibleDisclosure.required).toBe(false);
    expect(plain.classificationAnswers.aiGeneratedText).toBe("unknown");
  });
  it("limits temporary media scheduling without restricting long-range text drafts", () => {
    const now = new Date("2026-10-15T10:00:00").getTime();
    expect(() =>
      publicationSchedule("2026-10-14", "10:00", false, now)
    ).toThrow("future");
    expect(() => publicationSchedule("2026-10-23", "10:00", true, now)).toThrow(
      "6 days"
    );
    expect(publicationSchedule("2026-10-23", "10:00", false, now)).toBe(
      new Date("2026-10-23T10:00:00").toISOString()
    );
  });
});
