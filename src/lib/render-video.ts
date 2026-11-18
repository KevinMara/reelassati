import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";
import { withFfmpegLease } from "./ffmpeg-lease";
import type { Asset, EditProject } from "@contracts/workspace";
import { platformApi } from "./platform-api";
import { buildRenderPlan } from "./render-plan";
import { editorFont } from "@contracts/editor-fonts";
import { fetchEditorFont } from "./editor-fonts";
import { nativeTransitionRecipes } from "@contracts/native-transitions";
import { materializeNativeTransition } from "@contracts/native-transition-materialize";
import { probeExportMetadata } from "./export-probe";
import {
  probeRenderSource,
  type RenderSourceMetadata,
} from "./render-source-probe";
import type {
  ExportResolution,
  ExportFrameRate,
  ExportFormat,
} from "@contracts/export-settings";
import { verifyExportContainer } from "./export-verification";
import { loadColorLut, projectColorLuts } from "./color-lut";
import {
  serializeCubeLut,
  type ClipColorLut,
  type CubeLut,
} from "@contracts/color-lut";

export function renderVideo(
  project: EditProject,
  assets: Asset[],
  options: Parameters<typeof renderVideoWithLease>[2]
) {
  return withFfmpegLease(options.signal, () =>
    renderVideoWithLease(project, assets, options)
  );
}

