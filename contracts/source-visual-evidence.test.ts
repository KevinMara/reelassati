import { describe, expect, it } from "vitest";
import { fromJSONSchema } from "zod";
import {
  normalizeSourceVisualEvidence,
  sourceVisualEvidenceSchema,
  unknownSourceVisualEvidence,
  type SourceVisualEvidence,
} from "./source-visual-evidence";
import {
  normalizeReview,
  normalizeSourceObservations,
  sourceReviewFacts,
} from "./source-review";

const evidence = (): SourceVisualEvidence => ({
  version: 1,
  sourceDuration: 4,
  coverage: "complete",
  reviewedRanges: [{ start: 0, end: 4 }],
  regions: [
    {
      id: "prop",
      start: 1,
      end: 3,
      kind: "text",
      rect: { x: 0.3, y: 0.45, width: 0.4, height: 0.2 },
      confidence: 0.9,
    },
  ],
  observedText: [
    {
      id: "score",
      start: 1,
      end: 3,
      text: "9–12",
      confidence: 0.95,
      regionId: "prop",
    },
  ],
});

describe("versioned source visual evidence", () => {
  it("does not upgrade old/unknown analysis to spatially reviewed footage", () => {
    for (const old of [
      undefined,
      {},
      { regions: [] },
      { version: 2 },
      { version: 1, coverage: "complete", regions: [] },
    ])
      expect(normalizeSourceVisualEvidence(old, 4)).toEqual(
        unknownSourceVisualEvidence()
      );
    expect(
      normalizeReview({ captions: "present" }, 4).visualProtection?.coverage
    ).toBe("unknown");
  });
  it("preserves source-clock text/boxes independently from editorial content", () => {
    const normalized = normalizeSourceVisualEvidence(evidence(), 4);
    expect(normalized).toEqual(evidence());
    expect(normalizeSourceVisualEvidence(normalized)).toEqual(normalized);
    expect(normalizeSourceVisualEvidence(evidence(), 5)).toEqual(
      unknownSourceVisualEvidence()
    );
    const partial = evidence();
    partial.coverage = "unknown";
    partial.reviewedRanges = [];
    expect(normalizeSourceVisualEvidence(partial, 4)).toMatchObject({
      coverage: "unknown",
      regions: evidence().regions,
      observedText: evidence().observedText,
    });
  });
  it("needs continuous measured coverage before treating empty regions as reviewed clear", () => {
    const input = evidence();
    input.regions = [];
    input.observedText = [];
    input.reviewedRanges = [
      { start: 0, end: 1 },
      { start: 2, end: 4 },
    ];
    expect(normalizeSourceVisualEvidence(input).coverage).toBe("partial");
    input.reviewedRanges = [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ];
    expect(normalizeSourceVisualEvidence(input).coverage).toBe("complete");
    input.coverage = "unknown";
    expect(normalizeSourceVisualEvidence(input).coverage).toBe("unknown");
  });
  it.each([
    { rect: { x: -0.1, y: 0, width: 0.2, height: 0.2 } },
    { rect: { x: 0.8, y: 0, width: 0.3, height: 0.2 } },
    { rect: { x: 0, y: 0, width: 0, height: 0.2 } },
    { end: 4.1 },
    { start: 3 },
    { confidence: NaN },
    { kind: "guessed" },
  ])(
    "invalid regions cannot silently become verified empty space: %j",
    patch => {
      const input = evidence();
      Object.assign(input.regions[0], patch);
      const normalized = normalizeSourceVisualEvidence(input);
      expect(normalized.coverage).toBe("unknown");
      expect(normalized.regions).toEqual([]);
      expect(normalized.observedText).toEqual([
        { id: "score", start: 1, end: 3, text: "9–12", confidence: 0.95 },
      ]);
    }
  );
  it("rejects duplicate IDs and oversized spatial reports without certifying a truncated clear area", () => {
    const input = evidence();
    input.regions.push({ ...input.regions[0] });
    expect(normalizeSourceVisualEvidence(input).coverage).toBe("unknown");
    input.regions = Array.from({ length: 121 }, (_, i) => ({
      ...input.regions[0],
      id: `r${i}`,
    }));
    expect(normalizeSourceVisualEvidence(input).coverage).toBe("unknown");
  });
  it("provider schema accepts explicit unknown without fabricating boxes", () => {
    const schema = fromJSONSchema(sourceVisualEvidenceSchema(4));
    expect(
      schema.safeParse({ ...unknownSourceVisualEvidence(), sourceDuration: 4 })
        .success
    ).toBe(true);
    expect(
      schema.safeParse({
        ...evidence(),
        observedText: [{ ...evidence().observedText[0], regionId: "prop" }],
      }).success
    ).toBe(true);
    expect(schema.safeParse({ ...evidence(), sourceDuration: 5 }).success).toBe(
      false
    );
  });
});

describe("observations are separate from analyzer proposals", () => {
  it("projects factual picture/audio and strips unsolicited recommendations and invented missing ranges", () => {
    const observations = normalizeSourceObservations(
      [
        {
          start: 1,
          end: 3,
          confidence: 0.9,
          visualEvidence: "Physical label reads 9–12",
          audioEvidence: "Audio unavailable",
          improvement: "Add missing 5–8",
          rationale: "Add a diagnostic disclaimer",
          strength: "Repeat the score",
          roleReason: "Add a warning",
        },
      ],
      4
    );
    const result = sourceReviewFacts({
      assetId: "source",
      reviewedAt: "today",
      summary: "Add a fact-check card",
      ...normalizeReview(
        { captions: "present", visualProtection: evidence() },
        4
      ),
      observations,
      moments: [
        { start: 0, end: 4, note: "Editorial interpretation: add missing 5–8" },
      ],
    });
    expect(result.moments[0].note).toContain("Physical label reads 9–12");
    expect(JSON.stringify(result)).not.toMatch(
      /missing|diagnostic|fact-check|Repeat|warning|improvement|rationale/
    );
    expect(result.visualProtection).toEqual(evidence());
  });
  it("does not launder legacy free-form notes into observed facts", () => {
    const result = sourceReviewFacts({
      assetId: "source",
      reviewedAt: "old",
      summary: "Add a disclaimer",
      ...normalizeReview({}),
      moments: [{ start: 0, end: 4, note: "Add a missing score" }],
    });
    expect(result.observations).toEqual([]);
    expect(result.moments).toEqual([]);
    expect(result.visualProtection?.coverage).toBe("unknown");
  });
});
