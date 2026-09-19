import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";
import type { Asset } from "@contracts/workspace";
import { PlatformApiError, platformApi } from "./platform-api";
import { probeExportMetadata } from "./export-probe";
import {
  ANALYSIS_DIRECT_BYTES,
  ANALYSIS_PROXY_BYTES,
  ANALYSIS_PROXY_FPS,
  ANALYSIS_PROXY_SIDE,
  analysisProxyArguments,
  analysisProxyVideoBitrate,
  readAnalysisSourceMetadata,
} from "./analysis-proxy";

let probeSequence = 0;

/** Caller has already obtained the user's source-rights confirmation and accepted analysis cost. */
export async function analyzeMedia(
  asset: Asset,
  platform: string,
  focus?: string,
  onProgress?: (stage: string) => void,
  signal?: AbortSignal
) {
  const input = {
    assetId: asset.id,
    platform,
    focus,
    sourceRightsConfirmed: true,
  };
  signal?.throwIfAborted();
  if (asset.size <= ANALYSIS_DIRECT_BYTES) {
    onProgress?.(`Analyzing ${asset.name}…`);
    try {
      return await platformApi.analyzeVideo(input, signal);
    } catch (error) {
      // A rejected-size request has not purchased an analysis. Never repeat other paid failures.
      if (!(error instanceof PlatformApiError) || error.status !== 413)
        throw error;
    }
  }

  const ffmpeg = new FFmpeg();
  let wasmUrl = "";
  let temporaryAssetId: string | undefined;
  const cancel = () => ffmpeg.terminate();
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    signal?.throwIfAborted();
    onProgress?.(`Preparing a full-length analysis copy of ${asset.name}…`);
    const response = await fetch("/vendor/render/core.bin", { signal });
    if (!response.ok || !response.body)
      throw new Error("The video analysis engine could not load.");
    const wasm = await new Response(
      response.body.pipeThrough(new DecompressionStream("gzip"))
    ).blob();
    wasmUrl = URL.createObjectURL(
      new Blob([wasm], { type: "application/wasm" })
    );
    await ffmpeg.load({
      classWorkerURL: new URL("/vendor/render/worker.js", location.origin).href,
      coreURL: new URL("/vendor/render/core.js", location.origin).href,
      wasmURL: wasmUrl,
    });
    signal?.throwIfAborted();
    const source = await platformApi.downloadAssetBlob(asset.id, signal);
    await ffmpeg.createDir("/source");
    await ffmpeg.mount(
      FFFSType.WORKERFS,
      { blobs: [{ name: "media", data: source }] },
      "/source"
    );
    const probePath = `analysis-source-${++probeSequence}.json`;
    let metadata: ReturnType<typeof readAnalysisSourceMetadata>;
    try {
      const code = await ffmpeg.ffprobe([
        "-v",
        "error",
        "-show_error",
        "-show_format",
        "-show_streams",
        "-of",
        "json",
        "/source/media",
        "-o",
        probePath,
      ]);
      if (code !== 0 && code !== -1)
        throw new Error("The source video could not be inspected.");
      const report = await ffmpeg.readFile(probePath, "utf8");
      if (typeof report !== "string")
        throw new Error("The source video metadata is unavailable.");
      metadata = readAnalysisSourceMetadata(JSON.parse(report));
    } finally {
      await ffmpeg.deleteFile(probePath).catch(() => false);
    }
    let videoBitrate = analysisProxyVideoBitrate(metadata);
    let output: Uint8Array | undefined;
    const progress = ({ time }: { time: number }) => {
      const fraction = Math.max(
        0,
        Math.min(99, Math.floor((time / 1_000_000 / metadata.duration) * 100))
      );
      onProgress?.(
        `Preparing full-length analysis · ${fraction}% · 8 fps, complete audio`
      );
    };
    ffmpeg.on("progress", progress);
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        signal?.throwIfAborted();
        const code = await ffmpeg.exec(
          analysisProxyArguments(metadata, videoBitrate)
        );
        if (code !== 0)
          throw new Error(
            "The full-length analysis copy could not be prepared. Your original file is unchanged."
          );
        const bytes = await ffmpeg.readFile("output.mp4");
        if (typeof bytes === "string" || bytes.length === 0)
          throw new Error("The analysis copy is empty.");
        if (bytes.byteLength <= ANALYSIS_PROXY_BYTES) {
          output = new Uint8Array(bytes);
          break;
        }
        videoBitrate = Math.floor(
          videoBitrate * (ANALYSIS_PROXY_BYTES / bytes.byteLength) * 0.8
        );
      }
    } finally {
      ffmpeg.off("progress", progress);
    }
    if (!output)
      throw new Error(
        "The complete video could not fit the provider's analysis size limit. No section was discarded."
      );
    signal?.throwIfAborted();
    onProgress?.("Checking the analysis copy's full duration and playback…");
    await probeExportMetadata(ffmpeg, {
      width: ANALYSIS_PROXY_SIDE,
      height: ANALYSIS_PROXY_SIDE,
      duration: metadata.duration,
    });
    const decoded = await ffmpeg.exec([
      "-v",
      "error",
      "-xerror",
      "-i",
      "output.mp4",
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-f",
      "null",
      "-",
    ]);
    if (decoded !== 0)
      throw new Error(
        "The analysis copy failed its playback check. Your original file is unchanged."
      );
    signal?.throwIfAborted();
    onProgress?.("Uploading the temporary private analysis copy…");
    const file = new File(
      [output.buffer as ArrayBuffer],
      `Temporary analysis · ${asset.name.replace(/\.[^.]+$/, "")}.mp4`,
      { type: "video/mp4" }
    );
    // Upload is intentionally not inserted into the client workspace or timeline.
    // If Cancel occurs during upload, wait for its ID so the server file can still be deleted.
    const uploaded = await platformApi.uploadAsset(file, "video");
    temporaryAssetId = uploaded.id;
    signal?.throwIfAborted();
    onProgress?.(
      `Analyzing ${asset.name} · complete audio, sampled video at 8 fps…`
    );
    return await platformApi.analyzeVideo(
      {
        ...input,
        analysisAssetId: uploaded.id,
        analysisFramesPerSecond: ANALYSIS_PROXY_FPS,
      },
      signal
    );
  } finally {
    signal?.removeEventListener("abort", cancel);
    ffmpeg.terminate();
    if (wasmUrl) URL.revokeObjectURL(wasmUrl);
    if (temporaryAssetId)
      await platformApi.deleteAsset(temporaryAssetId).catch(() => undefined);
  }
}
