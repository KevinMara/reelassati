import { describe, expect, it } from "vitest";
import { normalizeVideoInsights } from "./video-analysis";
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
      role: "other",
      attention: null,
      confidence: null,
    });
    expect(normalizeVideoInsights(undefined, 10)).toEqual([]);
    expect(normalizeVideoInsights([interval], NaN)).toEqual([]);
  });
});
