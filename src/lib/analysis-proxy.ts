import {
  MAX_ANALYSIS_FRAMES,
  sameAnalysisVideoTiming,
  type AnalysisVideoTiming,
} from "@contracts/analysis-proxy";

export const ANALYSIS_DIRECT_BYTES = 20 * 1024 * 1024;
export const ANALYSIS_PROXY_BYTES = 20 * 1024 * 1024;

export interface AnalysisSourceMetadata extends AnalysisVideoTiming {
  hasAudio: boolean;
  audioCodec: string | null;
  audioBitrate: number | null;
}

const ratio = (value: unknown, fallback = 1) => {
  const parts = String(value ?? "")
    .split(/[:/]/)
    .map(Number);
  return parts.length === 2 && parts[0] > 0 && parts[1] > 0
    ? parts[0] / parts[1]
    : fallback;
};

/** Inspect actual encoded input metadata; uploaded names and guessed durations are insufficient. */
export function readAnalysisSourceMetadata(
  value: unknown
): AnalysisSourceMetadata {
  if (!value || typeof value !== "object" || "error" in value)
    throw new Error("The source video could not be inspected.");
  const report = value as {
    format?: { duration?: unknown };
    streams?: unknown;
    frames?: unknown;
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
  const rotation =
    ((Number(
      video.side_data_list?.find(
        (item: { rotation?: unknown }) => item.rotation !== undefined
      )?.rotation ??
        video.tags?.rotate ??
        0
    ) %
      360) +
      360) %
    360;
  if (![0, 90, 180, 270].includes(rotation))
    throw new Error("The source video rotation could not be verified.");
  let displayAspect =
    (Number(video.width) * ratio(video.sample_aspect_ratio)) /
    Number(video.height);
  if (rotation === 90 || rotation === 270) displayAspect = 1 / displayAspect;
  const frames = Array.isArray(report.frames) ? report.frames : [];
  if (!frames.length || frames.length > MAX_ANALYSIS_FRAMES)
    throw new Error(
      "The source video's complete frame timing could not be inspected."
    );
  const frameTimes = Float64Array.from(frames, frame =>
    Number(frame.best_effort_timestamp_time)
  );
  if (
    frameTimes.some(
      (time, index) =>
        !Number.isFinite(time) ||
        time < -0.002 ||
        (index > 0 && time <= frameTimes[index - 1])
    )
  )
    throw new Error(
      "The source video's presentation cadence could not be verified."
    );
  const audio = streams.find(stream => stream?.codec_type === "audio");
  const lastFrame = frames[frames.length - 1];
  const lastFrameDuration = Number(
    lastFrame.pkt_duration_time ?? lastFrame.duration_time
  );
  const videoDuration = Number.isFinite(Number(video.duration))
    ? Number(video.duration) + Number(video.start_time ?? 0)
    : frameTimes[frameTimes.length - 1] + lastFrameDuration;
  const audioDuration = audio
    ? Number(audio.duration ?? duration) + Number(audio.start_time ?? 0)
    : null;
  if (
    !(videoDuration > 0) ||
    !Number.isFinite(videoDuration) ||
    (audioDuration !== null && !(audioDuration > 0))
  )
    throw new Error("The source stream durations could not be inspected.");
  return {
    duration,
    hasAudio: Boolean(audio),
    audioCodec: typeof audio?.codec_name === "string" ? audio.codec_name : null,
    audioBitrate:
      Number.isFinite(Number(audio?.bit_rate)) && Number(audio?.bit_rate) > 0
        ? Number(audio.bit_rate)
        : null,
    width: Number(video.width),
    height: Number(video.height),
    displayAspect,
    rotation,
    videoDuration,
    audioDuration,
    frameTimes,
  };
}

export function analysisProxyVideoBitrate(
  source: Pick<AnalysisSourceMetadata, "duration" | "hasAudio"> &
    Partial<Pick<AnalysisSourceMetadata, "audioCodec" | "audioBitrate">>
): number {
  if (!Number.isFinite(source.duration) || source.duration <= 0)
    throw new Error("The source duration is unavailable.");
  // Reserve room for audio, MP4 overhead and bitrate variance; never truncate the tail to fit.
  const available =
    Math.floor((ANALYSIS_PROXY_BYTES * 8 * 0.88) / source.duration) -
    (source.hasAudio
      ? source.audioCodec === "aac"
        ? Math.ceil((source.audioBitrate ?? 256_000) * 1.05)
        : 48_000
      : 0);
  if (available < 48_000)
    throw new Error(
      "This video is too long for a usable full-length analysis copy within the provider's size limit. Choose a shorter source; no section has been discarded."
    );
  return Math.min(6_000_000, available);
}

export function analysisProxyDimensions(
  source: AnalysisSourceMetadata,
  videoBitrate = analysisProxyVideoBitrate(source)
) {
  const targetEdge = videoBitrate >= 1_200_000 ? 1080 : 720;
  const rotated = source.rotation === 90 || source.rotation === 270;
  const sourceHeight = rotated ? source.width : source.height;
  const longEdge = Math.min(
    targetEdge,
    sourceHeight * Math.max(1, source.displayAspect)
  );
  const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);
  return source.displayAspect >= 1
    ? { width: even(longEdge), height: even(longEdge / source.displayAspect) }
    : { width: even(longEdge * source.displayAspect), height: even(longEdge) };
}

