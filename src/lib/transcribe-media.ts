import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";
import type { Asset } from "@contracts/workspace";
import { platformApi } from "./platform-api";

/** Decode speech separately; the original video is never resized or re-encoded. */
export async function transcribeMedia(
  asset: Asset,
  language: string | undefined,
  projectId: string,
  onProgress?: (stage: string) => void,
  signal?: AbortSignal
) {
  const ffmpeg = new FFmpeg();
  const temporary: string[] = [];
  let wasmUrl = "";
  const cancel = () => ffmpeg.terminate();
  signal?.throwIfAborted();
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    onProgress?.(`Preparing speech from ${asset.name}…`);
    const response = await fetch("/vendor/render/core.bin", { signal });
    if (!response.ok || !response.body)
      throw new Error("The audio engine could not load");
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
    const source = await platformApi.downloadAssetBlob(asset.id, signal);
    await ffmpeg.createDir("/source");
    await ffmpeg.mount(
      FFFSType.WORKERFS,
      { blobs: [{ name: "media", data: source }] },
      "/source"
    );
    let hasAudio = false;
    const probe = ({ message }: { message: string }) => {
      if (/Stream #.*Audio:/.test(message)) hasAudio = true;
    };
    ffmpeg.on("log", probe);
    await ffmpeg.exec(["-i", "/source/media"]);
    ffmpeg.off("log", probe);
    if (!hasAudio)
      return { transcript: "", segments: [], provenance: undefined };
    // PCM is lossless at the speech model's native 16 kHz sample rate. Ten-minute
    // chunks are under 20 MB; extraction is sequential to bound WASM memory.
    for (let index = 0; ; index++) {
      signal?.throwIfAborted();
      const start = index * 600;
      onProgress?.(
        `Preparing captions · ${Math.floor(start / 60)} min processed`
      );
      const code = await ffmpeg.exec([
        "-y",
        "-ss",
        String(start),
        "-i",
        "/source/media",
        "-t",
        "600",
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        "speech.wav",
      ]);
      if (code !== 0)
        throw new Error("Speech could not be extracted from this media");
      const data = await ffmpeg.readFile("speech.wav");
      await ffmpeg.deleteFile("speech.wav");
      if (typeof data === "string")
        throw new Error("Speech extraction returned an invalid file");
      if (data.length < 100) break;
      const file = new File(
        [new Uint8Array(data).buffer],
        `Caption source ${index + 1}.wav`,
        { type: "audio/wav" }
      );
      const uploaded = await platformApi.uploadAsset(file, "audio");
      temporary.push(uploaded.id);
      if (data.length < 600 * 16000 * 2) break;
    }
    if (!temporary.length)
      return { transcript: "", segments: [], provenance: undefined };
    signal?.throwIfAborted();
    onProgress?.(`Transcribing ${asset.name}…`);
    return await platformApi.transcribe(
      asset.id,
      language,
      projectId,
      temporary
    );
  } finally {
    signal?.removeEventListener("abort", cancel);
    ffmpeg.terminate();
    if (wasmUrl) URL.revokeObjectURL(wasmUrl);
    await Promise.allSettled(temporary.map(id => platformApi.deleteAsset(id)));
  }
}
