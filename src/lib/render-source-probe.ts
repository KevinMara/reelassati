import type { TimelineClip } from "@contracts/workspace";

type ProbeEngine = {
  ffprobe: (args: string[]) => Promise<number>;
  readFile: (path: string, encoding: "utf8") => Promise<string | Uint8Array>;
  deleteFile: (path: string) => Promise<boolean>;
};

export interface RenderSourceMetadata {
  hasAudio: boolean;
  /** Only present after decoding the terminal video frames in this render. */
  terminalVideo?: {
    lastFrameStart: number;
    videoEnd: number;
    sourceEnd: number;
  };
}

const MAX_TERMINAL_MISMATCH = 0.25;
const TIME_TOLERANCE = 0.0001;
let sequence = 0;
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const numeric = (value: unknown) =>
  typeof value === "number" || (typeof value === "string" && value.trim())
    ? Number(value)
    : NaN;

async function report(engine: ProbeEngine, filename: string, args: string[]) {
  const path = `source-probe-${++sequence}.json`;
  try {
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
    // The shipped 0.12.10 core leaves ffprobe's success return at -1.
    // A fresh, parseable report without an error is required in either case.
    if (code !== 0 && code !== -1) throw new Error("Source probe failed");
    const json = await engine.readFile(path, "utf8");
    if (typeof json !== "string") throw new Error("Missing source probe");
    const value = object(JSON.parse(json));
    if (!Object.keys(value).length || "error" in value)
      throw new Error("Invalid source probe");
    return value;
  } finally {
    await engine.deleteFile(path).catch(() => false);
  }
}

/** Header metadata never authorizes a hold by itself. Seek near the final second
 * for a small audio/video mismatch (decoding may start at an earlier keyframe),
 * then require the last frame to reach the declared video end. Unknown timing
 * and truncated streams opt out. */
export async function probeRenderSource(
  engine: ProbeEngine,
  filename: string
): Promise<RenderSourceMetadata> {
  const metadata = await report(engine, filename, [
    "-show_streams",
    "-show_format",
  ]);
  if (!Array.isArray(metadata.streams))
    throw new Error("Missing source streams");
  const streams = metadata.streams.map(object);
  const video = streams.find(stream => stream.codec_type === "video");
  const audio = streams.find(stream => stream.codec_type === "audio");
  const result: RenderSourceMetadata = { hasAudio: Boolean(audio) };
  if (!video || !audio) return result;
  const videoEnd = numeric(video.duration);
  const audioEnd = numeric(audio.duration);
  const containerEnd = numeric(object(metadata.format).duration);
  // This deliberately excludes shifted/unknown stream clocks and containers
  // whose extra duration is unrelated to the first audio stream being rendered.
  if (
    ![videoEnd, audioEnd, containerEnd].every(Number.isFinite) ||
    videoEnd <= 0 ||
    Math.abs(numeric(video.start_time)) > TIME_TOLERANCE ||
    Math.abs(numeric(audio.start_time)) > TIME_TOLERANCE ||
    !Number.isFinite(numeric(video.start_time)) ||
    !Number.isFinite(numeric(audio.start_time)) ||
    Math.abs(audioEnd - containerEnd) > 0.002
  )
    return result;
  const sourceEnd = Math.min(audioEnd, containerEnd);
  const mismatch = sourceEnd - videoEnd;
  if (mismatch <= TIME_TOLERANCE || mismatch > MAX_TERMINAL_MISMATCH)
    return result;
  const tail = await report(engine, filename, [
    "-select_streams",
    "v:0",
    "-read_intervals",
    `${Math.max(0, videoEnd - 1).toFixed(6)}%`,
    "-show_frames",
    "-show_entries",
    "frame=best_effort_timestamp_time,pkt_duration_time,duration_time",
  ]);
  if (!Array.isArray(tail.frames) || !tail.frames.length) return result;
  const last = object(tail.frames.at(-1));
  const lastFrameStart = numeric(last.best_effort_timestamp_time);
  const frameDuration = numeric(last.duration_time ?? last.pkt_duration_time);
  if (
    !Number.isFinite(lastFrameStart) ||
    lastFrameStart < 0 ||
    !Number.isFinite(frameDuration) ||
    frameDuration <= 0 ||
    frameDuration > MAX_TERMINAL_MISMATCH ||
    Math.abs(lastFrameStart + frameDuration - videoEnd) > 0.002
  )
    return result;
  return { ...result, terminalVideo: { lastFrameStart, videoEnd, sourceEnd } };
}

/** Applied before visual animation/fades and clipped again to the exact clip
 * duration. Overlay EOF policy stays pass-through, including all timeline gaps. */
export function terminalVideoPadding(
  clip: Pick<TimelineClip, "inPoint" | "duration" | "speed">,
  metadata: RenderSourceMetadata | undefined,
  frameRate: number
): string {
  const tail = metadata?.terminalVideo;
  const speed = clip.speed ?? 1;
  const end = clip.inPoint + clip.duration * speed;
  if (
    !tail ||
    ![
      tail.lastFrameStart,
      tail.videoEnd,
      tail.sourceEnd,
      end,
      speed,
      frameRate,
    ].every(Number.isFinite) ||
    speed <= 0 ||
    frameRate <= 0 ||
    tail.lastFrameStart < 0 ||
    tail.lastFrameStart >= tail.videoEnd ||
    tail.sourceEnd <= tail.videoEnd ||
    tail.sourceEnd - tail.videoEnd > MAX_TERMINAL_MISMATCH ||
    // Match the render plan's source-trim precision. A rounded in-point beyond
    // the actual last decoded frame leaves no frame that can safely be held.
    Number(clip.inPoint.toFixed(4)) > tail.lastFrameStart ||
    end <= tail.videoEnd + TIME_TOLERANCE ||
    end > tail.sourceEnd + TIME_TOLERANCE
  )
    return "";
  // Use a finite padding budget followed immediately by the exact local end.
  // A shortfall-only budget is unsafe: trim/STARTPTS and fps can remove a partial
  // input frame, amplified at slow speed. This does not assume constant frame
  // rate, and neither the trim nor the half-open overlay can extend the clip.
  const duration = clip.duration.toFixed(6);
  // fps uses a frame-sized timebase; restore microseconds before trim so a
  // fractional-frame end is not rounded down and dropped prematurely.
  return `tpad=stop_mode=clone:stop_duration=${duration},settb=AVTB,trim=duration=${duration},`;
}
