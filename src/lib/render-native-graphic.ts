import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { TimelineClip } from "@contracts/workspace";
import { NativeGraphicRenderer } from "./native-graphic-renderer";

/** Transparent, lossless intermediate. The final export keeps ordinary layer
 * ordering and captions; the durable project keeps its editable graph controls. */
export async function renderNativeGraphic(
  ffmpeg: Pick<FFmpeg, "writeFile" | "deleteFile" | "exec">,
  clip: TimelineClip,
  options: {
    width: number;
    height: number;
    frameRate: number;
    prefix: string;
    signal: AbortSignal;
    onProgress: (frame: number, total: number) => void;
  }
) {
  if (!clip.graphic?.native || !/^[a-z0-9_-]{1,64}$/i.test(options.prefix))
    throw Error("Invalid animation export");
  const renderer = new NativeGraphicRenderer(),
    cancel = () => renderer.close();
  options.signal.throwIfAborted();
  options.signal.addEventListener("abort", cancel, { once: true });
  const frames = Math.ceil(clip.duration * options.frameRate),
    bytes = options.width * options.height * 4;
  const batchSize = Math.max(1, Math.min(30, Math.floor(24_000_000 / bytes))),
    owned = new Set<string>(),
    chunks: string[] = [];
  const output = `${options.prefix}.mov`;
  let batch: Uint8Array[] = [],
    complete = false;
  const remove = async (name: string) => {
    try {
      await ffmpeg.deleteFile(name);
    } catch {
      /* Aborting the export also releases its filesystem. */
    }
    owned.delete(name);
  };
  try {
    for (let frame = 0; frame < frames; frame++) {
      options.signal.throwIfAborted();
      const result = await renderer.render(
        clip.graphic,
        clip.inPoint + (frame / options.frameRate) * (clip.speed ?? 1),
        clip.graphicDuration ?? clip.outPoint ?? clip.duration,
        options.width,
        options.height
      );
      if (result.pixels.length !== bytes)
        throw Error("Incomplete animation frame");
      batch.push(new Uint8Array(result.pixels.buffer));
      if (batch.length >= batchSize || frame === frames - 1) {
        const data = new Uint8Array(bytes * batch.length),
          count = batch.length;
        batch.forEach((b, i) => data.set(b, i * bytes));
        batch = [];
        const raw = `${options.prefix}.rgba`,
          chunk = `${options.prefix}-${chunks.length}.mov`;
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
          "rgba",
          "-video_size",
          `${options.width}x${options.height}`,
          "-framerate",
          String(options.frameRate),
          "-i",
          raw,
          "-frames:v",
          String(count),
          "-an",
          "-c:v",
          "qtrle",
          "-pix_fmt",
          "argb",
          chunk,
        ]);
        options.signal.throwIfAborted();
        if (code !== 0) throw Error("The animated title could not be encoded");
        chunks.push(chunk);
        await remove(raw);
      }
      options.onProgress(frame + 1, frames);
    }
    const list = `${options.prefix}-chunks.txt`;
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
    if (code !== 0) throw Error("The animation frames could not be assembled");
    complete = true;
    return { filename: output, duration: frames / options.frameRate };
  } finally {
    renderer.close();
    options.signal.removeEventListener("abort", cancel);
    batch = [];
    for (const filename of owned)
      if (!complete || filename !== output) await remove(filename);
  }
}
