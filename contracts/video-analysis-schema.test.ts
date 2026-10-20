import { describe, expect, it } from "vitest";
import { fromJSONSchema } from "zod";
import { videoAnalysisResponseSchema } from "./video-analysis";

describe("video review provider schema", () => {
  const schema = videoAnalysisResponseSchema(6, 4);
  const parameters = schema.properties.changes.items.properties.parameters;

  it("keeps nullable fit values without putting null into a string enum", () => {
    const fit = fromJSONSchema(parameters.properties.fit);
    for (const value of ["cover", "contain", null])
      expect(fit.safeParse(value).success).toBe(true);
    for (const value of ["stretch", "null", "", false, 0, {}, []])
      expect(fit.safeParse(value).success).toBe(false);

    const inspectEnums = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(inspectEnums);
      const row = node as Record<string, unknown>;
      if (Array.isArray(row.enum))
        expect(row.enum.every(value => typeof value === "string")).toBe(true);
      Object.values(row).forEach(inspectEnums);
    };
    inspectEnums(schema);
  });

  it("preserves four-channel evidence, full story structure and bounded source time", () => {
    const interval = schema.properties.insights.items;
    expect(interval.required).toEqual(
      expect.arrayContaining([
        "start",
        "end",
        "role",
        "roleReason",
        "attention",
        "stimulation",
        "processingLoad",
        "clarity",
        "confidence",
        "visualEvidence",
        "audioEvidence",
        "strength",
        "improvement",
        "rationale",
      ])
    );
    const time = fromJSONSchema(interval.properties.start);
    expect(time.safeParse(0).success).toBe(true);
    expect(time.safeParse(4).success).toBe(true);
    expect(time.safeParse(-1).success).toBe(false);
    expect(time.safeParse(4.01).success).toBe(false);
    const score = fromJSONSchema(interval.properties.attention);
    expect(score.safeParse(null).success).toBe(true);
    expect(score.safeParse(100).success).toBe(true);
    expect(score.safeParse(101).success).toBe(false);
    expect(schema.properties.structure).toMatchObject({
      minItems: 5,
      maxItems: 5,
    });
    expect(schema.additionalProperties).toBe(false);
    expect(parameters.additionalProperties).toBe(false);
  });
});
