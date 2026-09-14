/** Validate the encoded file's metadata, never substitute the requested render settings. */
export function verifyExportMetadata(
  value: unknown,
  expected: { width: number; height: number; duration: number }
): { width: number; height: number; duration: number } {
  const probe =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const streams = Array.isArray(probe.streams) ? probe.streams : [];
  const video = streams.find(s => s && s.codec_type === "video");
  const format =
    probe.format && typeof probe.format === "object"
      ? (probe.format as Record<string, unknown>)
      : {};
  const duration = Number(format.duration);
  const videoDuration = Number(video?.duration);
  if (
    !video ||
    video.codec_name !== "h264" ||
    video.width !== expected.width ||
    video.height !== expected.height ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(videoDuration) ||
    videoDuration <= 0 ||
    Math.abs(duration - expected.duration) > 0.15 ||
    Math.abs(videoDuration - expected.duration) > 0.15
  ) {
    throw new Error(
      "The exported video did not pass its duration and picture checks. Your project is saved; please retry export."
    );
  }
  return { width: video.width, height: video.height, duration };
}
