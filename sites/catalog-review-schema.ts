/** Keep catalog observation generation structured at the provider boundary.
 * Runtime validators still verify identity, source samples and semantics. */
export function catalogReviewSchema(kind: "sound" | "visual", ids: string[]) {
  const text = { type: "string", minLength: 1, maxLength: 600 };
  const list = { type: "array", maxItems: 8, items: text };
  const properties =
    kind === "sound"
      ? {
          id: { type: "string", enum: ids },
          character: text,
          role: {
            type: "string",
            enum: ["music", "effect", "ambience", "speech", "mixed", "unclear"],
          },
          audibleEvents: list,
          suitableUses: list,
          avoidUses: list,
          containsSpeech: { type: "boolean" },
          intensity: { type: "string", enum: ["subtle", "moderate", "strong"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        }
      : {
          id: { type: "string", enum: ids },
          description: text,
          visibleElements: list,
          sampledChanges: list,
          composition: text,
          suitableUses: list,
          avoidUses: list,
          visibleText: list,
          confidence: { type: "number", minimum: 0, maximum: 1 },
        };
  const key = kind === "sound" ? "sounds" : "visuals";
  return {
    type: "object",
    additionalProperties: false,
    required: [key],
    properties: {
      [key]: {
        type: "array",
        minItems: ids.length,
        maxItems: ids.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: Object.keys(properties),
          properties,
        },
      },
    },
  };
}
