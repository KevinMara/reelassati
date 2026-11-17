import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { NativeFrameProgram } from "@contracts/native-frame-program";
import { renderNativeFrameSequence } from "./native-frame-sequence";

/** Encode a graph using the already leased export engine. RGB lossless chunks
 * keep intermediate picture fidelity; the ordinary project export owns the
 * final codec, captions and audio. Raw-frame memory is bounded independently
 * of effect duration. Never opens an extra engine or background task. */
export async function encodeNativeFrameProgram(
  ffmpeg: Pick<FFmpeg, "writeFile" | "deleteFile" | "exec">,
  program: NativeFrameProgram,
  size: { width: number; height: number },
  options: Omit<
    Parameters<typeof renderNativeFrameSequence>[2],
    "format" | "writeFrame"
  > & { prefix: string }
) {
  if (!/^[a-z0-9_-]{1,64}$/i.test(options.prefix))
    throw new Error("Invalid native render file prefix");
  const prefix = options.prefix,
    frameBytes = size.width * size.height * 3;
  if (
    !Number.isSafeInteger(frameBytes) ||
    frameBytes < 3 ||
    frameBytes > 64_000_000
  )
    throw new Error("Invalid native render frame size");
  const batchFrames = Math.max(
    1,
    Math.min(30, Math.floor(24_000_000 / frameBytes))
  );
  const chunks: string[] = [],
    owned = new Set<string>(),
    output = `${prefix}.mkv`;
  let batch: Uint8Array[] = [],
    completed = false;
  const remove = async (name: string) => {
    try {
      await ffmpeg.deleteFile(name);
    } catch {
      /* Engine termination also releases its filesystem. */
    }
    owned.delete(name);
  };
  const flush = async () => {
    if (!batch.length) return;
    options.signal.throwIfAborted();
    const raw = `${prefix}-raw.rgb`,
      chunk = `${prefix}-${chunks.length}.mkv`;
    const data = new Uint8Array(frameBytes * batch.length);
    batch.forEach((frame, i) => data.set(frame, i * frameBytes));
    const count = batch.length;
    batch = [];
    owned.add(raw);
    owned.add(chunk);
    await ffmpeg.writeFile(raw, data);
    const code = await ffmpeg.exec([
      "-v",
      "error",
      "-y",
      "-f",
      "rawvideo",
      "-pixel_format",
      "rgb24",
      "-video_size",
      `${size.width}x${size.height}`,
      "-framerate",
      String(program.fps),
      "-i",
      raw,
      "-frames:v",
      String(count),
      "-an",
      "-c:v",
      "libx264rgb",
      "-crf",
      "0",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "rgb24",
      chunk,
    ]);
    options.signal.throwIfAborted();
    if (code !== 0)
      throw new Error("The native effect intermediate could not be encoded");
    chunks.push(chunk);
    await remove(raw);
  };
  try {
    await renderNativeFrameSequence(program, size, {
      ...options,
      format: "rgb24",
      writeFrame: async (frame, data) => {
        if (data.length !== frameBytes)
          throw new Error("Incomplete native frame");
        batch.push(data);
        if (batch.length >= batchFrames || frame === program.frames - 1)
          await flush();
      },
    });
    const list = `${prefix}-chunks.txt`;
    owned.add(list);
    owned.add(output);
    await ffmpeg.writeFile(
      list,
      chunks.map(file => `file '${file}'`).join("\n") + "\n"
    );
    const code = await ffmpeg.exec([
      "-v",
      "error",
      "-y",
      "-f",
      "concat",
      "-safe",
      "1",
      "-i",
      list,
      "-map",
      "0:v:0",
      "-c",
      "copy",
      output,
    ]);
    options.signal.throwIfAborted();
    if (code !== 0)
      throw new Error("The native effect chunks could not be assembled");
    completed = true;
    return {
      filename: output,
      frames: program.frames,
      fps: program.fps,
      duration: program.frames / program.fps,
      width: size.width,
      height: size.height,
    };
  } finally {
    batch = [];
    for (const name of owned)
      if (!completed || name !== output) await remove(name);
  }
}
