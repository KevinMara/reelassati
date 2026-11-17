import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { Asset } from "@contracts/workspace";
import type { CubeLut } from "@contracts/color-lut";
import type { ExportFrameRate } from "@contracts/export-settings";
import {
  nativeTransitionInput,
  type NativeTransitionRecipe,
} from "@contracts/native-transitions";
import {
  nativeTransitionDefinitions,
  nativeTransitionProgram,
} from "@contracts/native-transition-program";
import { encodeNativeFrameProgram } from "./native-frame-encoding";
import { visualLayerSourceFilter } from "./visual-layer-rendering";

/** Decode the same composed input treatment used by ordinary export, then
 * execute the authored two-input graph. Source clocks and original audio stay
 * on the original clips; the generated intermediate is silent picture only. */
export async function renderNativeTransition(
  ffmpeg: FFmpeg,
  recipe: NativeTransitionRecipe,
  options: {
    assets: Asset[];
    filenames: ReadonlyMap<string, string>;
    colorLuts: ReadonlyMap<string, CubeLut>;
    width: number;
    height: number;
    frameRate: ExportFrameRate;
    prefix: string;
    signal: AbortSignal;
    onProgress?: (frame: number, total: number) => void;
  }
) {
  const { width, height, signal } = options,
    fps = options.frameRate;
  const frames = Math.max(2, Math.ceil(recipe.duration * fps - 1e-8));
  const program = nativeTransitionProgram(recipe.reference.id, frames, fps);
  const roles = nativeTransitionDefinitions[recipe.reference.id].inputOrder;
  const frameBytes = width * height * 4,
    batchSize = Math.max(1, Math.min(12, Math.floor(16_000_000 / frameBytes)));
  const cache = new Map<
    string,
    { start: number; count: number; bytes: Uint8Array }
  >();
  const temporary = new Set<string>();
  async function load(role: "outgoing" | "incoming", frame: number) {
    let batch = cache.get(role);
    if (!batch || frame < batch.start || frame >= batch.start + batch.count) {
      signal.throwIfAborted();
      const span = nativeTransitionInput(recipe, role),
        asset = options.assets.find(a => a.id === span.assetId);
      const path = span.assetId && options.filenames.get(span.assetId);
      if (!asset || !path || asset.kind !== "video" || asset.status !== "ready")
        throw new Error("A native transition source is unavailable");
      const count = Math.min(batchSize, frames - frame);
      const file = `${options.prefix}-${role}.rgba`;
      temporary.add(file);
      const filter = visualLayerSourceFilter(
        span,
        { width, height, frameRate: fps },
        {
          scope: role === "outgoing" ? 9001 : 9002,
          still: false,
          colorLuts: options.colorLuts,
          frameWindow: { start: frame, count },
        }
      );
      const args = [
        "-v",
        "error",
        "-y",
        "-copyts",
        "-start_at_zero",
        "-noaccurate_seek",
        "-ss",
        String(span.inPoint),
      ];
      if (asset.catalog?.alpha === true) args.push("-c:v", "libvpx-vp9");
      args.push(
        "-i",
        path,
        "-an",
        "-vf",
        `${filter},setpts=PTS-STARTPTS`,
        "-frames:v",
        String(count),
        "-pix_fmt",
        "rgba",
        "-f",
        "rawvideo",
        file
      );
      const code = await ffmpeg.exec(args);
      signal.throwIfAborted();
      if (code !== 0)
        throw new Error(
          "A native transition source frame could not be decoded"
        );
      const bytes = await ffmpeg.readFile(file);
      await ffmpeg.deleteFile(file);
      temporary.delete(file);
      if (typeof bytes === "string" || bytes.length !== count * frameBytes)
        throw new Error("Native transition source handles are incomplete");
      batch = { start: frame, count, bytes };
      cache.set(role, batch);
    }
    const offset = (frame - batch.start) * frameBytes,
      pixels = new Float32Array(frameBytes);
    for (let p = 0; p < width * height; p++) {
      const at = offset + p * 4,
        alpha = batch.bytes[at + 3] / 255;
      // A native adjacent-shot input is its whole composed frame over the
      // project's black canvas, including transparent source/fit boundaries.
      pixels[p * 4] = (batch.bytes[at] / 255) * alpha;
      pixels[p * 4 + 1] = (batch.bytes[at + 1] / 255) * alpha;
      pixels[p * 4 + 2] = (batch.bytes[at + 2] / 255) * alpha;
      pixels[p * 4 + 3] = 1;
    }
    return { width, height, pixels };
  }
  try {
    return await encodeNativeFrameProgram(
      ffmpeg,
      program,
      { width, height },
      {
        prefix: options.prefix,
        signal,
        onProgress: options.onProgress,
        loadInputs: async frame => [
          await load(roles[0], frame),
          await load(roles[1], frame),
        ],
      }
    );
  } finally {
    cache.clear();
    for (const file of temporary)
      await ffmpeg.deleteFile(file).catch(() => false);
  }
}
