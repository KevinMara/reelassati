import type { Asset } from "./workspace";

/** Source clocks stay separate from the destination timeline interval. */
export function assertSupportingMedia(
  asset: Asset | undefined,
  sourceIn: number,
  duration: number
): asserts asset is Asset {
  if (
    !asset ||
    asset.status !== "ready" ||
    !["image", "video", "export"].includes(asset.kind) ||
    !Number.isFinite(sourceIn) ||
    sourceIn < 0 ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    (asset.kind === "image"
      ? sourceIn !== 0
      : !asset.duration || sourceIn + duration > asset.duration + 0.001)
  )
    throw new Error(
      "The supporting media is unavailable or its requested source interval is outside the file."
    );
}
