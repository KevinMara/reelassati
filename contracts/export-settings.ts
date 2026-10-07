export const exportResolutions = [720, 1080, 2160] as const;
export const exportFrameRates = [24, 25, 30, 60] as const;
export const exportFormats = ["mp4", "webm"] as const;
export type ExportResolution = (typeof exportResolutions)[number];
export type ExportFrameRate = (typeof exportFrameRates)[number];
export type ExportFormat = (typeof exportFormats)[number];
export interface ExportSettings {
  resolution: ExportResolution;
  frameRate: ExportFrameRate;
  format: ExportFormat;
}

/** Older projects and numeric-resolution callers retain their original defaults. */
export function resolveExportSettings(
  options: ExportResolution | Partial<ExportSettings> = 720,
  projectFrameRate?: ExportFrameRate
): ExportSettings {
  const value = typeof options === "number" ? { resolution: options } : options;
  const resolution = value.resolution ?? 720;
  const frameRate = value.frameRate ?? projectFrameRate ?? 30;
  const format = value.format ?? "mp4";
  if (
    !exportResolutions.includes(resolution) ||
    !exportFrameRates.includes(frameRate) ||
    !exportFormats.includes(format)
  )
    throw new Error(
      "Choose a supported export resolution, frame rate and format."
    );
  return { resolution, frameRate, format };
}

export function exportDimensions(
  aspectRatio: "9:16" | "16:9" | "1:1",
  resolution: ExportResolution
) {
  const landscape = Math.round((resolution * 16) / 9 / 2) * 2;
  return aspectRatio === "16:9"
    ? { width: landscape, height: resolution }
    : aspectRatio === "1:1"
      ? { width: resolution, height: resolution }
      : { width: resolution, height: landscape };
}

export function exportFileType(format: ExportFormat) {
  return format === "webm"
    ? { filename: "output.webm", mimeType: "video/webm", extension: "webm" }
    : { filename: "output.mp4", mimeType: "video/mp4", extension: "mp4" };
}
