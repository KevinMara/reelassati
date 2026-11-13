/** Pixel policy for automatically selected fixed media. This bounds destruction
 * of source contrast; it does not certify semantic fit or predict readability. */
export const SUPPORTING_MEDIA_POLICY = Object.freeze({
  minimumRetainedContrast: 0.5,
  minimumAddedLoss: 0.05,
  minimumAffectedPixels: 4,
  affectedFraction: { text: 0.005, face: 0.02, demonstration: 0.02 },
});

export type SupportedProtectionBlend =
  "normal" | "screen" | "multiply" | "overlay";
export const supportsPixelProtection = (
  mode: string
): mode is SupportedProtectionBlend =>
  ["normal", "screen", "multiply", "overlay"].includes(mode);

/** Lower bound on d(output)/d(lower source), per straight sRGB channel. All
 * four modes are monotone; their lower derivative bounds compose by product. */
export function retainedSourceContrast(
  mode: SupportedProtectionBlend,
  channel: number,
  alpha: number
) {
  const s = channel / 255,
    a = alpha / 255;
  switch (mode) {
    case "normal":
      return 1 - a;
    case "screen":
      return 1 - a * s;
    case "multiply":
      return 1 - a * (1 - s);
    case "overlay":
      return 1 - a * Math.abs(2 * s - 1);
  }
}

export interface ProtectedMediaRegion {
  sourceClipId: string;
  regionId: string;
  kind: "text" | "face" | "demonstration";
  sourceOrder: number;
  rect: { x: number; y: number; width: number; height: number };
}
export interface DecodedProtectionLayer {
  clipId: string;
  /** Absent for pre-existing media: it affects the baseline, never gets removed. */
  operationId?: string;
  order: number;
  blendMode: SupportedProtectionBlend;
  rgba: Uint8Array;
}
export interface SupportingMediaFinding {
  operationId: string;
  clipId: string;
  sourceClipId?: string;
  regionId?: string;
  time?: number;
  reason:
    | "source-obscured"
    | "unknown-source-layout"
    | "unverified-pixels"
    | "resource-limit";
  detail: string;
  affectedFraction?: number;
}

/** Every input pixel is already at delivery geometry after the real renderer's
 * transforms. Never downsample or estimate alpha from file extension/metadata. */
export function inspectSupportingMediaFrame(
  canvas: { width: number; height: number },
  time: number,
  regions: readonly ProtectedMediaRegion[],
  layers: readonly DecodedProtectionLayer[],
  checkpoint: () => void = () => undefined
): SupportingMediaFinding[] {
  const { width, height } = canvas;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    layers.some(
      layer =>
        layer.rgba.length !== width * height * 4 ||
        !supportsPixelProtection(layer.blendMode)
    )
  )
    throw new Error("Incomplete or unsupported rendered overlay pixels.");
  const findings: SupportingMediaFinding[] = [];
  for (const region of regions) {
    checkpoint();
    const relevant = layers.filter(layer => layer.order > region.sourceOrder);
    if (!relevant.some(layer => layer.operationId)) continue;
    const left = Math.max(0, Math.floor(region.rect.x));
    const top = Math.max(0, Math.floor(region.rect.y));
    const right = Math.min(width, Math.ceil(region.rect.x + region.rect.width));
    const bottom = Math.min(
      height,
      Math.ceil(region.rect.y + region.rect.height)
    );
    const pixels = Math.max(0, right - left) * Math.max(0, bottom - top);
    if (!pixels) continue;
    let affected = 0;
    const contributors = new Map<string, string>();
    for (let y = top; y < bottom; y++) {
      if (y % 32 === 0) checkpoint();
      for (let x = left; x < right; x++) {
        const offset = (y * width + x) * 4;
        let unsafe = false;
        for (let channel = 0; channel < 3; channel++) {
          let baseline = 1,
            composed = 1;
          for (const layer of relevant) {
            const retention = retainedSourceContrast(
              layer.blendMode,
              layer.rgba[offset + channel],
              layer.rgba[offset + 3]
            );
            composed *= retention;
            if (!layer.operationId) baseline *= retention;
          }
          if (
            composed <= SUPPORTING_MEDIA_POLICY.minimumRetainedContrast &&
            baseline - composed >= SUPPORTING_MEDIA_POLICY.minimumAddedLoss
          )
            unsafe = true;
        }
        if (!unsafe) continue;
        affected++;
        for (const layer of relevant) {
          if (!layer.operationId) continue;
          if (
            [0, 1, 2].some(
              channel =>
                retainedSourceContrast(
                  layer.blendMode,
                  layer.rgba[offset + channel],
                  layer.rgba[offset + 3]
                ) < 0.999
            )
          )
            contributors.set(layer.operationId, layer.clipId);
        }
      }
    }
    if (
      affected <
      Math.max(
        SUPPORTING_MEDIA_POLICY.minimumAffectedPixels,
        Math.ceil(
          pixels * SUPPORTING_MEDIA_POLICY.affectedFraction[region.kind]
        )
      )
    )
      continue;
    for (const [operationId, clipId] of contributors)
      findings.push({
        operationId,
        clipId,
        sourceClipId: region.sourceClipId,
        regionId: region.regionId,
        time,
        reason: "source-obscured",
        affectedFraction: affected / pixels,
        detail: `Rendered supporting media substantially reduces contrast over protected ${region.kind}.`,
      });
  }
  return findings;
}
