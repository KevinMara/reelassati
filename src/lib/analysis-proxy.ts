export const ANALYSIS_DIRECT_BYTES = 20 * 1024 * 1024;
export const ANALYSIS_PROXY_BYTES = 20 * 1024 * 1024;
export const ANALYSIS_PROXY_FPS = 8;
export const ANALYSIS_PROXY_SIDE = 360;

export interface AnalysisSourceMetadata {
  duration: number;
  hasAudio: boolean;
}

/** Inspect actual encoded input metadata; uploaded names and guessed durations are insufficient. */
export function readAnalysisSourceMetadata(
  value: unknown
): AnalysisSourceMetadata {
  if (!value || typeof value !== "object" || "error" in value)
    throw new Error("The source video could not be inspected.");
  const report = value as {
    format?: { duration?: unknown };
    streams?: unknown;
  };
  const streams = Array.isArray(report.streams) ? report.streams : [];
  const video = streams.find(stream => stream?.codec_type === "video");
  const duration = Number(report.format?.duration ?? video?.duration);
  if (
    !video ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(Number(video.width)) ||
    Number(video.width) <= 0 ||
    !Number.isFinite(Number(video.height)) ||
    Number(video.height) <= 0
  )
    throw new Error("The source video has no readable picture or duration.");
  if (duration > 30 * 60)
    throw new Error(
      "Full-length video analysis currently supports sources up to 30 minutes. Choose a shorter source; no section has been discarded."
    );
  return {
    duration,
    hasAudio: streams.some(stream => stream?.codec_type === "audio"),
  };
}

export function analysisProxyVideoBitrate(
  source: AnalysisSourceMetadata
): number {
  if (!Number.isFinite(source.duration) || source.duration <= 0)
    throw new Error("The source duration is unavailable.");
  // Reserve room for audio, MP4 overhead and bitrate variance; never truncate the tail to fit.
  const available =
    Math.floor((ANALYSIS_PROXY_BYTES * 8 * 0.88) / source.duration) -
    (source.hasAudio ? 48_000 : 0);
  if (available < 48_000)
    throw new Error(
      "This video is too long for a usable full-length analysis copy within the provider's size limit. Choose a shorter source; no section has been discarded."
    );
  return Math.min(650_000, available);
}

/** A complete, letterboxed source at 8 fps with its complete audio. No seek, trim or shortest flag. */
export function analysisProxyArguments(
  source: AnalysisSourceMetadata,
  videoBitrate = analysisProxyVideoBitrate(source)
): string[] {
  if (!Number.isFinite(videoBitrate) || videoBitrate < 48_000)
    throw new Error("The analysis copy's video bitrate is too low.");
  return [
    "-y",
    "-i",
    "/source/media",
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-map_metadata",
    "-1",
    "-map_chapters",
    "-1",
    "-vf",
    `scale=w='if(gte(dar,1),${ANALYSIS_PROXY_SIDE},max(2,trunc(${ANALYSIS_PROXY_SIDE}*dar/2)*2))':h='if(gte(dar,1),max(2,trunc(${ANALYSIS_PROXY_SIDE}/dar/2)*2),${ANALYSIS_PROXY_SIDE})',setsar=1,pad=${ANALYSIS_PROXY_SIDE}:${ANALYSIS_PROXY_SIDE}:(ow-iw)/2:(oh-ih)/2,fps=${ANALYSIS_PROXY_FPS}`,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-b:v",
    String(Math.floor(videoBitrate)),
    "-maxrate",
    String(Math.floor(videoBitrate)),
    "-bufsize",
    String(Math.floor(videoBitrate * 2)),
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-ac",
    "1",
    "-ar",
    "24000",
    "-b:a",
    "48000",
    "-movflags",
    "+faststart",
    "output.mp4",
  ];
}
