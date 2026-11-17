import type { TimelineClip } from "@contracts/workspace";
import { normalizeClipColorLut, type CubeLut } from "@contracts/color-lut";
import { colorGradeFilter } from "./color-grade";
import { colorLutFilter } from "./color-lut";
import { visualRenderFilter } from "./visual-rendering";
import {
  terminalVideoPadding,
  type RenderSourceMetadata,
} from "./render-source-probe";

const number = (value: number) => Number(value.toFixed(4));

/** The exact export source chain, before layer compositing. Pixel preflight
 * consumes this same RGBA output; it must not approximate crop, pose or alpha. */
export function visualLayerSourceFilter(
  clip: TimelineClip,
  canvas: { width: number; height: number; frameRate: number },
  options: {
    scope: number;
    still: boolean;
    metadata?: RenderSourceMetadata;
    colorLuts?: ReadonlyMap<string, CubeLut>;
    /** Select from one continuous FPS clock before expensive visual treatment.
     * PTS is retained so motion curves keep their original phase. */
    frameWindow?: { start: number; count: number };
  }
) {
  const { width, height, frameRate } = canvas;
  const window = options.frameWindow;
  if (
    window &&
    (!Number.isSafeInteger(window.start) ||
      window.start < 0 ||
      !Number.isSafeInteger(window.count) ||
      window.count < 1)
  )
    throw new Error("Invalid source frame window");
  const frameSelection = window
    ? `:start_time=0:eof_action=pass,trim=start_frame=${window.start}:end_frame=${window.start + window.count}`
    : "";
  const speed = clip.speed ?? 1;
  const trim = `start=${number(clip.inPoint)}:end=${number(clip.inPoint + clip.duration * speed)}`;
  // Native batches retain absolute source PTS (including decoder preroll).
  // FPS chooses frames on one source-relative clock, then frame indexes bound
  // the effect. Resetting STARTPTS or trimming each input batch loses phase at
  // fractional seeks and slow motion, and can omit valid terminal frames.
  const clock = window
    ? `setpts=(PTS-${number(clip.inPoint)}/TB)/${speed}`
    : `trim=${trim},setpts=(PTS-STARTPTS)/${speed}`;
  const fit =
    clip.fit === "cover"
      ? `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`
      : `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black@0`;
  const look = normalizeClipColorLut(clip.colorLut);
  const lut =
    look && look.amount > 0
      ? colorLutFilter(
          look,
          options.colorLuts?.get(look.sha256)!,
          options.scope
        ) + ","
      : "";
  const padding = options.still
    ? ""
    : terminalVideoPadding(clip, options.metadata, frameRate);
  const transform = visualRenderFilter(clip, { width, height });
  const boundedFade = (value: number) =>
    Math.min(
      clip.duration,
      Math.max(0, Math.min(5, Number.isFinite(value) ? value : 0))
    );
  const fades = [
    clip.fadeIn
      ? `fade=t=in:st=0:d=${number(boundedFade(clip.fadeIn))}:alpha=1`
      : "",
    clip.fadeOut
      ? `fade=t=out:st=${number(Math.max(0, clip.duration - Math.max(0, Math.min(5, Number.isFinite(clip.fadeOut) ? clip.fadeOut : 0))))}:d=${number(boundedFade(clip.fadeOut))}:alpha=1`
      : "",
  ]
    .filter(Boolean)
    .join(",");
  return `${clock},format=rgba,${fit},setsar=1,fps=${frameRate}${frameSelection},${padding}${lut}${colorGradeFilter(clip, options.scope)}${transform ? `,${transform}` : ""}${fades ? `,${fades}` : ""},setpts=PTS+${number(clip.start)}/TB`;
}