async function renderVideoWithLease(
  project: EditProject,
  assets: Asset[],
  options: {
    resolution: ExportResolution;
    frameRate?: ExportFrameRate;
    format?: ExportFormat;
    signal: AbortSignal;
    onProgress: (percent: number, stage: string) => void;
    /** Internal silent transition preview; uses the same native export path. */
    nativePreviewOnly?: string;
    loadAsset?: (id: string, signal: AbortSignal) => Promise<Uint8Array>;
    loadLut?: (
      reference: ClipColorLut,
      signal: AbortSignal
    ) => Promise<CubeLut>;
  }
): Promise<{
  file: File;
  width: number;
  height: number;
  duration: number;
  frameRate: ExportFrameRate;
  format: ExportFormat;
}> {
  const ffmpeg = new FFmpeg();
  const cancel = () => ffmpeg.terminate();
  options.signal.throwIfAborted();
  options.signal.addEventListener("abort", cancel, { once: true });
  let wasmUrl: string | undefined;
  try {
    const colorLuts = new Map<string, CubeLut>();
    for (const reference of projectColorLuts(project)) {
      if (colorLuts.has(reference.sha256)) continue;
      options.onProgress(0, "Loading color looks");
      colorLuts.set(
        reference.sha256,
        await (options.loadLut ?? loadColorLut)(reference, options.signal)
      );
    }
    const firstPlan = buildRenderPlan(
      project,
      assets,
      new Set(),
      {
        resolution: options.resolution,
        frameRate: options.frameRate,
        format: options.format,
      },
      new Map(),
      colorLuts
    );
    options.onProgress(0, "Preparing export");
    const core = await fetch("/vendor/render/core.bin", {
      signal: AbortSignal.any([options.signal, AbortSignal.timeout(60000)]),
    });
    if (!core.ok || !core.body)
      throw new Error("The export engine could not load. Try again.");
    options.onProgress(1, "Unpacking export engine");
    const wasm = await new Response(
      core.body.pipeThrough(new DecompressionStream("gzip"))
    ).blob();
    options.signal.throwIfAborted();
    wasmUrl = URL.createObjectURL(
      new Blob([wasm], { type: "application/wasm" })
    );
    options.onProgress(2, "Starting export engine");
    const loadTimeout = setTimeout(() => ffmpeg.terminate(), 60000);
    try {
      await ffmpeg.load({
        classWorkerURL: new URL("/vendor/render/worker.js", location.origin)
          .href,
        coreURL: new URL("/vendor/render/core.js", location.origin).href,
        wasmURL: wasmUrl,
      });
    } finally {
      clearTimeout(loadTimeout);
    }
    options.onProgress(3, "Loading caption styles");
    const font = await fetch("/fonts/DejaVuSans.ttf", {
      signal: options.signal,
    });
    if (!font.ok) throw new Error("Caption font could not load. Try again.");
    await ffmpeg.writeFile(
      "DejaVuSans.ttf",
      new Uint8Array(await font.arrayBuffer())
    );
    const captionFont = editorFont(project.captionAppearance?.fontId);
    if (captionFont) {
      const bytes = await fetchEditorFont(captionFont.id, options.signal);
      await ffmpeg.writeFile(`${captionFont.id}.ttf`, bytes);
    }
    const sourceBlobs: Array<{ name: string; data: Blob }> = [];
    const audioIds = new Set<string>();
    const sourceMetadata = new Map<string, RenderSourceMetadata>();
    for (const [i, asset] of firstPlan.inputs.entries()) {
      options.signal.throwIfAborted();
      options.onProgress(
        Math.round((i / firstPlan.inputs.length) * 15),
        `Loading ${asset.name}`
      );
      const data = options.loadAsset
        ? new Blob([
            new Uint8Array(await options.loadAsset(asset.id, options.signal))
              .buffer,
          ])
        : await platformApi.downloadAssetBlob(asset.id, options.signal);
      sourceBlobs.push({ name: `input-${i}`, data });
    }
    if (sourceBlobs.length) {
      await ffmpeg.createDir("/sources");
      await ffmpeg.mount(FFFSType.WORKERFS, { blobs: sourceBlobs }, "/sources");
    }
    for (const [i, asset] of firstPlan.inputs.entries()) {
      options.signal.throwIfAborted();
      const metadata = await probeRenderSource(ffmpeg, `/sources/input-${i}`);
      options.signal.throwIfAborted();
      sourceMetadata.set(asset.id, metadata);
      if (metadata.hasAudio) audioIds.add(asset.id);
    }
    for (const look of firstPlan.luts)
      await ffmpeg.writeFile(look.file, serializeCubeLut(look.lut));
    let renderProject = project,
      renderAssets = assets;
    const filenames = new Map(
      firstPlan.inputs.map((asset, i) => [asset.id, `/sources/input-${i}`])
    );
    const nativeRecipes = nativeTransitionRecipes(project);
    const renderingStart = nativeRecipes.length ? 35 : 15;
    if (
      options.nativePreviewOnly &&
      !nativeRecipes.some(recipe => recipe.key === options.nativePreviewOnly)
    )
      throw new Error(
        "The native transition changed before its preview was rendered"
      );
    for (const [index, recipe] of nativeRecipes.entries()) {
      if (options.nativePreviewOnly && recipe.key !== options.nativePreviewOnly)
        continue;
      options.signal.throwIfAborted();
      options.onProgress(
        15 + Math.round((index / nativeRecipes.length) * 20),
        "Preparing transition"
      );
      const { renderNativeTransition } =
        await import("./render-native-transition");
      const rendered = await renderNativeTransition(ffmpeg, recipe, {
        assets,
        filenames,
        colorLuts,
        width: firstPlan.width,
        height: firstPlan.height,
        frameRate: firstPlan.frameRate,
        prefix: `native-${index}`,
        signal: options.signal,
        onProgress: (frame, total) =>
          options.onProgress(
            15 +
              Math.round(((index + frame / total) / nativeRecipes.length) * 20),
            "Rendering shot transition"
          ),
      });
      if (options.nativePreviewOnly) {
        const code = await ffmpeg.exec([
          "-v",
          "error",
          "-y",
          "-i",
          rendered.filename,
          "-an",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "18",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          "native-preview.mp4",
        ]);
        options.signal.throwIfAborted();
        if (code !== 0)
          throw new Error("The shot transition preview could not be encoded");
        const verified = await probeExportMetadata(ffmpeg, {
          filename: "native-preview.mp4",
          width: rendered.width,
          height: rendered.height,
          duration: rendered.duration,
          frameRate: firstPlan.frameRate,
          format: "mp4",
        });
        const bytes = await ffmpeg.readFile("native-preview.mp4");
        if (typeof bytes === "string")
          throw new Error("The shot transition preview is empty");
        verifyExportContainer(bytes, "mp4");
        return {
          file: new File(
            [new Uint8Array(bytes).buffer],
            "shot-transition.mp4",
            { type: "video/mp4" }
          ),
          ...verified,
          frameRate: firstPlan.frameRate,
          format: "mp4" as const,
        };
      }
      const materialized = materializeNativeTransition(renderProject, recipe, {
        ...rendered,
        url: "",
      });
      renderProject = materialized.project;
      renderAssets = [...renderAssets, materialized.asset];
      filenames.set(materialized.asset.id, rendered.filename);
      sourceMetadata.set(materialized.asset.id, { hasAudio: false });
    }
    const plan = buildRenderPlan(
      renderProject,
      renderAssets,
      audioIds,
      {
        resolution: options.resolution,
        frameRate: options.frameRate,
        format: options.format,
      },
      sourceMetadata,
      colorLuts
    );
    await ffmpeg.writeFile("captions.ass", plan.ass);
    const renderProgress = ({ time }: { time: number }) =>
      options.onProgress(
        Math.max(
          renderingStart,
          Math.min(
            95,
            renderingStart +
              Math.round(
                (time / 1_000_000 / plan.duration) * (95 - renderingStart)
              )
          )
        ),
        "Rendering your video"
      );
    ffmpeg.on("progress", renderProgress);
    const code = await ffmpeg.exec(
      plan.args.map(arg => {
        const match = /^input-(\d+)$/.exec(arg);
        if (!match) return arg;
        const filename = filenames.get(plan.inputs[Number(match[1])].id);
        if (!filename) throw new Error("An export source is not mounted");
        return filename;
      })
    );
    options.signal.throwIfAborted();
    if (code !== 0)
      throw new Error(
        "The video could not be rendered. Try 720p, a shorter timeline, or replace an unsupported source file."
      );
    ffmpeg.off("progress", renderProgress);
    options.onProgress(96, "Checking duration, picture, frame rate and format");
    const verified = await probeExportMetadata(ffmpeg, plan);
    options.onProgress(98, "Checking video and audio playback");
    const decodeCode = await ffmpeg.exec([
      "-v",
      "error",
      "-xerror",
      "-i",
      plan.filename,
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-f",
      "null",
      "-",
    ]);
    options.signal.throwIfAborted();
    if (decodeCode !== 0)
      throw new Error(
        "The exported file has a playback error. Your project is saved; please retry export."
      );
    const result = await ffmpeg.readFile(plan.filename);
    if (typeof result === "string" || result.byteLength === 0)
      throw new Error("The export was empty. Your project is still saved.");
    verifyExportContainer(result, plan.format);
    const name =
      Array.from(project.title, character =>
        character.charCodeAt(0) < 32 ? "-" : character
      )
        .join("")
        .replace(/[\\/<>:"|?*]/g, "-")
        .slice(0, 140) || "My video";
    return {
      file: new File(
        [new Uint8Array(result).buffer],
        `${name}.${plan.extension}`,
        {
          type: plan.mimeType,
        }
      ),
      ...verified,
      frameRate: plan.frameRate,
      format: plan.format,
    };
  } finally {
    options.signal.removeEventListener("abort", cancel);
    ffmpeg.terminate();
    if (wasmUrl) URL.revokeObjectURL(wasmUrl);
  }
}