/** Complete picture at the source cadence, without padding, seeking, trimming or frame filtering. */
export function analysisProxyArguments(
  source: AnalysisSourceMetadata,
  videoBitrate = analysisProxyVideoBitrate(source)
): string[] {
  if (!Number.isFinite(videoBitrate) || videoBitrate < 48_000)
    throw new Error("The analysis copy's video bitrate is too low.");
  const { width, height } = analysisProxyDimensions(source, videoBitrate);
  return [
    "-y",
    "-copyts",
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
    `scale=${width}:${height},setsar=1`,
    "-fps_mode",
    "passthrough",
    "-enc_time_base",
    "-1",
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
    // Preserve AAC packets and their priming/edit-list timing. The browser
    // core's older HE-AAC decoder can otherwise discard initial audio samples.
    ...(source.audioCodec === "aac"
      ? ["-c:a", "copy"]
      : ["-c:a", "aac", "-ac", "1", "-ar", "24000", "-b:a", "48000"]),
    "-movflags",
    "+faststart",
    "output.mp4",
  ];
}

type ProbeEngine = {
  ffprobe: (args: string[]) => Promise<number>;
  readFile: (path: string, encoding: "utf8") => Promise<string | Uint8Array>;
  deleteFile: (path: string) => Promise<boolean>;
};
let probeSequence = 0;

/** Decode every video frame in the installed browser engine, including variable-rate timestamps. */
export async function probeAnalysisVideo(
  engine: ProbeEngine,
  filename: string
): Promise<AnalysisSourceMetadata> {
  const path = `analysis-probe-${++probeSequence}.json`;
  const probe = async (args: string[]) => {
    await engine.deleteFile(path).catch(() => false);
    const code = await engine.ffprobe([
      "-v",
      "error",
      "-show_error",
      ...args,
      "-of",
      "json",
      filename,
      "-o",
      path,
    ]);
    if (code !== 0 && code !== -1)
      throw new Error("The video could not be inspected.");
    const text = await engine.readFile(path, "utf8");
    if (typeof text !== "string" || text.length > 64 * 1024 * 1024)
      throw new Error("The video metadata is unavailable.");
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || "error" in value)
      throw new Error("The video could not be inspected.");
    return value;
  };
  try {
    const metadata = await probe([
      "-select_streams",
      "",
      "-show_format",
      "-show_streams",
    ]);
    const timing = await probe([
      "-select_streams",
      "v:0",
      "-show_frames",
      "-show_entries",
      "frame=best_effort_timestamp_time,pkt_duration_time,duration_time",
    ]);
    // Some core builds retain ffprobe's show_streams option between calls.
    // The video-only timing probe must not replace the full audio/video inventory.
    return readAnalysisSourceMetadata({
      ...metadata,
      frames: (timing as { frames?: unknown }).frames,
    });
  } finally {
    await engine.deleteFile(path).catch(() => false);
  }
}

export function verifyAnalysisProxy(
  source: AnalysisSourceMetadata,
  proxy: AnalysisSourceMetadata
): void {
  if (!sameAnalysisVideoTiming(source, proxy))
    throw new Error(
      "The analysis copy did not preserve every source frame, presentation cadence, display aspect and full duration. Your original file is unchanged."
    );
}
