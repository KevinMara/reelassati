import { FFmpeg } from "@ffmpeg/ffmpeg";
import type { Asset, EditProject } from "@contracts/workspace";
import { platformApi } from "./platform-api";
import { buildRenderPlan, RENDER_MAX_INPUT_BYTES } from "./render-plan";

export async function renderVideo(
  project: EditProject,
  assets: Asset[],
  options: {
    resolution: 720 | 1080;
    signal: AbortSignal;
    onProgress: (percent: number, stage: string) => void;
    loadAsset?: (id: string, signal: AbortSignal) => Promise<Uint8Array>;
  }
): Promise<{ file: File; width: number; height: number; duration: number }> {
  const ffmpeg = new FFmpeg();
  const cancel = () => ffmpeg.terminate();
  options.signal.throwIfAborted();
  options.signal.addEventListener("abort", cancel, { once: true });
  let wasmUrl: string | undefined;
  try {
    const firstPlan = buildRenderPlan(
      project,
      assets,
      new Set(),
      options.resolution
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
    let bytes = 0;
    const audioIds = new Set<string>();
    for (const [i, asset] of firstPlan.inputs.entries()) {
      options.signal.throwIfAborted();
      options.onProgress(
        Math.round((i / firstPlan.inputs.length) * 15),
        `Loading ${asset.name}`
      );
      const data = await (options.loadAsset || platformApi.downloadAsset)(
        asset.id,
        options.signal
      );
      bytes += data.byteLength;
      if (bytes > RENDER_MAX_INPUT_BYTES)
        throw new Error(
          "Source media is too large for this export. Split the project into shorter videos."
        );
      await ffmpeg.writeFile(`input-${i}`, data);
      let hasAudio = false;
      const probe = ({ message }: { message: string }) => {
        if (/Stream #.*Audio:/.test(message)) hasAudio = true;
      };
      ffmpeg.on("log", probe);
      await ffmpeg.exec(["-i", `input-${i}`]); // Probe only; FFmpeg returns 1 without an output.
      ffmpeg.off("log", probe);
      if (hasAudio) audioIds.add(asset.id);
    }
    const plan = buildRenderPlan(project, assets, audioIds, options.resolution);
    await ffmpeg.writeFile("captions.ass", plan.ass);
    ffmpeg.on("progress", ({ time }) =>
      options.onProgress(
        Math.max(
          15,
          Math.min(95, 15 + Math.round((time / 1_000_000 / plan.duration) * 80))
        ),
        "Rendering your video"
      )
    );
    const code = await ffmpeg.exec(plan.args, 15 * 60_000);
    options.signal.throwIfAborted();
    if (code !== 0)
      throw new Error(
        "The video could not be rendered. Try 720p, a shorter timeline, or replace an unsupported source file."
      );
    const result = await ffmpeg.readFile("output.mp4");
    if (typeof result === "string" || result.byteLength === 0)
      throw new Error("The export was empty. Your project is still saved.");
    const name =
      Array.from(project.title, character =>
        character.charCodeAt(0) < 32 ? "-" : character
      )
        .join("")
        .replace(/[\\/<>:"|?*]/g, "-")
        .slice(0, 140) || "My video";
    return {
      file: new File([new Uint8Array(result).buffer], `${name}.mp4`, {
        type: "video/mp4",
      }),
      width: plan.width,
      height: plan.height,
      duration: plan.duration,
    };
  } finally {
    options.signal.removeEventListener("abort", cancel);
    ffmpeg.terminate();
    if (wasmUrl) URL.revokeObjectURL(wasmUrl);
  }
}
