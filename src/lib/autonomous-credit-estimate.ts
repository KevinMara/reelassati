import { AI_CREDIT_COSTS, videoCreditCost } from "@contracts/billing";
import type { EditOperation } from "@contracts/workspace";

/** A tariff-based forecast of the model's actual media plan, never a spending cap.
 * Only explicitly optional shots widen the range. Owned and stock assets are free. */
export function autonomousCreditEstimate(
  changes: readonly EditOperation[],
  preparation: number
) {
  const generated = changes.filter(
    op =>
      op.type === "broll" &&
      !op.parameters?.assetId &&
      typeof op.parameters?.prompt === "string" &&
      op.parameters.prompt.trim()
  );
  let minimum = preparation;
  let maximum = preparation;
  let images = 0;
  let videos = 0;
  for (const op of generated) {
    if (
      !op.parameters ||
      (op.parameters.mediaKind !== "image" &&
        op.parameters.mediaKind !== "video")
    )
      throw new Error("Choose a supported media kind.");
    const cost =
      op.parameters.mediaKind === "video"
        ? videoCreditCost({
            duration: 5,
            resolution: "720p",
            generateAudio: false,
            continuation: false,
          })
        : AI_CREDIT_COSTS.image1K;
    if (op.parameters.mediaKind === "image") images++;
    else videos++;
    maximum += cost;
    if (op.parameters.optional !== true) minimum += cost;
  }
  return { minimum, maximum, images, videos };
}
