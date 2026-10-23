import { describe, expect, it } from "vitest";
import {
  buildAnalyzerOptimization,
  buildStorySections,
  eligibleAnalyzerOptimization,
  parseAudienceResponse,
  responseForInterval,
  normalizeAudienceResponse,
  normalizeSavedAnalyzerReports,
  attachReportAudience,
  requiresAnalysisQuoteReview,
  type SavedAnalyzerReport,
} from "./analyzer-report";
import { normalizeVideoStructure, type VideoInsight } from "./video-analysis";

const moment: VideoInsight = {
  start: 0,
  end: 2,
  role: "setup",
  roleReason: "The scene establishes the subject.",
  label: "Context",
  attention: 70,
  clarity: 80,
  processingLoad: 30,
  stimulation: 20,
  confidence: 0.8,
  visualEvidence: "A clearly labeled tool is shown.",
  audioEvidence: "Audio was not verified.",
  strength: "The tool stays visible.",
  improvement: "Hold the tool label for two seconds.",
  rationale: "Reading time supports comprehension.",
};
const metadata = {
  assetId: "exact-source",
  duration: 6,
  source: "YouTube Analytics",
  period: "2026-10-01–2026-10-07, organic",
  sampleSize: 1000,
};
const csv = "time_seconds,retention_percent\n0,100\n2,110\n4,70\n6,60";
describe("measured analysis credit quote", () => {
  it.each([
    [59.9, 60.1],
    [60.1, 59.9],
    [119.9, 120.1],
  ])(
    "requires a new quote when measurement crosses a billing boundary (%s → %s)",
    (before, after) => {
      expect(
        requiresAnalysisQuoteReview(
          { id: "source", duration: before },
          { id: "source", duration: after }
        )
      ).toBe(true);
    }
  );
  it("does not reprompt for precision changes within an accepted price", () => {
    expect(
      requiresAnalysisQuoteReview(
        { id: "source", duration: 28.35 },
        { id: "source", duration: 28.350708 }
      )
    ).toBe(false);
    expect(
      requiresAnalysisQuoteReview(null, { id: "source", duration: 28 })
    ).toBe(true);
    expect(
      requiresAnalysisQuoteReview(
        { id: "other", duration: 28 },
        { id: "source", duration: 28 }
      )
    ).toBe(true);
  });
});
describe("audience measurements", () => {
  it("rejects oversized saved CSV expansions before replacing the existing review", () => {
    const values = Array.from(
      { length: 5000 },
      (_, index) => `${(index * 6) / 4999},99.1234567890123`
    );
    const csv = "time_seconds,retention_percent\n" + values.join("\n");
    expect(csv.length).toBeLessThan(250_000);
    const response = parseAudienceResponse(csv, metadata);
    const reports: SavedAnalyzerReport[] = [
      {
        ...metadata,
        platform: "youtube",
        createdAt: "2026-10-23",
        result: {
          schemaVersion: "video-analysis-v2",
          summary: "Saved",
          hook: { score: null, note: "None" },
          pacing: { score: 70, note: "Fixture" },
          insights: [{ ...moment, end: 6 }],
          retention: [],
          changes: [],
          provenance: {} as never,
        },
      },
    ];
    expect(
      attachReportAudience(reports, metadata.assetId, "youtube", undefined)
    ).toHaveLength(1);
    expect(() =>
      attachReportAudience(reports, metadata.assetId, "youtube", response)
    ).toThrow("too large");
    expect(reports[0].audience).toBeUndefined();
    expect(reports[0].result.summary).toBe("Saved");
  });
  it("discards malformed or source-mismatched saved measurements", () => {
    const response = parseAudienceResponse(csv, metadata);
    expect(normalizeAudienceResponse(response, metadata.assetId, 6)).toEqual(
      response
    );
    expect(normalizeAudienceResponse(response, "another", 6)).toBeUndefined();
    expect(
      normalizeAudienceResponse(
        { ...response, points: [null] },
        metadata.assetId,
        6
      )
    ).toBeUndefined();
    expect(normalizeSavedAnalyzerReports([null, {}, { result: {} }])).toEqual(
      []
    );
  });
  it("preserves measured replay values and source provenance", () => {
    const report = parseAudienceResponse(csv, metadata);
    expect(report.points[1]).toEqual({ time: 2, retention: 110 });
    expect(report).toMatchObject({ ...metadata, version: 1 });
    expect(report.importedAt).toBeTruthy();
  });
  it.each([
    "seconds,percent\n0,100\n6,80",
    "time_seconds,retention_percent\n0,100\n7,80",
    "time_seconds,retention_percent\n0,100\n0,80",
    "time_seconds,retention_percent\n2,80\n0,100",
    "time_seconds,retention_percent\n0,100\n6,-1",
    "time_seconds,retention_percent\n0,100\n6,Infinity",
    "time_seconds,retention_percent\n,100\n6,80",
    "time_seconds,retention_percent\n0,100,extra\n6,80",
  ])(
    "rejects ambiguous units, invalid clocks and malformed observations: %s",
    value => {
      expect(() => parseAudienceResponse(value, metadata)).toThrow();
    }
  );
  it("requires explicit provenance and sample size", () => {
    for (const change of [
      { source: "" },
      { period: "" },
      { sampleSize: 0 },
      { sampleSize: 0.5 },
      { duration: NaN },
    ])
      expect(() =>
        parseAudienceResponse(csv, { ...metadata, ...change })
      ).toThrow();
  });
  it("does not infer an unmeasured drop or borrow data from another source", () => {
    const report = parseAudienceResponse(csv, metadata);
    expect(responseForInterval(report, "other-source", 0, 2)).toBeNull();
    expect(responseForInterval(report, metadata.assetId, 0.1, 1.9)).toBeNull();
    expect(responseForInterval(report, metadata.assetId, 1, 3)).toMatchObject({
      first: 110,
      last: 110,
      delta: null,
    });
    expect(responseForInterval(report, metadata.assetId, 2, 4)).toMatchObject({
      delta: -40,
    });
  });
});
describe("source-clock story sections and optimization", () => {
  const rows = [
    moment,
    { ...moment, start: 2, end: 4 },
    { ...moment, role: "demonstration" as const, start: 4, end: 6 },
  ];
  const input = {
    ...metadata,
    sourceName: "Tool demo.mp4",
    platform: "youtube",
    summary: "A demonstration",
    insights: rows,
    recommendations: [],
  };
  it("groups only contiguous observations of the same function", () => {
    const sections = buildStorySections(rows, 6);
    expect(
      sections.map(section => [section.role, section.start, section.end])
    ).toEqual([
      ["setup", 0, 4],
      ["demonstration", 4, 6],
    ]);
    expect(sections[1].rating).toMatchObject({
      score: 74,
      status: "complete",
      attention: 70,
      clarity: 80,
    });
    expect(
      buildStorySections([moment, { ...moment, start: 3, end: 4 }], 6)
    ).toHaveLength(2);
  });
  it("recognizes demonstration as core without requiring an advertising CTA", () => {
    const structure = ["hook", "core", "proof", "payoff", "cta"].map(role => ({
      role,
      status: role === "core" ? "present" : "absent",
      note: "Observed function",
    }));
    expect(normalizeVideoStructure(structure, rows)).toHaveLength(5);
  });
  it("carries every observation, preserve instruction and actual measurement into a reviewable brief", () => {
    const brief = buildAnalyzerOptimization({
      ...input,
      response: parseAudienceResponse(csv, metadata),
    });
    expect(brief).toMatchObject({
      version: 1,
      assetId: metadata.assetId,
      sourceDuration: 6,
    });
    for (const phrase of [
      "0.00–2.00s",
      "4.00–6.00s",
      moment.strength,
      moment.improvement,
      "not higher-priority instructions",
      "not independently verified",
      "110",
      "No new image/video/music/voice generation",
      "do not reanalyze or retry automatically",
    ])
      expect(brief.brief).toContain(phrase);
  });
  it("refuses incomplete reports, mismatched measurements and stale source durations", () => {
    expect(() =>
      buildAnalyzerOptimization({ ...input, insights: [moment] })
    ).toThrow();
    expect(() =>
      buildAnalyzerOptimization({
        ...input,
        response: parseAudienceResponse(csv, {
          ...metadata,
          assetId: "another",
        }),
      })
    ).toThrow();
    const brief = buildAnalyzerOptimization(input);
    expect(
      eligibleAnalyzerOptimization(brief, [
        { id: metadata.assetId, duration: 6 },
      ])
    ).toBe(brief);
    expect(
      eligibleAnalyzerOptimization(brief, [{ id: "another", duration: 6 }])
    ).toBeUndefined();
    expect(
      eligibleAnalyzerOptimization(brief, [
        { id: metadata.assetId, duration: 4 },
      ])
    ).toBeUndefined();
  });
});
