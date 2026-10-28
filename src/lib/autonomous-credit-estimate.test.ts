import { expect, it } from "vitest";
import { AI_CREDIT_COSTS, videoCreditCost } from "@contracts/billing";
import type { EditOperation } from "@contracts/workspace";
import { autonomousCreditEstimate } from "./autonomous-credit-estimate";
const shot = (parameters: EditOperation["parameters"]) =>
  ({ type: "broll", parameters }) as EditOperation;
it("prices required and optional planned media at the real tariffs", () => {
  const result = autonomousCreditEstimate(
    [
      shot({ prompt: "diagram", mediaKind: "image" }),
      shot({ prompt: "cutaway", mediaKind: "video", optional: true }),
      shot({ assetId: "owned", prompt: "reuse", mediaKind: "image" }),
    ],
    15
  );
  expect(result).toEqual({
    minimum: 15 + AI_CREDIT_COSTS.image1K,
    maximum:
      15 +
      AI_CREDIT_COSTS.image1K +
      videoCreditCost({
        duration: 5,
        resolution: "720p",
        generateAudio: false,
        continuation: false,
      }),
    images: 1,
    videos: 1,
  });
});
it("does not invent uncertainty or limit the model's media count", () => {
  const result = autonomousCreditEstimate(
    Array.from({ length: 12 }, () =>
      shot({ prompt: "shot", mediaKind: "image" })
    ),
    5
  );
  expect(result.images).toBe(12);
  expect(result.minimum).toBe(5 + 12 * AI_CREDIT_COSTS.image1K);
  expect(result.maximum).toBe(result.minimum);
});
