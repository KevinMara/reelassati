import { describe, expect, it } from "vitest";
import {
  analyzeVideoCompleteness,
  normalizeVideoInsights,
  normalizeVideoRecommendations,
  normalizeVideoStructure,
  scoreVideoInsights,
} from "./video-analysis";
const interval = {
  start: 0,
  end: 2,
  role: "hook",
  attention: 78,
  confidence: 0.8,
  visualEvidence: "The product result is visible",
  audioEvidence: "An explicit promise is spoken",
};
describe("source-time video evidence", () => {
  it("keeps evidenced roles and leaves unsupported channels unknown", () => {
    expect(normalizeVideoInsights([interval], 10)[0]).toMatchObject({
      role: "hook",
      attention: 78,
      stimulation: null,
      processingLoad: null,
      clarity: null,
    });
  });
  it("rejects out-of-source, overlapping and evidence-free intervals", () => {
    expect(
      normalizeVideoInsights(
        [
          interval,
          { ...interval, start: 1, end: 3 },
          { ...interval, start: 5, end: 11 },
          {
            ...interval,
            start: 4,
            end: 5,
            visualEvidence: "",
            audioEvidence: "",
          },
        ],
        10
      )
    ).toHaveLength(1);
  });
  it("never turns missing scores or a missing CTA into fabricated evidence", () => {
    const result = normalizeVideoInsights(
      [
        {
          ...interval,
          role: "unrecognized",
          attention: Infinity,
          confidence: 3,
        },
      ],
      10
    );
    expect(result[0]).toMatchObject({
      role: "unclassified",
      attention: null,
      confidence: null,
    });
    expect(normalizeVideoInsights(undefined, 10)).toEqual([]);
    expect(normalizeVideoInsights([interval], NaN)).toEqual([]);
  });
});

const completeInterval = {
  ...interval,
  label: "Specific opening promise",
  roleReason: "The opening promises a visible product result",
  stimulation: 40,
  processingLoad: 30,
  clarity: 80,
  strength: "The result and spoken promise align",
  improvement: "Name the time required rather than saying quickly",
  rationale: "A concrete promise removes ambiguity",
};
describe("complete multimodal editorial review", () => {
  it("does not score attention-only reports, missing evidence or source gaps", () => {
    const rows = normalizeVideoInsights([{ ...completeInterval, end: 10 }], 10);
    expect(
      scoreVideoInsights([{ ...rows[0], stimulation: null }], 10)
    ).toMatchObject({
      status: "incomplete",
      score: null,
      reason: "missing-channels",
    });
    expect(
      scoreVideoInsights([{ ...rows[0], roleReason: "" }], 10)
    ).toMatchObject({
      status: "incomplete",
      score: null,
      reason: "missing-evidence",
    });
    expect(scoreVideoInsights([{ ...rows[0], start: 0.5 }], 10)).toMatchObject({
      status: "incomplete",
      score: null,
      reason: "incomplete-coverage",
    });
    expect(
      analyzeVideoCompleteness(
        [
          { ...rows[0], start: 0, end: 5 },
          { ...rows[0], start: 4, end: 10 },
        ],
        10
      )
    ).toMatchObject({ complete: false, reason: "invalid-ranges" });
  });
  it("weights actual interval durations, penalizes load rather than rewarding it and keeps intensity descriptive", () => {
    const rows = normalizeVideoInsights(
      [
        {
          ...completeInterval,
          attention: 100,
          clarity: 100,
          processingLoad: 0,
          end: 2,
        },
        {
          ...completeInterval,
          role: "core",
          attention: 50,
          clarity: 50,
          processingLoad: 100,
          start: 2,
          end: 10,
        },
      ],
      10
    );
    const result = scoreVideoInsights(rows, 10);
    expect(result).toMatchObject({
      status: "complete",
      attention: 60,
      clarity: 60,
      processingLoad: 80,
      processingEase: 20,
      score: 52,
      coveragePercent: 100,
    });
    expect(
      scoreVideoInsights(
        rows.map(row => ({ ...row, stimulation: 100 })),
        10
      ).score
    ).toBe(result.score);
    expect(
      scoreVideoInsights(
        rows.map(row => ({ ...row, processingLoad: 0 })),
        10
      ).score
    ).toBe(68);
  });
  it("keeps legitimate missing story functions explicit and rejects a contradictory or omitted assessment", () => {
    const rows = normalizeVideoInsights([{ ...completeInterval, end: 10 }], 10);
    const structure = ["hook", "core", "proof", "payoff", "cta"].map(role => ({
      role,
      status: role === "hook" ? "present" : "absent",
      note:
        role === "hook"
          ? "Opening promise at 0:00"
          : "Not observed in the complete source",
    }));
    expect(normalizeVideoStructure(structure, rows)).toHaveLength(5);
    expect(normalizeVideoStructure(structure, rows).at(-1)).toMatchObject({
      role: "cta",
      status: "absent",
    });
    expect(normalizeVideoStructure(structure.slice(0, 4), rows)).toEqual([]);
    expect(
      normalizeVideoStructure(
        structure.map(row => ({ ...row, status: "absent" })),
        rows
      )
    ).toEqual([]);
    expect(normalizeVideoStructure([...structure, structure[0]], rows)).toEqual(
      []
    );
  });
  it("keeps reshoot recommendations distinct and rejects out-of-source or evidence-free suggestions", () => {
    const recommendation = {
      start: 1,
      end: 3,
      label: "Show the result",
      observation: "The product remains hidden while the result is discussed",
      action: "Reshoot with the result beside the speaker",
      reason: "The spoken claim needs matching visual proof",
      priority: "high",
      confidence: 0.8,
    };
    expect(normalizeVideoRecommendations([recommendation], 10)).toEqual([
      { ...recommendation, id: "recommendation-1" },
    ]);
    expect(
      normalizeVideoRecommendations(
        [
          { ...recommendation, end: 11 },
          { ...recommendation, observation: "" },
        ],
        10
      )
    ).toEqual([]);
  });
});
