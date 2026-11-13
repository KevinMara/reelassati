/** Keep catalog observation generation structured at the provider boundary.
 * Runtime validators still verify identity, source samples and semantics. */
export function catalogReviewSchema(kind: "sound" | "visual", ids: string[]) {
  // Gemini's constrained decoder can reject nested array-length limits with a
  // bare INVALID_ARGUMENT. Keep provider constraints structural; exact IDs,
  // counts, string lengths and list bounds are checked before publication.
  const text = { type: "string" };
  const list = { type: "array", items: text };
  const properties =
    kind === "sound"
      ? {
          id: { type: "string" },
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
          id: { type: "string" },
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
        description: `One observation for each of the ${ids.length} supplied assets, with its exact id.`,
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
